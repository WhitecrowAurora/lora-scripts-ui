import { readUiPreferences, loadDeletedTaskIds } from './storage.js';
import { VISIBLE_TRAINING_TYPES } from '../trainingTypeRegistry.js';
import { createTrainingVramProfileUiState } from './trainingVramProfile.js';

const DEFAULT_TRAINING_TYPE = 'sdxl-lora';

function normalizeActiveTrainingType(typeId) {
  const candidate = String(typeId || '').trim();
  return VISIBLE_TRAINING_TYPES.some((type) => type.id === candidate && !type.disabled) ? candidate : DEFAULT_TRAINING_TYPE;
}

function loadTrainingAdvisorPosition() {
  try {
    const parsed = JSON.parse(localStorage.getItem('sd-rescripts:training-advisor-position') || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch (_e) {
    return null;
  }
}

export function createInitialAppState({ createDefaultConfig }) {
  const uiPreferences = readUiPreferences();
  const activeTrainingType = normalizeActiveTrainingType(uiPreferences.activeTrainingType);
  return {
    compactLayout: false,
    importInputBound: false,
    pickerInputBound: false,
    navigatorWidth: uiPreferences.navigatorWidth,
    jsonPanelWidth: uiPreferences.jsonPanelWidth,
    fieldUndo: {},
    trainingIntentExplicitFields: {},
    trainingVramProfileUi: createTrainingVramProfileUiState(),
    activeFieldMenu: null,
    datasetSubTab: 'tagger',
    trainSubTab: 'monitor',
    selectedTool: '',
    builtinPicker: {
      open: false,
      fieldKey: '',
      pickerType: '',
      rootLabel: '',
      items: [],
    },
    layoutDefaults: {
      compactLayout: false,
      navigatorWidth: 240,
      jsonPanelWidth: 280,
    },
    jsonPanelCollapsed: uiPreferences.jsonPanelCollapsed,
    lang: 'zh',
    theme: uiPreferences.theme,
    roundedUI: uiPreferences.roundedUI,
    verticalTabs: uiPreferences.verticalTabs,
    configWaterfall: localStorage.getItem('sd-rescripts:config-waterfall') === 'true',
    trainingAdvisorCollapsed: localStorage.getItem('sd-rescripts:training-advisor-collapsed') === 'true',
    trainingAdvisorPosition: loadTrainingAdvisorPosition(),
    activeModule: 'config',
    activeTab: uiPreferences.activeTab,
    navigatorCollapsed: uiPreferences.navigatorCollapsed,
    sections: {
      'training-types': true,
      'preset-list': true,
    },
    accentColor: localStorage.getItem('accentColor') || null,
    activeTrainingType,
    config: createDefaultConfig(activeTrainingType),
    hasLocalDraft: false,
    trainingWorkspace: {
      revision: 0,
      active_project_id: '',
      active_version_id: '',
      projects: [],
      active_config: null,
    },
    presets: [],
    tasks: [],
    trainingQueue: {
      revision: 0,
      current_run_id: '',
      queued_runs: [],
      queue_depth: 0,
    },
    trainingFailed: false,
    taskSummaries: {},
    trainingSummary: null,
    trainingLogSnapshot: {
      taskId: '',
      html: '',
      updatedAt: 0,
    },
    trainingObservability: {
      taskId: '',
      generation: 0,
      cursor: null,
      logState: 'idle',
      previewState: 'idle',
      previews: [],
      resynced: false,
      error: '',
    },
    activeTrainingTaskId: '',
    // When true, activeTrainingTaskId auto-follows newest running/queued task.
    trainingLogFollowLatest: true,
    trainingMetrics: {
      speeds: [],
      losses: [],
      epochs: [],
      startTime: null,
      lastStep: 0,
      totalSteps: 0,
    },
    interrogators: null,
    executionProfiles: null,  // null=还没拉到;[] 才是「拉到了但一个都没有」
    runtime: null,
    preflight: null,
    pcieTransferBenchmark: null,
    datasetAnalysis: null,
    samplePrompt: null,
    runtimeError: '',
    pcieTransferBenchmarkError: '',
    lastMessage: '',
    backendOffline: false,
    sysMonitor: null,
    _taskHistoryDirty: false,
    _deletedTaskIds: loadDeletedTaskIds(),
    loading: {
      runtime: false,
      preflight: false,
      pcieTransferBenchmark: false,
      samplePrompt: false,
      run: false,
    },
  };
}
