import { t } from './i18n.js';
import { api } from './api.js';
import { $, $$, escapeHtml, icon as _ico, showToast } from './utils/dom.js';
import { renderLogLines } from './utils/logRendering.js';
import {
  persistJsonPanelCollapsed,
  persistLayoutWidths,
  persistNavigatorCollapsed,
  readUiPreferences,
} from './utils/preferences.js';
import {
  appendTrainingMetrics,
  createEmptyTrainingMetrics,
} from './utils/trainingMetrics.js';
import { createAppShellController } from './features/appShell.js';
import { createBootstrapRuntimeController } from './features/bootstrapRuntime.js';
import { createBuiltinPickerController } from './features/builtinPicker.js';
import { createConfigActionsController } from './features/configActions.js';
import { createConfigRenderer } from './features/configRenderer.js';
import { createDatasetPageController } from './features/datasetPage.js';
import { createSamplesPanelController } from './features/samplesPanel.js';
import { createPluginCenterController } from './features/pluginCenterController.js';
import { createPickerRuntimeController } from './features/pickerRuntime.js';
import { createSavedConfigsController } from './features/savedConfigs.js';
import { renderSettingsPage } from './features/settingsPage.js';
import { renderAboutPage, renderGuidePage, renderLogsPage } from './features/staticPages.js';
import { createTaskHistorySummaryController } from './features/taskHistorySummary.js';
import { createToolsPageController } from './features/toolsPage.js';
import { createTopbarSearchController } from './features/topbarSearch.js';
import { createTrainingActionsController } from './features/trainingActions.js';
import { createTrainingPageController } from './features/trainingPage.js';
import { createWizardPageController } from './features/wizardPage.js';
import {
  pluginStore,
  loadPluginRuntime,
  loadPluginCapabilities,
  loadPluginHooks,
  loadPluginAudit,
  reloadAllPlugins,
  approvePlugin,
  revokePlugin,
  toggleDeveloperMode,
  renderSlot,
  getRegisteredSlots,
} from './pluginHost.js';
import {
  UI_TABS,
  SDXL_SECTIONS,
  TRAINING_TYPES,
  buildRunConfig,
  createDefaultConfig,
  getAvailableTabs,
  getFieldDefinition,
  getSectionsForTab,
  getSectionsForType,
  isFieldVisible,
  normalizeDraftValue,
} from './sdxlSchema.js';

const TOPBAR_TABS = UI_TABS.map((tab) => tab.key);
const BUILTIN_LEGACY_UI_PROFILE_ID = 'builtin-legacy';
const CONDITIONAL_KEYS = new Set([
  'v_parameterization',
  'save_state',
  'network_module',
  'lycoris_algo',
  'lr_scheduler',
  'optimizer_type',
  'enable_preview',
  'randomly_choice_prompt',
  'ema_enabled',
  'safeguard_enabled',
  'torch_compile',
  'enable_base_weight',
  'log_with',
  'lora_type',
  'enable_distributed_training',
  'sync_use_password_auth',
  'lulynx_experimental_core_enabled',
  'lulynx_safeguard_enabled',
  'lulynx_ema_enabled',
  'lulynx_resource_manager_enabled',
  'lulynx_block_weight_enabled',
  'lulynx_smart_rank_enabled',
  'lulynx_auto_controller_enabled',
  'lulynx_lisa_enabled',
  'lulynx_pcgrad_enabled',
  'lulynx_pause_enabled',
  'lulynx_prodigy_guard_enabled',
  'lulynx_advanced_stats_enabled',
  'enable_block_weights',
  'sdxl_low_vram_optimization',
  'sdxl_low_vram_fixed_block_swap',
  'enable_mixed_resolution_training',
  'adapter_type',
  'bucket_selection_mode',
  'peak_vram_control_enabled',
  'peak_vram_startup_guard_enabled',
  'peak_vram_micro_batch_enabled',
  'peak_vram_diagnostics_enabled',
  'peak_vram_auto_protection_enabled',
  'experimental_attention_profile_enabled',
  'flow_model',
  'flow_timestep_distribution',
  'flow_uniform_shift',
  'contrastive_flow_matching',
  'pissa_init',
  'enable_debug_options',
  'caption_tag_dropout_target_mode',
]);
const DRAFT_STORAGE_KEY = 'sd-rescripts:ui:sdxl-draft';
const uiPrefs = readUiPreferences();

const samplesPanel = createSamplesPanelController({ api, showToast });
const renderSamplesPanel = samplesPanel.renderSamplesPanel;
const refreshSampleImages = samplesPanel.refreshSampleImages;
samplesPanel.bindGlobals(window);
samplesPanel.bindKeyboardShortcuts(document);

let toolsPage;
let pickerRuntime;
let builtinPicker;
let savedConfigs;
let datasetPage;
let wizardPage;
let trainingPage;
let trainingActions;
let taskHistorySummary;
let topbarSearch;
let configActions;
let configRenderer;
let appShell;
let pluginCenter;
let bootstrapRuntime;

const state = {
  compactLayout: false,
  importInputBound: false,
  pickerInputBound: false,
  navigatorWidth: uiPrefs.navigatorWidth,
  jsonPanelWidth: uiPrefs.jsonPanelWidth,
  fieldUndo: {},
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
  jsonPanelCollapsed: uiPrefs.jsonPanelCollapsed,
  lang: 'zh',
  theme: uiPrefs.theme,
  roundedUI: uiPrefs.roundedUI,
  verticalTabs: uiPrefs.verticalTabs,
  activeModule: 'config',
  activeTab: uiPrefs.activeTab,
  navigatorCollapsed: uiPrefs.navigatorCollapsed,
  sections: {
    'training-types': true,
    'preset-list': true,
  },
  accentColor: uiPrefs.accentColor,
  activeTrainingType: uiPrefs.activeTrainingType,
  config: createDefaultConfig(uiPrefs.activeTrainingType),
  hasLocalDraft: false,
  presets: [],
  tasks: [],
  trainingFailed: false,
  taskSummaries: {},
  trainingSummary: null,
  trainingMetrics: createEmptyTrainingMetrics(),
  interrogators: null,
  runtime: null,
  preflight: null,
  datasetAnalysis: null,
  samplePrompt: null,
  runtimeError: '',
  lastMessage: '',
  backendOffline: false,
  sysMonitor: null,
  _taskHistoryDirty: false,
  _deletedTaskIds: new Set(),
  loading: {
    runtime: false,
    preflight: false,
    samplePrompt: false,
    run: false,
  },
};

appShell = createAppShellController({
  state,
  trainingTypes: TRAINING_TYPES,
  topbarTabs: TOPBAR_TABS,
  getAvailableTabs,
  getFieldDefinition,
  buildRunConfig,
  saveDraft,
  renderView,
  t,
});
appShell.bindGlobals(window);

const renderNavigator = (...args) => appShell.renderNavigator(...args);
const applyLayoutPreferences = (...args) => appShell.applyLayoutPreferences(...args);
const applyAndPersistLayout = (...args) => appShell.applyAndPersistLayout(...args);
const resetTransientState = (...args) => appShell.resetTransientState(...args);
const syncConfigState = (...args) => appShell.syncConfigState(...args);
const syncFooterAction = (...args) => appShell.syncFooterAction(...args);
const syncTopbarState = (...args) => appShell.syncTopbarState(...args);
const renderTaskStatus = (...args) => appShell.renderTaskStatus(...args);
const updateJSONPreview = (...args) => appShell.updateJSONPreview(...args);
const applyLanguage = (...args) => appShell.applyLanguage(...args);
const applyTheme = (...args) => appShell.applyTheme(...args);

toolsPage = createToolsPageController({
  api,
  state,
  renderSlot,
  renderLogLines,
  showToast,
});
toolsPage.bindGlobals(window);

pickerRuntime = createPickerRuntimeController({
  api,
  state,
  renderView,
  showToast,
  updateConfigValue: (key, value) => window.updateConfigValue(key, value),
});
pickerRuntime.bindGlobals(window);

builtinPicker = createBuiltinPickerController({
  api,
  state,
  renderView,
  showToast,
  updateConfigValue: (key, value) => window.updateConfigValue(key, value),
});
builtinPicker.bindGlobals(window);

savedConfigs = createSavedConfigsController({
  api,
  state,
  trainingTypes: TRAINING_TYPES,
  createDefaultConfig,
  mergeConfigPatch,
  resetTransientState,
  saveDraft,
  renderView,
  renderNavigator,
  showToast,
  closeBuiltinPicker: () => window.closeBuiltinPicker(),
});
savedConfigs.bindGlobals(window);

datasetPage = createDatasetPageController({
  api,
  state,
  renderView,
  showToast,
});
datasetPage.bindGlobals(window);

wizardPage = createWizardPageController({
  state,
  renderView,
  updateConfigValue: (key, value) => window.updateConfigValue(key, value),
  executeTraining: () => trainingActions.executeTraining(),
});
wizardPage.bindGlobals(window);

taskHistorySummary = createTaskHistorySummaryController({
  api,
  state,
  renderView,
});
taskHistorySummary.bindGlobals(window);

configRenderer = createConfigRenderer({
  state,
  trainingTypes: TRAINING_TYPES,
  getSectionsForTab,
  isFieldVisible,
  canUseBuiltinPicker,
  renderSlot,
  renderNavigator,
  syncTopbarState,
  syncFooterAction,
  updateJSONPreview,
});
configRenderer.bindGlobals(window);

trainingPage = createTrainingPageController({
  api,
  state,
  renderView,
  renderSlot,
  buildRunConfig,
  renderSamplesPanel,
  refreshSampleImages,
  renderTrainingSummaryHTML: () => taskHistorySummary.renderTrainingSummaryHTML(),
  renderSummaryCard: (summary) => taskHistorySummary.renderSummaryCard(summary),
  collectTrainingMetrics,
  resetTrainingMetrics,
  syncFooterAction,
  showToast,
});
trainingPage.bindGlobals(window);

trainingActions = createTrainingActionsController({
  api,
  state,
  trainingTypes: TRAINING_TYPES,
  buildRunConfig,
  renderView,
  updateJSONPreview,
  syncFooterAction,
  resetTrainingMetrics,
  loadLocalTaskHistory: () => taskHistorySummary.loadLocalTaskHistory(),
  saveLocalTaskHistory: () => taskHistorySummary.saveLocalTaskHistory(),
  mergeTaskHistory: (backendTasks, localHistory, currentTasks) => taskHistorySummary.mergeTaskHistory(backendTasks, localHistory, currentTasks),
  renderTaskStatus,
  startTrainingLogPolling: () => trainingPage.startTrainingLogPolling(),
  startSysMonitorPolling: () => trainingPage.startSysMonitorPolling(),
  showToast,
});
trainingActions.bindGlobals(window);

topbarSearch = createTopbarSearchController({
  state,
  uiTabs: UI_TABS,
  getSectionsForType,
  renderView,
});
topbarSearch.bindGlobals(window);

configActions = createConfigActionsController({
  state,
  api,
  conditionalKeys: CONDITIONAL_KEYS,
  draftStorageKey: DRAFT_STORAGE_KEY,
  buildRunConfig,
  createDefaultConfig,
  getFieldDefinition,
  normalizeDraftValue,
  mergeConfigPatch,
  resetTransientState,
  saveDraft,
  renderView,
  syncConfigState,
  updateJSONPreview,
  applyAndPersistLayout,
  applyLayoutPreferences,
  showToast,
});
configActions.bindGlobals(window);

pluginCenter = createPluginCenterController({
  pluginStore,
  loadPluginRuntime,
  loadPluginAudit,
  reloadAllPlugins,
  approvePlugin,
  revokePlugin,
  toggleDeveloperMode,
  getRegisteredSlots,
  showToast,
});
pluginCenter.bindGlobals(window);

bootstrapRuntime = createBootstrapRuntimeController({
  api,
  state,
  mergeConfigPatch,
  saveDraft,
  taskHistorySummary,
  renderView,
  updateJSONPreview,
  renderTaskStatus,
  syncFooterAction,
  startTrainingLogPolling: () => trainingPage.startTrainingLogPolling(),
  startSysMonitorPolling: () => trainingPage.startSysMonitorPolling(),
  showToast,
});

function init() {
  loadDraft();
  appShell.applyTheme();
  appShell.applyLanguage();
  appShell.setupSidebar();
  appShell.setupTopbar();
  appShell.setupNavigator();
  appShell.applyLayoutPreferences();
  builtinPicker.setupNativePicker();
  configActions.setupFieldMenus();
  configActions.setupImportConfig();
  appShell.setupJsonPanel();
  bootstrapRuntime.loadBootstrapData().then(function() {
    renderView(state.activeModule);
  });
  taskHistorySummary.loadTaskSummariesFromCache();
  renderView(state.activeModule);
  bootstrapRuntime.startTaskPolling();
  topbarSearch.setupTopbarSearch();
  bootstrapRuntime.setupBeforeUnloadTaskHistorySync();
}

function loadDraft() {
  const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!rawDraft) {
    return;
  }

  try {
    const parsed = JSON.parse(rawDraft);
    if (!parsed || typeof parsed !== 'object') {
      return;
    }
    mergeConfigPatch(parsed);
    state.hasLocalDraft = true;
  } catch (error) {
    console.warn('Failed to read local draft:', error);
  }
}

function saveDraft() {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.config));
}

function mergeConfigPatch(patch) {
  if (!patch || typeof patch !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(patch)) {
    const field = getFieldDefinition(key);
    if (!field) {
      continue;
    }
    state.config[key] = normalizeDraftValue(field, value);
  }
}

function canUseBuiltinPicker(field) {
  if (!field) {
    return false;
  }
  // 有 pickerType 的字段都有内置选择器按钮
  if (field.pickerType) {
    return true;
  }
  // file/folder 类型字段也支持
  return field.type === 'file' || field.type === 'folder';
}



function renderView(module) {
  const container = $('.content-area');
  if (container) {
    container.classList.toggle('train-fullbleed', module === 'training');
  }
  if (!container) {
    return;
  }
  applyLayoutPreferences();
  syncFooterAction();

  if (module === 'config') {
    configRenderer.renderConfig(container);
    return;
  }

  if (module === 'settings') {
    renderSettingsPage(container, {
      state,
      t,
      renderSlot,
      applyTheme,
      updateLayoutWidth,
      applyAndPersistLayout,
      renderView,
      activateUiProfile: api.activateUiProfile.bind(api),
      showToast,
      builtinLegacyUiProfileId: BUILTIN_LEGACY_UI_PROFILE_ID,
    });
    return;
  }
  if (module === 'logs') {
    renderLogsPage(container);
    return;
  }
  if (module === 'tools') {
    toolsPage.renderToolsPage(container);
    return;
  }
  if (module === 'dataset') {
    datasetPage.renderDataset(container);
    return;
  }
  if (module === 'about') {
    renderAboutPage(container);
    return;
  }
  if (module === 'guide') {
    renderGuidePage(container);
    return;
  }
  if (module === 'wizard') {
    wizardPage.renderWizard(container);
    return;
  }
  if (module === 'plugins') {
    pluginCenter.renderPlugins(container);
    return;
  }
  if (module === 'training') {
    trainingPage.renderTraining(container);
    return;
  }

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>${escapeHtml(module.toUpperCase())}</h2>
        <p>这个模块暂未接入真实功能，目前先集中完善 SDXL 训练页。</p>
      </header>
      <div class="empty-state">
        <strong>开发中</strong>
        <span>当前原型保留了导航结构，但主要开发集中在 SDXL LoRA 参数页。</span>
      </div>
    </div>
  `;
}


/* ── Training Metrics Collection & Analysis ── */

/** Incrementally collect speed/loss/epoch from latest poll lines */
function collectTrainingMetrics(lines) {
  appendTrainingMetrics(state.trainingMetrics, lines);
}

function resetTrainingMetrics() {
  state.trainingMetrics = createEmptyTrainingMetrics();
  trainingPage?.resetTrainingLogCursor?.();
  state.trainingSummary = null;
}







document.addEventListener('DOMContentLoaded', init);
