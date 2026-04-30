import { icon as _ico } from '../utils/dom.js';

export function createBootstrapRuntimeController({
  api,
  state,
  mergeConfigPatch,
  saveDraft,
  taskHistorySummary,
  renderView,
  updateJSONPreview,
  renderTaskStatus,
  syncFooterAction,
  startTrainingLogPolling,
  startSysMonitorPolling,
  showToast,
}) {
  async function loadBootstrapData() {
    state.loading.runtime = true;
    updateJSONPreview();

    const [runtimeResult, presetsResult, savedParamsResult, tasksResult, interrogatorsResult] = await Promise.allSettled([
      api.getGraphicCards(),
      api.getPresets(),
      api.getSavedParams(),
      api.getTasks(),
      api.getInterrogators(),
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

    if (savedParamsResult.status === 'fulfilled' && !state.hasLocalDraft) {
      mergeConfigPatch(savedParamsResult.value.data || {});
      saveDraft();
    }

    if (tasksResult.status === 'fulfilled') {
      const backendTasks = tasksResult.value?.data?.tasks || [];
      const localHistory = await taskHistorySummary.loadLocalTaskHistory();
      state.tasks = taskHistorySummary.mergeTaskHistory(backendTasks, localHistory, state.tasks);
      state._taskHistoryDirty = true;
      for (const task of state.tasks) {
        if (task._summary && task._summary._v >= 2) state.taskSummaries[task.id] = task._summary;
      }
    }
    if (interrogatorsResult.status === 'fulfilled') {
      state.interrogators = interrogatorsResult.value?.data || null;
    }

    state.loading.runtime = false;
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      updateJSONPreview();
    }
  }

  function startTaskPolling() {
    let pollFailCount = 0;
    const BASE_INTERVAL = 3000;
    const MAX_INTERVAL = 30000;

    async function poll() {
      try {
        const hadRunning = state.tasks.some((task) => task.status === 'RUNNING');
        const prevRunningIds = state.tasks.filter((task) => task.status === 'RUNNING').map((task) => task.id);
        const response = await api.getTasks();
        const backendTasks = response?.data?.tasks || [];
        const localHistory = await taskHistorySummary.loadLocalTaskHistory();
        state.tasks = taskHistorySummary.mergeTaskHistory(backendTasks, localHistory, state.tasks);
        state._taskHistoryDirty = true;
        const hasRunning = state.tasks.some((task) => task.status === 'RUNNING');
        await taskHistorySummary.saveLocalTaskHistory();

        if (pollFailCount > 0) {
          pollFailCount = 0;
          state.backendOffline = false;
          showToast('✓ 后端服务已连接');
          renderTaskStatus();
        }

        if (hadRunning && !hasRunning) {
          const lastTask = state.tasks.find((task) => prevRunningIds.includes(task.id))
            || state.tasks[state.tasks.length - 1];
          const failed = lastTask && (lastTask.status === 'TERMINATED' || (lastTask.returncode != null && lastTask.returncode !== 0));
          state.trainingSummary = taskHistorySummary.generateTrainingSummary();
          if (lastTask && state.trainingSummary) {
            taskHistorySummary.saveTaskSummary(lastTask.id, state.trainingSummary);
            await taskHistorySummary.saveLocalTaskHistory();
          }
          state.trainingFailed = !!failed;
          if (!failed) showToast('' + _ico('check-circle') + ' 训练已完成');
          else showToast('' + _ico('x-circle') + ' 训练失败');
          if (state.activeModule === 'training') {
            renderView('training');
          }
        }

        updateJSONPreview();
        renderTaskStatus();
        syncFooterAction();
        if (state.activeModule === 'training') {
          const badge = document.getElementById('training-status-badge');
          if (badge) {
            const running = state.tasks.some((task) => task.status === 'RUNNING');
            if (running) badge.innerHTML = '<span style="color:#f59e0b;font-weight:700;">' + _ico('loader') + ' 训练中</span>';
            else if (state.trainingFailed) badge.innerHTML = '<span style="color:#ef4444;font-weight:700;">' + _ico('x-circle') + ' 训练失败</span>';
            else if (state.tasks.some((task) => task.status === 'FINISHED')) badge.innerHTML = '<span style="color:#22c55e;font-weight:700;">' + _ico('check-circle') + ' 已完成</span>';
            else badge.innerHTML = '<span style="color:var(--text-dim);">空闲</span>';
          }
          if (hasRunning) {
            startTrainingLogPolling();
            startSysMonitorPolling();
          }
        }
      } catch (error) {
        pollFailCount += 1;
        if (pollFailCount === 1) {
          console.warn('[TaskPoll] 后端不可达，轮询将自动降频重试。', error.message || '');
          state.backendOffline = true;
          renderTaskStatus();
          syncFooterAction();
        }
        if (pollFailCount >= 3) {
          const hadRunning = state.tasks.some((task) => task.status === 'RUNNING');
          state.tasks.forEach((task) => {
            if (task.status === 'RUNNING') task.status = 'TERMINATED';
          });
          if (hadRunning) {
            state.trainingFailed = true;
            syncFooterAction();
            if (state.activeModule === 'training') renderView('training');
          }
        }
      }

      const delay = pollFailCount > 0
        ? Math.min(BASE_INTERVAL * Math.pow(2, pollFailCount), MAX_INTERVAL)
        : BASE_INTERVAL;
      setTimeout(poll, delay);
    }

    setTimeout(poll, BASE_INTERVAL);
  }

  function setupBeforeUnloadTaskHistorySync() {
    window.addEventListener('beforeunload', () => {
      if (state._taskHistoryDirty) {
        const completed = state.tasks.filter((task) => task.status !== 'CREATED');
        if (completed.length > 0) {
          navigator.sendBeacon('/api/local/task_history', JSON.stringify({ tasks: completed }));
        }
      }
    });
  }

  return {
    loadBootstrapData,
    startTaskPolling,
    setupBeforeUnloadTaskHistorySync,
  };
}
