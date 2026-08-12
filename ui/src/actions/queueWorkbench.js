function runIdOf(value) {
  return String(value?.run_id || value?.id || value || '').trim();
}

function uniqueRequestId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function formatQueueEta(eta) {
  if (!eta?.available) return '预计等待：不可用';
  const seconds = Math.max(Number(eta.wait_seconds) || 0, 0);
  if (seconds < 60) return `预计等待约 ${Math.round(seconds)} 秒`;
  if (seconds < 3600) return `预计等待约 ${Math.round(seconds / 60)} 分钟`;
  return `预计等待约 ${(seconds / 3600).toFixed(1)} 小时`;
}

export function createQueueWorkbenchActions({ state, api, showToast, renderView }) {
  let queueOperation = Promise.resolve();
  let draggedRunId = '';
  const replayFlights = new Map();
  const controlFlights = new Map();

  function enqueue(operation) {
    const next = queueOperation.catch(() => {}).then(operation);
    queueOperation = next;
    return next;
  }

  async function refreshTrainingQueue({ render = true } = {}) {
    const payload = await api.getTrainingQueue();
    if (payload && typeof payload === 'object') state.trainingQueue = payload;
    if (render && state.activeModule === 'training') renderView('training');
    return state.trainingQueue;
  }

  function queuedIds() {
    return (state.trainingQueue?.queued_runs || []).map(runIdOf).filter(Boolean);
  }

  function ensureEditModal() {
    let modal = document.getElementById('queue-edit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'queue-edit-modal';
    modal.className = 'queue-edit-modal';
    modal.innerHTML = `
      <div class="queue-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="queue-edit-title">
        <header>
          <div><h3 id="queue-edit-title">编辑排队任务</h3><p id="queue-edit-subtitle"></p></div>
          <button type="button" class="modal-close" onclick="closeQueuedRunEditor()" title="关闭">&times;</button>
        </header>
        <div class="queue-edit-fields">
          <label><span>输出名称</span><input id="queue-edit-output-name" type="text" maxlength="256"></label>
          <label><span>训练步数</span><input id="queue-edit-steps" type="number" min="0" step="1"></label>
          <label><span>训练轮数</span><input id="queue-edit-epochs" type="number" min="0" step="1"></label>
          <label><span>学习率</span><input id="queue-edit-lr" type="number" min="0" step="any"></label>
        </div>
        <footer>
          <button type="button" class="btn btn-outline btn-sm" onclick="closeQueuedRunEditor()">取消</button>
          <button type="button" class="btn btn-primary btn-sm" id="queue-edit-save">保存</button>
        </footer>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeQueuedRunEditor();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function closeQueuedRunEditor() {
    const modal = document.getElementById('queue-edit-modal');
    modal?.classList.remove('open');
  }

  async function openQueuedRunEditor(runId) {
    try {
      const context = await api.getQueuedRunEditContext(runId);
      const config = context?.config || {};
      const modal = ensureEditModal();
      modal.dataset.runId = runId;
      modal.dataset.revision = String(context?.revision ?? state.trainingQueue?.revision ?? 0);
      modal.querySelector('#queue-edit-subtitle').textContent = runId.slice(0, 12);
      modal.querySelector('#queue-edit-output-name').value = config.output_name || '';
      modal.querySelector('#queue-edit-steps').value = config.max_train_steps ?? '';
      modal.querySelector('#queue-edit-epochs').value = config.max_train_epochs ?? '';
      modal.querySelector('#queue-edit-lr').value = config.learning_rate ?? '';
      modal.querySelector('#queue-edit-save').onclick = saveQueuedRunEditor;
      modal.classList.add('open');
      modal.querySelector('#queue-edit-output-name').focus();
    } catch (error) {
      showToast(error.message || '读取排队任务配置失败。');
    }
  }

  function numericPatch(modal, selector, key, integer = false) {
    const raw = String(modal.querySelector(selector)?.value || '').trim();
    if (!raw) return {};
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) throw new Error(`${key} 数值无效。`);
    return { [key]: integer ? Math.floor(number) : number };
  }

  function saveQueuedRunEditor() {
    return enqueue(async () => {
      const modal = document.getElementById('queue-edit-modal');
      if (!modal?.classList.contains('open')) return;
      const runId = modal.dataset.runId || '';
      try {
        const outputName = String(modal.querySelector('#queue-edit-output-name')?.value || '').trim();
        if (!outputName) throw new Error('输出名称不能为空。');
        const patch = {
          output_name: outputName,
          ...numericPatch(modal, '#queue-edit-steps', 'max_train_steps', true),
          ...numericPatch(modal, '#queue-edit-epochs', 'max_train_epochs', true),
          ...numericPatch(modal, '#queue-edit-lr', 'learning_rate'),
        };
        state.trainingQueue = await api.editQueuedRun(runId, {
          revision: Number(modal.dataset.revision || state.trainingQueue?.revision || 0),
          patch,
        });
        closeQueuedRunEditor();
        renderView('training');
        showToast('排队任务配置已更新。');
      } catch (error) {
        await refreshTrainingQueue({ render: false }).catch(() => {});
        showToast(error.message || '排队任务保存失败。');
      }
    });
  }

  function commitOrder(orderedRunIds) {
    return enqueue(async () => {
      try {
        state.trainingQueue = await api.reorderTrainingQueue({
          revision: Number(state.trainingQueue?.revision || 0),
          ordered_run_ids: orderedRunIds,
        });
        renderView('training');
      } catch (error) {
        await refreshTrainingQueue({ render: false }).catch(() => {});
        renderView('training');
        showToast(error.message || '队列排序失败，已刷新最新顺序。');
      }
    });
  }

  function moveQueuedRun(runId, direction) {
    const ids = queuedIds();
    const index = ids.indexOf(runId);
    const next = index + Number(direction || 0);
    if (index < 0 || next < 0 || next >= ids.length) return Promise.resolve();
    [ids[index], ids[next]] = [ids[next], ids[index]];
    return commitOrder(ids);
  }

  function queueDragStart(event, runId) {
    draggedRunId = runId;
    event?.dataTransfer?.setData('text/plain', runId);
    if (event?.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function queueDragOver(event) {
    event?.preventDefault?.();
    if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function queueDrop(event, targetRunId) {
    event?.preventDefault?.();
    const source = draggedRunId || event?.dataTransfer?.getData('text/plain') || '';
    draggedRunId = '';
    const ids = queuedIds();
    const from = ids.indexOf(source);
    const to = ids.indexOf(targetRunId);
    if (from < 0 || to < 0 || from === to) return Promise.resolve();
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    return commitOrder(ids);
  }

  function replayTrainingRun(runId, replayKind) {
    const key = `${runId}:${replayKind}`;
    if (replayFlights.has(key)) return replayFlights.get(key);
    const operation = enqueue(async () => {
      try {
        const result = await api.replayTrainingRun(runId, {
          replay_kind: replayKind,
          request_id: uniqueRequestId(replayKind),
          patch: {},
        });
        await refreshTrainingQueue({ render: false });
        renderView('training');
        showToast(result?.status === 'queued' ? '任务已重新加入队列。' : '任务已重新启动。');
        return result;
      } catch (error) {
        showToast(error.message || '重新提交任务失败。');
        return null;
      }
    }).finally(() => replayFlights.delete(key));
    replayFlights.set(key, operation);
    return operation;
  }

  function controlTrainingRun(runId, action) {
    const id = String(runId || '').trim();
    const key = id + ':' + action;
    if (!id || !['pause', 'resume'].includes(action)) return Promise.resolve(null);
    if (controlFlights.has(key)) return controlFlights.get(key);
    const operation = enqueue(async () => {
      try {
        const result = action === 'pause'
          ? await api.pauseTrainingQueueRun(id)
          : await api.resumeTrainingQueueRun(id);
        if (result?.queue && typeof result.queue === 'object') {
          state.trainingQueue = result.queue;
        } else {
          await refreshTrainingQueue({ render: false });
        }
        const task = (state.tasks || []).find((item) => runIdOf(item) === id);
        if (task) task.status = action === 'pause' ? 'PAUSED' : 'RUNNING';
        renderView('training');
        showToast(action === 'pause' ? '训练已暂停。' : '训练已恢复。');
        return result;
      } catch (error) {
        await refreshTrainingQueue({ render: false }).catch(() => {});
        renderView('training');
        showToast(error.message || (action === 'pause' ? '暂停训练失败。' : '恢复训练失败。'));
        return null;
      }
    }).finally(() => controlFlights.delete(key));
    controlFlights.set(key, operation);
    return operation;
  }

  function pauseTrainingRun(runId) {
    return controlTrainingRun(runId, 'pause');
  }

  function resumeTrainingRun(runId) {
    return controlTrainingRun(runId, 'resume');
  }

  return {
    refreshTrainingQueue,
    openQueuedRunEditor,
    closeQueuedRunEditor,
    saveQueuedRunEditor,
    moveQueuedRun,
    queueDragStart,
    queueDragOver,
    queueDrop,
    replayTrainingRun,
    pauseTrainingRun,
    resumeTrainingRun,
  };
}
