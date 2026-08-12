import { readDraftFromStorage, writeDraftToStorage, STORAGE_KEYS } from './storage.js';

export function migrateLegacyDraftConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const patch = {};
  const outputName = String(config.output_name ?? '').trim();
  if (outputName === 'aki' || outputName === 'aki_') {
    patch.output_name = 'lulynx_';
  }
  const trainDataDir = String(config.train_data_dir ?? '').replaceAll('\\', '/').replace(/\/+$/, '').trim();
  if (trainDataDir === './train/aki' || trainDataDir === 'train/aki') {
    patch.train_data_dir = './output/lulynx';
  }
  if (Object.keys(patch).length === 0) return config;
  return { ...config, ...patch };
}

export function createAppBootstrap({
  state,
  api,
  mergeConfigPatch,
  applyBackendConfigOptions,
  updateJSONPreview,
  renderView,
  loadLocalTaskHistory,
  mergeTaskHistory,
  configTransaction,
}) {
  function loadDraft() {
    const parsed = readDraftFromStorage();
    if (!parsed) return false;
    mergeConfigPatch(migrateLegacyDraftConfig(parsed));
    state.hasLocalDraft = true;
    return true;
  }

  function saveDraft() {
    writeDraftToStorage(state.config);
    state.hasLocalDraft = true;
    return true;
    configTransaction.markDirty(state.activeTrainingType, state.config);
  }

  async function loadBootstrapData() {
    state.loading.runtime = true;
    updateJSONPreview();

    const timers = {};
    const timedFetch = (name, promise) => {
      const start = Date.now();
      return promise.finally(() => {
        timers[name] = Date.now() - start;
      });
    };

    const [
      runtimeResult,
      presetsResult,
      trainDraftsResult,
      trainingProjectsResult,
      trainingQueueResult,
      savedParamsResult,
      tasksResult,
      interrogatorsResult,
      configOptionsResult,
      executionProfilesResult,
    ] = await Promise.allSettled([
      timedFetch('getGraphicCards', api.getGraphicCards()),
      timedFetch('getPresets', api.getPresets()),
      timedFetch('getTrainDrafts', api.getTrainDrafts()),
      timedFetch('getTrainingProjects', api.getTrainingProjects()),
      timedFetch('getTrainingQueue', api.getTrainingQueue()),
      timedFetch('getSavedParams', api.getSavedParams()),
      timedFetch('getTasks', api.getTasks()),
      timedFetch('getInterrogators', api.getInterrogators()),
      timedFetch('getConfigOptions', api.getConfigOptions()),
      timedFetch('getExecutionProfiles', api.getExecutionProfiles()),
    ]);

    if (runtimeResult.status === 'fulfilled') {
      state.runtime = runtimeResult.value.data || null;
      state.runtimeError = '';
    } else {
      state.runtimeError = runtimeResult.reason?.message || '运行环境状态不可用。';
    }

    if (presetsResult.status === 'fulfilled') {
      state.presets = presetsResult.value?.data?.presets || [];
    }

    if (trainDraftsResult.status === 'fulfilled') {
      const payload = trainDraftsResult.value?.data || {};
      configTransaction.initialize(payload);
      const diskDraft = payload.drafts?.[state.activeTrainingType];
      if (!state.hasLocalDraft && diskDraft && typeof diskDraft === 'object') {
        mergeConfigPatch(migrateLegacyDraftConfig(diskDraft));
        state.hasLocalDraft = true;
    return true;
        writeDraftToStorage(state.config);
      } else if (state.hasLocalDraft) {
        configTransaction.markDirty(state.activeTrainingType, state.config);
      }
    } else {
      configTransaction.initialize();
      if (state.hasLocalDraft) {
        configTransaction.markDirty(state.activeTrainingType, state.config);
      }
    }

    if (trainingProjectsResult.status === 'fulfilled') {
      state.trainingWorkspace = trainingProjectsResult.value?.data || state.trainingWorkspace;
      const activeProjectConfig = state.trainingWorkspace?.active_config;
      if (!state.hasLocalDraft && activeProjectConfig && typeof activeProjectConfig === 'object') {
        const projectType = String(activeProjectConfig.model_train_type || '').trim();
        if (projectType) {
          state.activeTrainingType = projectType;
          localStorage.setItem(STORAGE_KEYS.trainingType, projectType);
          if (typeof window !== 'undefined' && window.currentTrainingType !== undefined) {
            window.currentTrainingType = projectType;
          }
        }
        mergeConfigPatch(migrateLegacyDraftConfig(activeProjectConfig));
        state.hasLocalDraft = true;
    return true;
        writeDraftToStorage(state.config);
        configTransaction.markDirty(state.activeTrainingType, state.config);
      }
    }

    if (trainingQueueResult.status === 'fulfilled' && trainingQueueResult.value) {
      state.trainingQueue = trainingQueueResult.value;
    }

    if (savedParamsResult.status === 'fulfilled' && !state.hasLocalDraft) {
      mergeConfigPatch(migrateLegacyDraftConfig(savedParamsResult.value.data || {}));
      saveDraft();
    }

    if (tasksResult.status === 'fulfilled') {
      const backendTasks = tasksResult.value?.data?.tasks || [];
      const localHistory = await loadLocalTaskHistory();
      state.tasks = mergeTaskHistory(backendTasks, localHistory, state.tasks);
      state._taskHistoryDirty = true;
      for (const task of state.tasks) {
        if (task.status === 'FINISHED' && task._summary && task._summary._v >= 2) {
          state.taskSummaries[task.id] = task._summary;
        }
      }
    }

    if (interrogatorsResult.status === 'fulfilled') {
      state.interrogators = interrogatorsResult.value?.data || null;
    }

    if (configOptionsResult.status === 'fulfilled') {
      state.backendConfigOptions = configOptionsResult.value?.data || null;
      applyBackendConfigOptions(state.backendConfigOptions);
    }

    if (executionProfilesResult.status === 'fulfilled') {
      state.executionProfiles = executionProfilesResult.value?.data?.profiles || [];
    }

    state.loading.runtime = false;
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      updateJSONPreview();
    }
  }

  async function refreshBackendConfigOptions() {
    try {
      const [optionsResp, profilesResp] = await Promise.allSettled([
        api.getConfigOptions(),
        api.getExecutionProfiles(),
      ]);
      if (optionsResp.status === 'fulfilled') {
        state.backendConfigOptions = optionsResp.value?.data || null;
        applyBackendConfigOptions(state.backendConfigOptions);
      }
      if (profilesResp.status === 'fulfilled') {
        state.executionProfiles = profilesResp.value?.data?.profiles || [];
      }
      if (state.activeModule === 'config') renderView('config');
    } catch (_e) {
      // Keep bootstrap refresh best-effort; visible backend-offline state is handled by heartbeat.
    }
  }

  return {
    loadDraft,
    saveDraft,
    loadBootstrapData,
    refreshBackendConfigOptions,
  };
}
