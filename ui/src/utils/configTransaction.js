function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function persistenceError(error) {
  const detail = error?.payload?.detail;
  if (error?.status === 409 && detail?.code === 'train_draft_revision_conflict') {
    const conflict = new Error('配置已被另一个页面更新，请刷新页面后再提交。');
    conflict.code = detail.code;
    conflict.currentRevision = detail.current_revision;
    return conflict;
  }
  if (error instanceof Error) return error;
  return new Error(String(error || '配置保存失败。'));
}

export function createConfigTransaction({ state, api, debounceMs = 240 }) {
  let initialized = false;
  let serverRevision = 0;
  let editRevision = 0;
  let persistedEditRevision = 0;
  let submitSequence = 0;
  let saveTimer = null;
  let savePromise = null;
  let lastError = null;
  const pendingByType = new Map();
  const knownDrafts = new Map();

  function syncStatus(status) {
    state.configPersistence = {
      status,
      dirty: pendingByType.size > 0 || persistedEditRevision < editRevision,
      editRevision,
      persistedEditRevision,
      serverRevision,
      error: lastError?.message || '',
    };
  }

  function initialize(payload = {}) {
    const revision = Number(payload?.revision);
    serverRevision = Number.isInteger(revision) && revision >= 0 ? revision : 0;
    knownDrafts.clear();
    for (const [typeId, config] of Object.entries(payload?.drafts || {})) {
      if (config && typeof config === 'object') knownDrafts.set(typeId, cloneValue(config));
    }
    for (const [typeId, item] of pendingByType) knownDrafts.set(typeId, cloneValue(item.config));
    initialized = true;
    lastError = null;
    syncStatus(pendingByType.size > 0 ? 'dirty' : 'ready');
    if (pendingByType.size > 0) scheduleSave();
  }

  function scheduleSave() {
    if (!initialized) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush().catch(() => {});
    }, Math.max(0, debounceMs));
  }

  function markDirty(typeId = state.activeTrainingType, config = state.config) {
    const normalizedType = String(typeId || '').trim();
    if (!normalizedType || !config || typeof config !== 'object') return editRevision;
    editRevision += 1;
    pendingByType.set(normalizedType, {
      revision: editRevision,
      config: cloneValue(config),
    });
    knownDrafts.set(normalizedType, cloneValue(config));
    lastError = null;
    syncStatus('dirty');
    scheduleSave();
    return editRevision;
  }

  function restorePending(batch) {
    for (const [typeId, item] of batch) {
      const newer = pendingByType.get(typeId);
      if (!newer || newer.revision < item.revision) pendingByType.set(typeId, item);
    }
  }

  async function drain() {
    while (pendingByType.size > 0) {
      const batch = [...pendingByType.entries()];
      pendingByType.clear();
      const clientRevision = Math.max(...batch.map(([, item]) => item.revision));
      const drafts = Object.fromEntries(batch.map(([typeId, item]) => [typeId, item.config]));
      const active = batch.reduce((latest, entry) => (
        entry[1].revision > latest[1].revision ? entry : latest
      ));
      syncStatus('saving');
      try {
        const response = await api.saveTrainDrafts({
          version: 1,
          revision: serverRevision,
          client_revision: clientRevision,
          typeId: active[0],
          drafts,
        });
        const payload = response?.data || {};
        const nextServerRevision = Number(payload.revision);
        if (!Number.isInteger(nextServerRevision) || nextServerRevision <= serverRevision) {
          throw new Error('配置保存响应缺少有效 revision。');
        }
        serverRevision = nextServerRevision;
        persistedEditRevision = Math.max(persistedEditRevision, clientRevision);
        lastError = null;
        syncStatus(pendingByType.size > 0 ? 'dirty' : 'saved');
      } catch (error) {
        restorePending(batch);
        lastError = persistenceError(error);
        syncStatus('error');
        throw lastError;
      }
    }
  }

  function flush() {
    if (!initialized) {
      return Promise.reject(new Error('配置状态尚未加载，请稍后重试。'));
    }
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (savePromise) return savePromise;
    if (pendingByType.size === 0) {
      if (lastError) return Promise.reject(lastError);
      syncStatus('saved');
      return Promise.resolve();
    }
    savePromise = drain().finally(() => {
      savePromise = null;
    });
    return savePromise;
  }

  async function prepareSubmitSnapshot() {
    await flush();
    if (persistedEditRevision < editRevision) {
      throw new Error('配置尚未保存，已阻止提交训练。');
    }
    submitSequence += 1;
    return {
      typeId: state.activeTrainingType,
      config: cloneValue(state.config),
      editRevision,
      savedRevision: serverRevision,
      idempotencyKey: `lulynx-${serverRevision}-${editRevision}-${submitSequence}`,
    };
  }

  function isSnapshotCurrent(snapshot) {
    return Boolean(snapshot) && snapshot.editRevision === editRevision;
  }

  return {
    initialize,
    markDirty,
    flush,
    prepareSubmitSnapshot,
    isSnapshotCurrent,
    getDraft: (typeId) => {
      const draft = knownDrafts.get(String(typeId || '').trim());
      return draft ? cloneValue(draft) : null;
    },
    getStatus: () => ({ ...state.configPersistence }),
  };
}
