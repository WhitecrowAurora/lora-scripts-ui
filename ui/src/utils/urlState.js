import { TRAINING_TYPES, UI_TABS } from '../trainingTypeRegistry.js';

const MODULES = new Set([
  'config', 'training', 'settings', 'logs', 'tools', 'dataset', 'about',
  'guide', 'wizard', 'plugins', 'turbocore', 'resources',
]);
const TABS = new Set(UI_TABS.map((item) => item.key));
const TRAINING_TYPE_IDS = new Set(TRAINING_TYPES.map((item) => item.id));

function text(value, max = 128) {
  return String(value || '').trim().slice(0, max);
}

export function readUiUrlState(location = globalThis.location) {
  const params = new URLSearchParams(location?.search || '');
  const module = text(params.get('module'), 32);
  const tab = text(params.get('tab'), 64);
  const trainingType = text(params.get('training_type'), 96);
  return {
    module: MODULES.has(module) ? module : '',
    tab: TABS.has(tab) ? tab : '',
    trainingType: TRAINING_TYPE_IDS.has(trainingType) ? trainingType : '',
    task: text(params.get('task'), 128),
  };
}

export function writeUiUrlState(state, { replace = true, location = globalThis.location, history = globalThis.history } = {}) {
  if (!location || !history) return;
  const url = new URL(location.href || '/', location.href || undefined);
  const setOrDelete = (key, value) => {
    const normalized = text(value);
    if (normalized) url.searchParams.set(key, normalized);
    else url.searchParams.delete(key);
  };
  setOrDelete('module', MODULES.has(state?.activeModule) ? state.activeModule : '');
  setOrDelete('tab', TABS.has(state?.activeTab) ? state.activeTab : '');
  setOrDelete('training_type', TRAINING_TYPE_IDS.has(state?.activeTrainingType) ? state.activeTrainingType : '');
  setOrDelete('task', state?.activeTrainingTaskId);
  const method = replace ? 'replaceState' : 'pushState';
  history[method]?.({ ui: true }, '', url.href);
}

export function applyUiUrlState(state, urlState = readUiUrlState()) {
  if (!state || !urlState) return state;
  if (urlState.module) state.activeModule = urlState.module;
  if (urlState.tab) state.activeTab = urlState.tab;
  if (urlState.trainingType) state.activeTrainingType = urlState.trainingType;
  if (urlState.task) {
    state.activeTrainingTaskId = urlState.task;
    state.trainingLogFollowLatest = false;
  }
  return state;
}

export function isAllowedModule(module) {
  return MODULES.has(String(module || '').trim());
}
