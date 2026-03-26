import { t } from './i18n.js';
import { api } from './api.js';
import {
  UI_TABS,
  SDXL_SECTIONS,
  buildRunConfig,
  createDefaultConfig,
  getFieldDefinition,
  getSectionsForTab,
  isFieldVisible,
  normalizeDraftValue,
} from './sdxlSchema.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const TOPBAR_TABS = UI_TABS.map((tab) => tab.key);
const CONDITIONAL_KEYS = new Set([
  'v_parameterization',
  'save_state',
  'network_module',
  'lycoris_algo',
  'lr_scheduler',
  'optimizer_type',
  'enable_preview',
  'randomly_choice_prompt',
]);
const DRAFT_STORAGE_KEY = 'sd-rescripts:ui:sdxl-draft';

const state = {
  compactLayout: false,
  importInputBound: false,
  pickerInputBound: false,
  navigatorWidth: Number(localStorage.getItem('sd-rescripts:ui:navigator-width') || 240),
  jsonPanelWidth: Number(localStorage.getItem('sd-rescripts:ui:json-width') || 280),
  fieldUndo: {},
  activeFieldMenu: null,
  datasetSubTab: 'tagger',
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
  jsonPanelCollapsed: false,
  lang: 'zh',
  theme: localStorage.getItem('theme') || 'dark',
  activeModule: 'config',
  activeTab: localStorage.getItem('sdxl_ui_tab') || 'model',
  navigatorCollapsed: false,
  sections: {
    'training-types': true,
    'preset-list': true,
  },
  accentColor: localStorage.getItem('accentColor') || null,
  config: createDefaultConfig(),
  hasLocalDraft: false,
  presets: [],
  tasks: [],
  runtime: null,
  preflight: null,
  samplePrompt: null,
  runtimeError: '',
  lastMessage: '',
  loading: {
    runtime: false,
    preflight: false,
    samplePrompt: false,
    run: false,
  },
};

function init() {
  loadDraft();
  applyTheme();
  applyLanguage();
  setupSidebar();
  setupTopbar();
  setupNavigator();
  applyLayoutPreferences();
  setupNativePicker();
  setupFieldMenus();
  setupImportConfig();
  setupJsonPanel();
  renderView(state.activeModule);
  loadBootstrapData();
  startTaskPolling();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message, duration = 2500) {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  }, duration);
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
  if (field.pickerType === 'model-file' || field.pickerType === 'output-folder') {
    return true;
  }
  return ['train_data_dir', 'reg_data_dir', 'resume'].includes(field.key);
}

async function loadBootstrapData() {
  state.loading.runtime = true;
  updateJSONPreview();

  const [runtimeResult, presetsResult, savedParamsResult, tasksResult] = await Promise.allSettled([
    api.getGraphicCards(),
    api.getPresets(),
    api.getSavedParams(),
    api.getTasks(),
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
    state.tasks = tasksResult.value?.data?.tasks || [];
  }

  state.loading.runtime = false;
  if (state.activeModule === 'config') {
    renderView('config');
  } else {
    updateJSONPreview();
  }
}

function startTaskPolling() {
  window.sttInterval(async () => {
    try {
      const response = await api.getTasks();
      state.tasks = response?.data?.tasks || [];
      updateJSONPreview();
      renderTaskStatus();
    } catch (error) {
      console.warn('Task polling failed:', error);
    }
  }, 3000);
}

function renderView(module) {
  const container = $('.content-area');
  if (!container) {
    return;
  }
  applyLayoutPreferences();

  if (module === 'config') {
    renderConfig(container);
    return;
  }

  if (module === 'settings') {
    renderSettings(container);
    return;
  }
  if (module === 'logs') {
    renderLogs(container);
    return;
  }
  if (module === 'tools') {
    renderTools(container);
    return;
  }
  if (module === 'dataset') {
    renderDataset(container);
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

function renderConfig(container) {
  const sections = getSectionsForTab(state.activeTab);
  const visibleSections = sections.filter((section) =>
    section.fields.some((field) => field.type !== 'hidden' && isFieldVisible(field, state.config))
  );

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>SDXL LoRA 模式</h2>
        <p></p>
      </header>
      <div class="status-deck" id="status-deck">${renderStatusDeck()}</div>
      <div class="section-toolbar">
        <div class="toolbar-actions toolbar-check-actions">
          <button class="btn btn-outline btn-check" type="button" onclick="runPreflight()">
            <span class="btn-check-label">训练预检</span>
            <span class="btn-check-desc">检查数据集路径、底模路径等参数是否可用</span>
          </button>
          <button class="btn btn-outline btn-check" type="button" onclick="runSelfCheck()">
            <span class="btn-check-label">环境自检</span>
            <span class="btn-check-desc">检测 GPU、Torch、依赖库等运行环境</span>
          </button>
        </div>
      </div>
      ${visibleSections.map(renderSection).join('')}
    </div>
  `;

  renderNavigator();
  syncTopbarState();
  syncFooterAction();
  updateJSONPreview();
}

function renderSection(section) {
  const fields = section.fields.filter((field) => field.type !== 'hidden' && isFieldVisible(field, state.config));

  return `
    <section class="form-section" id="${escapeHtml(section.id)}">
      <header class="section-header">
        <h3>${escapeHtml(section.title)}</h3>
        <span class="section-meta">${fields.length} 项参数</span>
      </header>
      <div class="section-summary">${escapeHtml(section.description)}</div>
      <div class="section-content">
        ${fields.map((field) => renderField(field)).join('')}
      </div>
    </section>
  `;
}

function renderField(field) {
  const value = state.config[field.key];
  const label = field.label;
  const defaultValue = field.defaultValue ?? '';
  const isPicker = field.type === 'file' || field.type === 'folder';
  const showBuiltinPicker = canUseBuiltinPicker(field);
  const canUndo = Object.hasOwn(state.fieldUndo, field.key);
  const canReset = String(value ?? '') !== String(defaultValue ?? '');
  const pickerMode = field.pickerType || field.type;
  const builtinPickerIcon = (pickerMode === 'folder' || pickerMode === 'output-folder') ? '#icon-folder' : '#icon-file';
  const renderHeader = () => `
    <div class="field-header-row">
      <label>${escapeHtml(label)}</label>
      <div class="field-inline-actions" data-field-key="${field.key}">
        <button class="field-menu-toggle" type="button" title="参数更多操作" data-field-menu-key="${field.key}">···</button>
        ${showBuiltinPicker ? `<button class="picker-mode-icon-btn" type="button" title="内置文件选择器" onclick="openNativePicker('${field.key}', '${pickerMode}')"><svg class="icon"><use href="${builtinPickerIcon}"></use></svg></button>` : ''}
      </div>
    </div>
  `;

  if (field.type === 'boolean') {
    return `
      <div class="config-group row boolean-card">
        <div class="label-col">
          ${renderHeader()}
          <p class="field-desc">${escapeHtml(field.desc || '')}</p>
        </div>
        <label class="switch switch-compact">
          <input type="checkbox" ${value ? 'checked' : ''} onchange="updateConfigValue('${field.key}', this.checked)">
          <span class="slider round"></span>
        </label>
      </div>
    `;
  }

  if (field.type === 'select') {
    return `
      <div class="config-group">
        ${renderHeader()}
        <p class="field-desc">${escapeHtml(field.desc || '')}</p>
        <select onchange="updateConfigValue('${field.key}', this.value)">
          ${field.options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option || '默认')}</option>`).join('')}
        </select>
      </div>
    `;
  }

  if (field.type === 'textarea') {
    return `
      <div class="config-group">
        ${renderHeader()}
        <p class="field-desc">${escapeHtml(field.desc || '')}</p>
        <textarea class="text-area" oninput="updateConfigValue('${field.key}', this.value)">${escapeHtml(value || '')}</textarea>
      </div>
    `;
  }

  const inputType = field.type === 'number' || field.type === 'slider' ? 'number' : 'text';
  const inputValue = value === undefined || value === null ? '' : value;

  if (isPicker) {
    return `
      <div class="config-group">
        ${renderHeader()}
        <p class="field-desc">${escapeHtml(field.desc || '')}</p>
        <div class="input-picker">
          <button class="picker-icon" type="button" onclick="pickPath('${field.key}', '${field.pickerType || 'folder'}')">
            <svg class="icon"><use href="#icon-folder"></use></svg>
          </button>
          <input type="text" value="${escapeHtml(inputValue)}" oninput="updateConfigValue('${field.key}', this.value)">
        </div>
      </div>
    `;
  }

  return `
    <div class="config-group">
      ${renderHeader()}
      <p class="field-desc">${escapeHtml(field.desc || '')}</p>
      <input class="text-input" type="${inputType}" value="${escapeHtml(inputValue)}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : ''} oninput="updateConfigValue('${field.key}', this.value)">
    </div>
  `;
}

function renderGpuInfo() {
  if (state.runtimeError) return state.runtimeError;
  if (!state.runtime?.cards?.length) return '等待检测显卡信息';
  return state.runtime.cards.map((card) => {
    if (typeof card === 'string') return card;
    return card.name || JSON.stringify(card);
  }).join('，');
}

function renderPreflightDetail() {
  if (!state.preflight) return '在训练前建议运行一遍训练预检';
  if (state.preflight.can_start) {
    const w = state.preflight.warnings || [];
    return w.length ? `${w.length} 个警告：${w[0]}` : '全部通过，可以启动训练';
  }
  const errors = state.preflight.errors || [];
  if (!errors.length) return '训练预检未通过';
  return errors.map((e, i) => `[${i + 1}] ${e}`).join('；');
}

function renderStatusDeck() {
  const runtimeLabel = state.runtimeError
    ? '离线'
    : state.loading.runtime
      ? '检测中...'
    : state.runtime?.cards?.length
      ? `${state.runtime.cards.length} 张显卡`
      : '检测中';
  const xformersLabel = state.runtime?.xformers?.installed
    ? `${state.runtime.xformers.version || '已安装'}`
    : '未安装';
  const preflightLabel = state.preflight
    ? state.preflight.can_start
      ? '可以启动'
      : `${state.preflight.errors.length} 个错误`
    : '未检查';
  const taskCount = state.tasks.filter((task) => task.status === 'RUNNING').length;

  return `
    <div class="status-card">
      <span class="status-label">运行环境</span>
      <strong class="status-value">${escapeHtml(runtimeLabel)}</strong>
      <span class="status-sub">${escapeHtml(renderGpuInfo())}</span>
    </div>
    <div class="status-card">
      <span class="status-label">xFormers</span>
      <strong class="status-value">${escapeHtml(xformersLabel)}</strong>
      <span class="status-sub">${escapeHtml(state.runtime?.xformers?.reason || '暂无状态信息')}</span>
    </div>
    <div class="status-card">
      <span class="status-label">训练预检</span>
      <strong class="status-value">${escapeHtml(preflightLabel)}</strong>
      <span class="status-sub">${escapeHtml(renderPreflightDetail())}</span>
    </div>
    <div class="status-card" id="task-status-card">
      <span class="status-label">任务</span>
      <strong class="status-value">${taskCount}</strong>
      <span class="status-sub">${taskCount > 0 ? `有 ${taskCount} 个任务运行中` : '空闲'}</span>
    </div>
  `;
}

function renderNavigator() {
  const trainingTypeList = $('#section-training-types .group-list');
  if (trainingTypeList) {
    trainingTypeList.innerHTML = `
      <li class="active">SDXL</li>
      <li class="disabled">SD1.5</li>
      <li class="disabled">FLUX</li>
      <li class="disabled">SD3.5</li>
    `;
  }

  const presetSection = $('#section-preset-list .section-content');
  if (presetSection) {
    presetSection.innerHTML = `
      <div class="preset-actions-grid">
        <button class="btn btn-outline btn-sm" type="button" onclick="resetAllParams()">重置所有参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="saveCurrentParams()">保存参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="loadSavedParams()">读取参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="downloadConfigFile()">导出配置文件</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="importConfigFile()">导入配置文件</button>
      </div>
    `;
  }
}

function applyLayoutPreferences() {
  const showConfigChrome = state.activeModule === 'config';
  document.body.classList.toggle('show-config-chrome', showConfigChrome);
  document.documentElement.style.setProperty('--navigator-width', `${state.navigatorWidth}px`);
  document.documentElement.style.setProperty('--json-panel-width', `${state.jsonPanelWidth}px`);

  const navigator = $('#navigator');
  const expandBtn = $('#navigator-expand-btn');
  if (!showConfigChrome) {
    navigator?.classList.remove('collapsed');
    if (expandBtn) {
      expandBtn.style.display = 'none';
    }
  }
}

function applyAndPersistLayout() {
  localStorage.setItem('sd-rescripts:ui:navigator-width', String(state.navigatorWidth));
  localStorage.setItem('sd-rescripts:ui:json-width', String(state.jsonPanelWidth));
  applyLayoutPreferences();
}

function resetTransientState() {
  state.preflight = null;
  state.samplePrompt = null;
  state.lastMessage = '';
}

function syncConfigState() {
  saveDraft();
  updateJSONPreview();
}

function getPresetLabel(preset, index) {
  if (preset?.name) {
    return preset.name;
  }
  if (preset?.output_name) {
    return preset.output_name;
  }
  return `预设 ${index + 1}`;
}

function syncFooterAction() {
  const bar = $('.bottom-bar');
  if (!bar) {
    return;
  }
  const hasRunningTask = state.tasks.some((task) => task.status === 'RUNNING');
  bar.innerHTML = `
    <button class="btn btn-primary btn-execute" onclick="executeTraining()" ${state.loading.run ? 'disabled' : ''}>
      <span class="btn-main">${state.loading.run ? '正在启动训练...' : '开始训练'}</span>
    </button>
    ${hasRunningTask ? `
      <button class="btn btn-danger btn-terminate" onclick="terminateAllTasks()">
        <span class="btn-main">终止训练</span>
      </button>
    ` : ''}
  `;
}

function syncTopbarState() {
  if (state.activeFieldMenu) {
    state.activeFieldMenu = null;
  }
  applyLayoutPreferences();
  $$('.top-nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.tab === state.activeTab);
  });
}

function renderTaskStatus() {
  const taskCard = $('#task-status-card .status-value');
  const taskSub = $('#task-status-card .status-sub');
  if (!taskCard || !taskSub) {
    return;
  }
  const running = state.tasks.filter((task) => task.status === 'RUNNING');
  taskCard.textContent = String(running.length);
  taskSub.textContent = running.length > 0 ? `有 ${running.length} 个任务运行中` : '空闲';
}

function setupJsonPanel() {
  const panel = $('.json-panel');
  const toggleBtn = $('#json-panel-toggle');
  const toggleIcon = $('#json-panel-toggle use');
  if (!panel || !toggleBtn || !toggleIcon) {
    return;
  }

  const applyPanelState = () => {
    panel.classList.toggle('collapsed', state.jsonPanelCollapsed);
    toggleBtn.title = state.jsonPanelCollapsed ? '展开参数预览' : '收起参数预览';
    toggleIcon.setAttribute('href', state.jsonPanelCollapsed ? '#icon-chevron-left' : '#icon-chevron-right');
  };

  toggleBtn.addEventListener('click', () => {
    state.jsonPanelCollapsed = !state.jsonPanelCollapsed;
    applyPanelState();
  });

  applyPanelState();
}

function setupSidebar() {
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const module = item.dataset.module;
      if (!module) {
        return;
      }
      $$('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
      item.classList.add('active');
      state.activeModule = module;
      renderView(module);
    });
  });

  $('#theme-toggle')?.addEventListener('click', toggleTheme);
}

function setupTopbar() {
  $$('.top-nav-item').forEach((item, index) => {
    const tabKey = TOPBAR_TABS[index];
    if (!tabKey) {
      item.style.display = 'none';
      return;
    }
    item.dataset.tab = tabKey;
    item.addEventListener('click', (event) => {
      event.preventDefault();
      state.activeTab = tabKey;
      localStorage.setItem('sdxl_ui_tab', tabKey);
      if (state.activeModule === 'config') {
        renderView('config');
      } else {
        syncTopbarState();
      }
    });
  });
  syncTopbarState();
}

function setupNavigator() {
  const nav = $('#navigator');
  const collapseBtn = $('#navigator-collapse-btn');
  const expandBtn = $('#navigator-expand-btn');

  const updateNavUI = () => {
    if (state.activeModule !== 'config') {
      return;
    }
    nav?.classList.toggle('collapsed', state.navigatorCollapsed);
    if (expandBtn) {
      expandBtn.style.display = state.navigatorCollapsed ? 'flex' : 'none';
    }
  };

  collapseBtn?.addEventListener('click', () => {
    state.navigatorCollapsed = true;
    updateNavUI();
  });
  expandBtn?.addEventListener('click', () => {
    state.navigatorCollapsed = false;
    updateNavUI();
  });
  updateNavUI();

  $$('.nav-section .section-header').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest('.nav-section');
      if (!section) {
        return;
      }
      const sectionId = section.id.replace('section-', '');
      state.sections[sectionId] = !state.sections[sectionId];
      section.classList.toggle('collapsed', !state.sections[sectionId]);
    });
  });
}
function updateJSONPreview() {
  const jsonViewer = $('#json-viewer code');
  if (!jsonViewer) {
    return;
  }

  const payload = buildRunConfig(state.config);
  jsonViewer.textContent = JSON.stringify(payload, null, 2);
}

function applyLanguage() {
  $$('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(key, state.lang);
  });
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('lang', lang);
  applyLanguage();
  renderView(state.activeModule);
}

function applyTheme() {
  document.documentElement.classList.toggle('light-theme', state.theme === 'light');
  const moonIcon = $('.moon-icon');
  const sunIcon = $('.sun-icon');
  if (moonIcon && sunIcon) {
    moonIcon.style.display = state.theme === 'dark' ? 'block' : 'none';
    sunIcon.style.display = state.theme === 'light' ? 'block' : 'none';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', state.theme);
  applyTheme();
}

function renderSettings(container) {
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>${t('settings.title', state.lang)}</h2>
        <p>这里统一控制界面布局，适配不同分辨率。点击重置即可恢复默认布局。</p>
      </header>
      <div class="settings-row">
        <label>${t('settings.theme', state.lang)}</label>
        <select id="theme-select">
          <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>${t('settings.dark', state.lang)}</option>
          <option value="light" ${state.theme === 'light' ? 'selected' : ''}>${t('settings.light', state.lang)}</option>
        </select>
      </div>
      <div class="settings-row settings-slider-row">
        <label>左侧资源管理器宽度</label>
        <div class="settings-slider-control">
          <input type="range" id="navigator-width-slider" min="180" max="420" step="10" value="${state.navigatorWidth}">
          <strong id="navigator-width-value">${state.navigatorWidth}px</strong>
        </div>
      </div>
      <div class="settings-row settings-slider-row">
        <label>右侧参数预览宽度</label>
        <div class="settings-slider-control">
          <input type="range" id="json-width-slider" min="220" max="460" step="10" value="${state.jsonPanelWidth}">
          <strong id="json-width-value">${state.jsonPanelWidth}px</strong>
        </div>
      </div>
      <div class="settings-row">
        <label>布局重置</label>
        <button class="btn btn-outline btn-sm" type="button" id="reset-layout-btn">恢复默认</button>
      </div>
    </div>
  `;

  $('#theme-select')?.addEventListener('change', (event) => {
    state.theme = event.target.value;
    localStorage.setItem('theme', state.theme);
    applyTheme();
  });
  $('#navigator-width-slider')?.addEventListener('input', (event) => updateLayoutWidth('navigator', event.target.value, false));
  $('#navigator-width-slider')?.addEventListener('change', (event) => updateLayoutWidth('navigator', event.target.value, true));
  $('#json-width-slider')?.addEventListener('input', (event) => updateLayoutWidth('json', event.target.value, false));
  $('#json-width-slider')?.addEventListener('change', (event) => updateLayoutWidth('json', event.target.value, true));
  $('#reset-layout-btn')?.addEventListener('click', () => {
    state.navigatorWidth = state.layoutDefaults.navigatorWidth;
    state.jsonPanelWidth = state.layoutDefaults.jsonPanelWidth;
    applyAndPersistLayout();
    renderView('settings');
  });
}

function renderDataset(container) {
  const activeTab = state.datasetSubTab || 'tagger';
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>数据集处理</h2>
        <p>图片标注、标签编辑与图像预处理。</p>
      </header>
      <div class="dataset-tabs">
        <button class="dataset-tab ${activeTab === 'tagger' ? 'active' : ''}" type="button" onclick="switchDatasetTab('tagger')">标签器</button>
        <button class="dataset-tab ${activeTab === 'editor' ? 'active' : ''}" type="button" onclick="switchDatasetTab('editor')">标签编辑器</button>
        <button class="dataset-tab ${activeTab === 'resize' ? 'active' : ''}" type="button" onclick="switchDatasetTab('resize')">图像预处理</button>
      </div>
      <div id="dataset-content"></div>
    </div>
  `;
  if (activeTab === 'tagger') {
    renderTagger();
  } else if (activeTab === 'editor') {
    renderTagEditor();
  } else {
    renderImageResize();
  }
}

window.switchDatasetTab = (tab) => {
  state.datasetSubTab = tab;
  if (state.activeModule === 'dataset') renderView('dataset');
};

function renderTagger() {
  const content = $('#dataset-content');
  if (!content) return;

  const models = [
    'wd14-convnextv2-v2', 'wd-convnext-v3', 'wd-swinv2-v3', 'wd-vit-v3',
    'wd14-swinv2-v2', 'wd14-vit-v2', 'wd14-moat-v2',
    'wd-eva02-large-tagger-v3', 'wd-vit-large-tagger-v3',
    'cl-tagger-1.00', 'cl-tagger-1.01', 'cl-tagger-1.02',
  ];
  const conflicts = ['ignore', 'copy', 'prepend', 'append'];
  const conflictLabels = { ignore: '跳过已有', copy: '覆盖', prepend: '前置追加', append: '后置追加' };

  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>WD14 / CL 标签器</h3></header>
      <div class="section-summary">对训练数据集进行自动标注，为每张图片生成 .txt 标签文件。</div>
      <div class="section-content tool-fields">
        <div class="config-group">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="openNativePicker('tagger-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="tagger-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>标注模型</label>
          <select id="tagger-model">
            ${models.map((m) => `<option value="${m}" ${m === 'wd14-convnextv2-v2' ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="config-group">
          <label>置信度阈值</label>
          <input class="text-input" type="number" id="tagger-threshold" value="0.35" min="0" max="1" step="0.01">
        </div>
        <div class="config-group">
          <label>冲突处理</label>
          <select id="tagger-conflict">
            ${conflicts.map((c) => `<option value="${c}" ${c === 'ignore' ? 'selected' : ''}>${conflictLabels[c]}</option>`).join('')}
          </select>
        </div>
        <div class="config-group">
          <label>额外追加标签</label>
          <input class="text-input" type="text" id="tagger-additional" placeholder="tag1, tag2">
        </div>
        <div class="config-group">
          <label>排除标签</label>
          <input class="text-input" type="text" id="tagger-exclude" placeholder="tag_to_remove">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>递归扫描子目录</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-recursive">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>替换下划线为空格</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-underscore" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>转义括号</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-escape" checked>
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runTagger()">开始标注</button>
      </div>
    </section>
  `;
}

window.runTagger = async () => {
  const pathVal = $('#tagger-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  const params = {
    path: pathVal,
    interrogator_model: $('#tagger-model')?.value || 'wd14-convnextv2-v2',
    threshold: parseFloat($('#tagger-threshold')?.value) || 0.35,
    additional_tags: $('#tagger-additional')?.value || '',
    exclude_tags: $('#tagger-exclude')?.value || '',
    batch_input_recursive: $('#tagger-recursive')?.checked || false,
    batch_output_action_on_conflict: $('#tagger-conflict')?.value || 'ignore',
    replace_underscore: $('#tagger-underscore')?.checked ?? true,
    escape_tag: $('#tagger-escape')?.checked ?? true,
  };
  try {
    await api.runInterrogate(params);
    showToast('标注任务已提交，正在后台运行...');
  } catch (error) {
    showToast(error.message || '标注任务启动失败。');
  }
};

function renderTagEditor() {
  const content = $('#dataset-content');
  if (!content) return;
  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>标签编辑器</h3></header>
      <div class="section-summary">推荐使用外部标签编辑器工具，可以获得更完整的批量编辑体验。</div>
      <div class="empty-state" style="margin-top:16px;">
        <strong>请使用外部工具</strong>
        <span>训练包内附带 <code>1BooruDatasetTagManager</code>，双击 <code>BooruDatasetTagManager.exe</code> 即可启动。<br>支持批量查看、编辑、搜索替换标签，比内置编辑器更高效。</span>
        <button class="btn btn-outline btn-sm" type="button" style="margin-top:12px;" onclick="openExternalTagEditor()">了解更多</button>
      </div>
    </section>
  `;
}

window.openExternalTagEditor = () => {
  showToast('请在训练包目录下找到 1BooruDatasetTagManager 文件夹并双击 exe 启动。');
};

function renderImageResize() {
  const content = $('#dataset-content');
  if (!content) return;

  const defaultResolutions = [
    [768, 1344], [832, 1216], [896, 1152], [1024, 1024],
    [1152, 896], [1216, 832], [1344, 768],
  ];

  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>训练图像缩放预处理</h3></header>
      <div class="section-summary">将图片缩放到最接近的预设目标分辨率，保持宽高比。支持批量转换格式、自动重命名、同步描述文件。<br><strong>推荐常用参数：智能缩放 + 精确裁剪</strong></div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>输入目录</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="resize-input-select" style="flex:1;"><option value="">加载中...</option></select>
            <button class="picker-mode-icon-btn" type="button" title="内置文件选择器" onclick="openNativePicker('resize-input-select', 'folder')"><svg class="icon"><use href="#icon-folder"></use></svg></button>
          </div>
          <p class="field-desc">选择 train 目录下的数据集文件夹。</p>
        </div>
        <div class="config-group" style="grid-column:1/-1;">
          <label>输出目录（留空则覆盖原文件）</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="openNativePicker('resize-output', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="resize-output" placeholder="留空则在原目录生成">
          </div>
        </div>
        <div class="config-group">
          <label>输出格式</label>
          <select id="resize-format">
            <option value="ORIGINAL">原格式</option>
            <option value="JPEG">JPEG (.jpg)</option>
            <option value="WEBP">WEBP (.webp)</option>
            <option value="PNG">PNG (.png)</option>
          </select>
        </div>
        <div class="config-group">
          <label>质量 (JPG/WEBP)：<span id="resize-quality-val">95</span>%</label>
          <input type="range" id="resize-quality" value="95" min="1" max="100" step="1" oninput="document.getElementById('resize-quality-val').textContent=this.value">
        </div>
        <div class="config-group" style="grid-column:1/-1;">
          <label>目标分辨率列表</label>
          <input class="text-input" type="text" id="resize-resolutions" value="${defaultResolutions.map((r) => r.join('x')).join(', ')}" placeholder="768x1344, 1024x1024, ...">
          <p class="field-desc">格式：宽x高，逗号分隔。图片会匹配宽高比最接近的分辨率。</p>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>启用智能缩放</label><p class="field-desc">禁用后仅转换格式，不改变尺寸。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-enable" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>精确裁剪到目标尺寸</label><p class="field-desc">缩放后居中裁剪，输出精确等于目标尺寸。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-exact"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归处理子目录</label><p class="field-desc">扫描并处理所有子文件夹中的图片。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-recursive"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>自动重命名 (文件夹名_序号)</label><p class="field-desc">输出文件命名为 父文件夹名_1、父文件夹名_2 ...</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-rename"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>处理后删除原图</label><p class="field-desc">处理成功后删除源文件，建议配合输出目录使用。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-delete"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>同步处理描述文件</label><p class="field-desc">自动同步 .txt / .npz / .caption 文件。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-sync" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="runImageResize()">开始处理</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="openResizeGui()">打开图形界面</button>
      </div>
    </section>
  `;
  loadResizeInputDirs();
}

async function loadResizeInputDirs() {
  const sel = $('#resize-input-select');
  if (!sel) return;
  try {
    const response = await api.getBuiltinPicker('folder');
    const items = response?.data?.items || [];
    if (!items.length) {
      sel.innerHTML = '<option value="">未检测到数据集目录</option>';
      return;
    }
    sel.innerHTML = items.map((d) => `<option value="./train/${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">读取失败</option>';
  }
}

window.runImageResize = async () => {
  const inputDir = $('#resize-input-select')?.value?.trim();
  if (!inputDir) { showToast('请先填写输入目录。'); return; }
  const params = {
    script_name: '_image_resize',
    input_dir: inputDir,
    output_dir: $('#resize-output')?.value?.trim() || '',
    format: $('#resize-format')?.value || 'ORIGINAL',
    quality: parseInt($('#resize-quality')?.value) || 95,
    resolutions: $('#resize-resolutions')?.value?.trim() || '',
    enable_resize: $('#resize-enable')?.checked ?? true,
    exact_size: $('#resize-exact')?.checked || false,
    recursive: $('#resize-recursive')?.checked || false,
    rename: $('#resize-rename')?.checked || false,
    delete_original: $('#resize-delete')?.checked || false,
    sync_metadata: $('#resize-sync')?.checked ?? true,
  };
  try {
    await api.runImageResize(params);
    showToast('图像预处理任务已提交，正在后台运行...');
  } catch (error) {
    showToast(error.message || '图像预处理启动失败。');
  }
};

window.openResizeGui = () => {
  showToast('请在 train 目录下双击「训练图像缩放预处理工具.py」打开独立图形界面。');
};


function renderLogs(container) {
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>训练日志</h2>
        <p>查看 TensorBoard 日志目录。可通过 TensorBoard 可视化训练过程中的损失曲线和样本图。</p>
      </header>
      <div class="section-toolbar">
        <div class="toolbar-actions toolbar-actions-only">
          <button class="btn btn-outline btn-sm" type="button" onclick="refreshLogDirs()">刷新日志列表</button>
          <button class="btn btn-outline btn-sm" type="button" onclick="openTensorBoard()">启动 TensorBoard</button>
        </div>
      </div>
      <div id="logs-list" class="module-list"><div class="builtin-picker-empty"><span>加载中...</span></div></div>
    </div>
  `;
  window.refreshLogDirs();
}

window.refreshLogDirs = async () => {
  const list = $('#logs-list');
  if (!list) return;
  list.innerHTML = '<div class="builtin-picker-empty"><span>加载中...</span></div>';
  try {
    const response = await api.getLogDirs();
    const dirs = response?.data?.dirs || [];
    if (!dirs.length) {
      list.innerHTML = '<div class="builtin-picker-empty"><span>未检测到日志目录</span></div>';
      return;
    }
    list.innerHTML = dirs.map((d) => `
      <div class="module-list-item" onclick="viewLogDetail('${escapeHtml(d.name)}')">
        <div class="module-list-main">
          <strong>${escapeHtml(d.name)}</strong>
          <span class="module-list-meta">${d.hasEvents ? '包含 TensorBoard 事件文件' : '无事件文件'}</span>
        </div>
        <span class="module-list-time">${new Date(d.time).toLocaleString('zh-CN')}</span>
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '读取日志目录失败')}</span></div>`;
  }
};

window.viewLogDetail = async (dirName) => {
  const list = $('#logs-list');
  if (!list) return;
  list.innerHTML = '<div class="builtin-picker-empty"><span>加载中...</span></div>';
  try {
    const response = await api.getLogDetail(dirName);
    const files = response?.data?.files || [];
    list.innerHTML = `
      <div style="padding:0 0 12px;"><button class="btn btn-outline btn-sm" type="button" onclick="refreshLogDirs()">← 返回列表</button></div>
      <h3 style="margin-bottom:12px;font-size:1rem;">${escapeHtml(dirName)}</h3>
      ${files.length ? files.map((f) => `
        <div class="module-list-item module-list-item-static">
          <div class="module-list-main">
            <strong>${escapeHtml(f.name)}</strong>
            <span class="module-list-meta">${(f.size / 1024).toFixed(1)} KB</span>
          </div>
          <span class="module-list-time">${new Date(f.time).toLocaleString('zh-CN')}</span>
        </div>
      `).join('') : '<div class="builtin-picker-empty"><span>该目录为空</span></div>'}
    `;
  } catch (error) {
    list.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '读取失败')}</span></div>`;
  }
};

window.openTensorBoard = () => {
  showToast('TensorBoard 需要通过后端启动，请在终端执行：tensorboard --logdir=./logs');
};

function renderTools(container) {
  const tools = [
    {
      id: 'extract_lora',
      title: '从模型提取 LoRA',
      desc: '从两个模型的差异中提取 LoRA 网络权重。需要指定原始模型、微调模型和输出路径。',
      script: 'networks/extract_lora_from_models.py',
      fields: [
        { key: 'model_org', label: '原始模型路径', type: 'text', placeholder: './sd-models/original.safetensors' },
        { key: 'model_tuned', label: '微调模型路径', type: 'text', placeholder: './sd-models/finetuned.safetensors' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/extracted.safetensors' },
        { key: 'dim', label: '网络维度 (dim)', type: 'number', placeholder: '32' },
      ],
    },
    {
      id: 'extract_dylora',
      title: '从 DyLoRA 提取 LoRA',
      desc: '从 DyLoRA 模型中提取指定维度的 LoRA 权重。',
      script: 'networks/extract_lora_from_dylora.py',
      fields: [
        { key: 'model', label: 'DyLoRA 模型路径', type: 'text', placeholder: './output/dylora.safetensors' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/extracted.safetensors' },
        { key: 'unit', label: '提取维度 (unit)', type: 'number', placeholder: '4' },
      ],
    },
    {
      id: 'merge_lora',
      title: '合并 LoRA',
      desc: '将多个 LoRA 按指定权重合并为一个。支持 2~4 个 LoRA 输入。',
      script: 'networks/merge_lora.py',
      fields: [
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged.safetensors' },
        { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
        { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
    {
      id: 'merge_models',
      title: '合并模型',
      desc: '按指定比例合并两个 Stable Diffusion 模型。',
      script: 'tools/merge_models.py',
      fields: [
        { key: 'model_0', label: '模型 A 路径', type: 'text', placeholder: './sd-models/model_a.safetensors' },
        { key: 'model_1', label: '模型 B 路径', type: 'text', placeholder: './sd-models/model_b.safetensors' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged_model.safetensors' },
        { key: 'ratio', label: '合并比例 (0~1)', type: 'text', placeholder: '0.5' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
  ];

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>工具箱</h2>
        <p>LoRA 提取、合并等实用工具。参数填写后点击运行，脚本将在后端执行。</p>
      </header>
      ${tools.map((tool) => `
        <section class="form-section tool-section" id="tool-${tool.id}">
          <header class="section-header">
            <h3>${escapeHtml(tool.title)}</h3>
          </header>
          <div class="section-summary">${escapeHtml(tool.desc)}</div>
          <div class="section-content tool-fields">
            ${tool.fields.map((f) => `
              <div class="config-group">
                <label>${escapeHtml(f.label)}</label>
                <input class="text-input" type="${f.type}" id="tool-${tool.id}-${f.key}" placeholder="${escapeHtml(f.placeholder || '')}">
              </div>
            `).join('')}
          </div>
          <div class="tool-actions">
            <button class="btn btn-primary btn-sm" type="button" onclick="runTool('${tool.id}', '${escapeHtml(tool.script)}', ${JSON.stringify(tool.fields.map((f) => f.key)).replaceAll('"', '&quot;')})">运行</button>
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

window.runTool = async (toolId, scriptName, keys) => {
  const params = { script_name: scriptName };
  for (const key of keys) {
    const input = $(`#tool-${toolId}-${key}`);
    if (input && input.value.trim()) {
      params[key] = input.value.trim();
    }
  }
  try {
    await api.runScript(params);
    showToast(`工具「${toolId}」已提交运行。`);
  } catch (error) {
    showToast(error.message || '工具运行失败。');
  }
};



window.updateConfigValue = (key, rawValue) => {
  const field = getFieldDefinition(key);
  const normalizedValue = normalizeDraftValue(field, rawValue);
  const previousValue = state.config[key];
  if (String(previousValue ?? '') !== String(normalizedValue ?? '')) {
    state.fieldUndo[key] = previousValue;
  }
  state.config[key] = normalizedValue;
  if (CONDITIONAL_KEYS.has(key) && state.activeModule === 'config') {
    saveDraft();
    renderView('config');
    return;
  }
  syncConfigState();
};

window.pickPath = async (key, pickerType) => {
  try {
    const response = await api.pickFile(pickerType);
    if (response.status !== 'success') {
      showToast(response.message || '选择路径失败。');
      return;
    }
    window.updateConfigValue(key, response.data.path);
    if (state.activeModule === 'config') {
      renderView('config');
    }
  } catch (error) {
    showToast(error.message || '选择路径失败。');
  }
};

window.runPreflight = async () => {
  state.loading.preflight = true;
  updateJSONPreview();

  try {
    const response = await api.runPreflight(buildRunConfig(state.config));
    if (response.status !== 'success') {
      state.preflight = {
        can_start: false,
        errors: [response.message || '训练预检失败。'],
        warnings: [],
      };
    } else {
      state.preflight = response.data;
    }
  } catch (error) {
    state.preflight = {
      can_start: false,
      errors: [error.message || '训练预检失败。'],
      warnings: [],
    };
  } finally {
    state.loading.preflight = false;
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      updateJSONPreview();
    }
  }
};

window.runSelfCheck = async () => {
  showToast('正在执行环境自检...');
  try {
    const [runtimeRes, preflightRes] = await Promise.allSettled([
      api.getGraphicCards(),
      api.runPreflight(buildRunConfig(state.config)),
    ]);
    if (runtimeRes.status === 'fulfilled') {
      state.runtime = runtimeRes.value.data || null;
      state.runtimeError = '';
    } else {
      state.runtimeError = runtimeRes.reason?.message || '运行环境不可用';
    }
    if (preflightRes.status === 'fulfilled') {
      state.preflight = preflightRes.value.data || null;
    }
    showToast('环境自检完成');
  } catch (error) {
    showToast(error.message || '环境自检失败');
  } finally {
    if (state.activeModule === 'config') {
      renderView('config');
    }
  }
};

window.refreshRuntime = async () => {
  state.loading.runtime = true;
  updateJSONPreview();

  try {
    const response = await api.getGraphicCards();
    state.runtime = response.data || null;
    state.runtimeError = '';
  } catch (error) {
    state.runtimeError = error.message || '运行环境状态不可用。';
  } finally {
    state.loading.runtime = false;
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      updateJSONPreview();
    }
  }
};

function setupImportConfig() {
  if (state.importInputBound) {
    return;
  }
  const input = $('#config-file-input');
  if (!input) {
    return;
  }
  state.importInputBound = true;
  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      mergeConfigPatch(parsed);
      syncConfigState();
      showToast('配置文件已导入。');
    } catch (error) {
      showToast(error.message || '导入配置文件失败。');
    } finally {
      input.value = '';
    }
  });
}

function setupNativePicker() {
  if (state.pickerInputBound) {
    return;
  }
  const input = $('#native-picker-input');
  if (!input) {
    return;
  }
  state.pickerInputBound = true;
  input.addEventListener('change', (event) => {
    const fieldKey = input.dataset.fieldKey;
    const fieldType = input.dataset.fieldType;
    const files = Array.from(event.target.files || []);
    if (!fieldKey || files.length === 0) {
      return;
    }
    let nextValue = '';
    if (fieldType === 'folder') {
      const firstPath = files[0].webkitRelativePath || files[0].name;
      nextValue = firstPath.split('/')[0] || firstPath;
    } else {
      nextValue = files[0].name;
    }
    window.updateConfigValue(fieldKey, nextValue);
    input.value = '';
    delete input.dataset.fieldKey;
    delete input.dataset.fieldType;
  });
}

function renderBuiltinPickerModal() {
  const modal = $('#builtin-picker-modal');
  const title = $('#builtin-picker-title');
  const path = $('#builtin-picker-path');
  const list = $('#builtin-picker-list');
  const footer = document.querySelector('.builtin-picker-footer');
  if (footer) footer.innerHTML = `<button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>`;
  if (!modal || !title || !path || !list) {
    return;
  }
  modal.classList.toggle('open', state.builtinPicker.open);
  if (!state.builtinPicker.open) {
    return;
  }
  const pt = state.builtinPicker.pickerType;
  title.textContent = (pt === 'folder' || pt === 'output-folder') ? '请选择目录' : '请选择模型文件';
  path.textContent = state.builtinPicker.rootLabel;
  if (!state.builtinPicker.items.length) {
    list.innerHTML = `
      <div class="builtin-picker-empty">
        <span>未检测到内容</span>
      </div>
    `;
    return;
  }
  list.innerHTML = state.builtinPicker.items.map((item) => `
      <button class="builtin-picker-item" type="button" onclick="selectBuiltinPickerItem('${escapeHtml(item)}')">
        <span class="builtin-picker-name">${escapeHtml(item)}</span>
      </button>
    `).join('');
}

window.openNativePicker = (fieldKey, pickerType) => {
  api.getBuiltinPicker(pickerType)
    .then((response) => {
      state.builtinPicker = {
        open: true,
        fieldKey,
        pickerType,
        rootLabel: response?.data?.rootLabel || '',
        items: response?.data?.items || [],
      };
      renderBuiltinPickerModal();
    })
    .catch((error) => {
      showToast(error.message || '打开内置文件选择器失败。');
    });
};

window.closeBuiltinPicker = () => {
  state.builtinPicker.open = false;
  renderBuiltinPickerModal();
};

window.selectBuiltinPickerItem = (item) => {
  const root = state.builtinPicker.rootLabel.replaceAll('\\', '/');
  const fullPath = `${root}/${item}`;
  state.builtinPicker.open = false;
  renderBuiltinPickerModal();
  window.updateConfigValue(state.builtinPicker.fieldKey, fullPath);
};

function setupFieldMenus() {
  function closeAllMenus() {
    document.querySelectorAll('.field-menu-dropdown').forEach((m) => m.remove());
    state.activeFieldMenu = null;
  }

  function openMenu(key, anchor) {
    closeAllMenus();
    state.activeFieldMenu = key;
    const field = getFieldDefinition(key);
    if (!field) return;
    const value = state.config[field.key];
    const defaultValue = field.defaultValue ?? '';
    const canUndo = Object.hasOwn(state.fieldUndo, field.key);
    const canReset = String(value ?? '') !== String(defaultValue ?? '');

    const menu = document.createElement('div');
    menu.className = 'field-menu field-menu-dropdown';
    menu.innerHTML = `
      <button class="field-menu-item ${canUndo ? '' : 'disabled'}" type="button" ${canUndo ? '' : 'disabled'}>撤销更改</button>
      <button class="field-menu-item ${canReset ? '' : 'disabled'}" type="button" ${canReset ? '' : 'disabled'}>恢复默认</button>
    `;
    menu.addEventListener('click', (e) => e.stopPropagation());
    const btns = menu.querySelectorAll('.field-menu-item');
    if (canUndo) btns[0].addEventListener('click', () => { closeAllMenus(); window.undoFieldValue(key); });
    if (canReset) btns[1].addEventListener('click', () => { closeAllMenus(); window.resetFieldValue(key); });
    anchor.appendChild(menu);
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target?.closest?.('[data-field-menu-key]');
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      const key = toggle.dataset.fieldMenuKey;
      if (state.activeFieldMenu === key) {
        closeAllMenus();
      } else {
        const anchor = toggle.closest('.field-inline-actions');
        if (anchor) openMenu(key, anchor);
      }
      return;
    }
    if (event.target?.closest?.('.field-menu-dropdown')) {
      return;
    }
    if (state.activeFieldMenu) {
      closeAllMenus();
    }
  });
  $('#builtin-picker-close')?.addEventListener('click', window.closeBuiltinPicker);
  $('#builtin-picker-cancel')?.addEventListener('click', window.closeBuiltinPicker);
  $('#builtin-picker-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'builtin-picker-modal') {
      window.closeBuiltinPicker();
    }
  });
}

window.resetAllParams = () => {
  state.config = createDefaultConfig();
  state.hasLocalDraft = false;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  resetTransientState();
  if (state.activeModule === 'config') {
    renderView('config');
  } else {
    updateJSONPreview();
  }
};


window.saveCurrentParams = () => {
  const defaultName = 'Angela';
  const modal = $('#builtin-picker-modal');
  const title = $('#builtin-picker-title');
  const pathEl = $('#builtin-picker-path');
  const list = $('#builtin-picker-list');
  if (!modal || !title || !pathEl || !list) return;

  title.textContent = '保存当前参数';
  pathEl.textContent = '请输入保存名称，保存后会直接写入本地文件。';
  list.innerHTML = `
    <div class="save-params-form">
      <input type="text" id="save-params-name" class="text-input" value="${escapeHtml(defaultName)}" placeholder="输入参数名称">
      <button class="btn btn-primary btn-sm" type="button" id="save-params-confirm">保存</button>
    </div>
  `;
  modal.classList.add('open');

  const nameInput = $('#save-params-name');
  const confirmBtn = $('#save-params-confirm');
  const submit = async () => {
    const name = nameInput?.value?.trim();
    if (!name) {
      if (pathEl) pathEl.textContent = '请输入保存名称。';
      nameInput?.focus();
      return;
    }
    try {
      await api.saveConfig(name, buildRunConfig(state.config));
      saveDraft();
      state.hasLocalDraft = true;
      modal.classList.remove('open');
      showToast('参数已保存：' + name);
      if (state.activeModule === 'config') {
        renderView('config');
      } else {
        renderNavigator();
      }
    } catch (error) {
      if (pathEl) pathEl.textContent = error.message || '保存失败。';
      if (nameInput) {
        nameInput.style.borderColor = 'var(--danger, #d9534f)';
        nameInput.focus();
        nameInput.select();
      }
    }
  };

  confirmBtn?.addEventListener('click', submit, { once: true });
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }, { once: true });
  nameInput?.focus();
  nameInput?.select();
};

window.loadSavedParams = async () => {
  const modal = $('#builtin-picker-modal');
  const title = $('#builtin-picker-title');
  const pathEl = $('#builtin-picker-path');
  const list = $('#builtin-picker-list');
  if (!modal || !title || !pathEl || !list) return;

  title.textContent = '读取已保存参数';
  pathEl.textContent = '选择一个已保存的参数，点击后立即载入。';
  list.innerHTML = '<div class="builtin-picker-empty"><span>加载中...</span></div>';
  const footer = document.querySelector('.builtin-picker-footer');
  if (footer) footer.innerHTML = `<button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>`;
  modal.classList.add('open');

  try {
    const response = await api.listSavedConfigs();
    const configs = response?.data?.configs || [];
    if (!configs.length) {
      list.innerHTML = '<div class="builtin-picker-empty"><span>未检测到内容</span></div>';
      return;
    }
    list.innerHTML = configs.map((configItem) => `
      <div class="builtin-picker-item" type="button">
        <span class="builtin-picker-name">${escapeHtml(configItem.name)}</span>
        <span class="builtin-picker-time">${new Date(configItem.time).toLocaleString('zh-CN')}</span>
        <button class="btn btn-outline btn-sm btn-picker-action" type="button" onclick="previewSavedConfig('${escapeHtml(configItem.name)}')">预览</button>
        <button class="btn btn-outline btn-sm btn-picker-action" type="button" onclick="loadNamedConfig('${escapeHtml(configItem.name)}')">载入</button>
        <button class="builtin-picker-delete-btn" type="button" title="删除" onclick="event.stopPropagation(); deleteSavedConfig('${escapeHtml(configItem.name)}')">✕</button>
      </div>
    `).join('');
  } catch (error) {
    pathEl.textContent = error.message || '读取列表失败。';
    list.innerHTML = '<div class="builtin-picker-empty"><span>未检测到内容</span></div>';
  }
};

window.loadNamedConfig = async (name) => {
  const pathEl = $('#builtin-picker-path');
  try {
    const response = await api.loadSavedConfig(name);
    const data = response?.data;
    if (!data) {
      throw new Error('参数内容为空。');
    }
    mergeConfigPatch(data);
    state.hasLocalDraft = true;
    resetTransientState();
    saveDraft();
    window.closeBuiltinPicker();
    showToast('已载入参数：' + name);
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      renderNavigator();
    }
  } catch (error) {
    if (pathEl) {
      pathEl.textContent = error.message || '读取参数失败。';
    }
  }
};

window.deleteSavedConfig = async (name) => {
  try {
    await api.deleteSavedConfig(name);
    showToast('已删除：' + name);
    window.loadSavedParams();
  } catch (error) {
    showToast(error.message || '删除失败');
  }
};

window.previewSavedConfig = async (name) => {
  const title = $('#builtin-picker-title');
  const pathEl = $('#builtin-picker-path');
  const list = $('#builtin-picker-list');
  if (!title || !pathEl || !list) return;

  title.textContent = `参数预览：${name}`;
  pathEl.textContent = '加载中...';
  list.innerHTML = '<div class="builtin-picker-empty"><span>加载中...</span></div>';
  const footer = document.querySelector('.builtin-picker-footer');
  if (footer) footer.innerHTML = `<button class="btn btn-outline btn-sm" type="button" onclick="loadSavedParams()">← 返回列表</button><button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>`;

  try {
    const response = await api.loadSavedConfig(name);
    const data = response?.data;
    if (!data) throw new Error('参数内容为空。');
    const entries = Object.entries(data);
    pathEl.textContent = `共 ${entries.length} 个参数`;
    list.innerHTML = `
      <div class="params-preview-list">
        ${entries.map(([k, v]) => {
          const display = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
          return `<div class="params-preview-row"><span class="params-key">${escapeHtml(k)}</span><span class="params-val">${escapeHtml(display)}</span></div>`;
        }).join('')}
      </div>
    `;
  } catch (error) {
    pathEl.textContent = error.message || '预览失败。';
  }
};

window.downloadConfigFile = () => {
  const blob = new Blob([JSON.stringify(buildRunConfig(state.config), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sdxl-lora-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

window.importConfigFile = () => {
  $('#config-file-input')?.click();
};

window.resetFieldValue = (key) => {
  const field = getFieldDefinition(key);
  if (!field) return;
  state.activeFieldMenu = null;
  window.updateConfigValue(key, field.defaultValue ?? '');
};

window.undoFieldValue = (key) => {
  if (!Object.hasOwn(state.fieldUndo, key)) {
    return;
  }
  const previousValue = state.fieldUndo[key];
  delete state.fieldUndo[key];
  state.activeFieldMenu = null;
  const field = getFieldDefinition(key);
  state.config[key] = normalizeDraftValue(field, previousValue);
  if (CONDITIONAL_KEYS.has(key) && state.activeModule === 'config') {
    return syncConfigState();
  }
  syncConfigState();
};

window.updateLayoutWidth = (target, rawValue, persist = true) => {
  const value = Number(rawValue);
  if (Number.isNaN(value)) {
    return;
  }
  if (target === 'navigator') {
    state.navigatorWidth = value;
  } else if (target === 'json') {
    state.jsonPanelWidth = value;
  }
  if (persist) {
    applyAndPersistLayout();
  } else {
    applyLayoutPreferences();
  }
  if (state.activeModule === 'settings') {
    $('#navigator-width-value').textContent = `${state.navigatorWidth}px`;
    $('#json-width-value').textContent = `${state.jsonPanelWidth}px`;
  }
};

window.executeTraining = async () => {
  state.loading.run = true;
  syncFooterAction();

  try {
    const preflightResponse = await api.runPreflight(buildRunConfig(state.config));
    if (preflightResponse.status !== 'success' || !preflightResponse.data?.can_start) {
      state.preflight = preflightResponse.data || {
        can_start: false,
        errors: [preflightResponse.message || '训练预检阻止了本次训练。'],
        warnings: [],
      };
      showToast('预检未通过，请先修正错误。');
      return;
    }

    state.preflight = preflightResponse.data;
    const response = await api.runTraining(buildRunConfig(state.config));
    if (response.status !== 'success') {
      showToast(response.message || '训练启动失败。');
      return;
    }

    state.lastMessage = response.message || '训练已启动。';
    showToast(state.lastMessage);
    const tasksResponse = await api.getTasks();
    state.tasks = tasksResponse?.data?.tasks || [];
  } catch (error) {
    showToast(error.message || '训练请求失败。');
  } finally {
    state.loading.run = false;
    if (state.activeModule === 'config') {
      renderView('config');
    } else {
      updateJSONPreview();
    }
  }
};

window.applyPreset = (index) => {
  const preset = state.presets[index];
  if (!preset) {
    return;
  }
  mergeConfigPatch(preset);
  state.hasLocalDraft = true;
  resetTransientState();
  saveDraft();
  renderView('config');
};

window.terminateAllTasks = async () => {
  const runningTasks = state.tasks.filter((t) => t.status === 'RUNNING');
  if (!runningTasks.length) {
    showToast('当前没有运行中的任务。');
    return;
  }
  try {
    for (const task of runningTasks) {
      await api.terminateTask(task.task_id || task.id);
    }
    showToast('已发送终止请求。');
    const tasksResponse = await api.getTasks();
    state.tasks = tasksResponse?.data?.tasks || [];
    syncFooterAction();
    if (state.activeModule === 'config') {
      renderView('config');
    }
  } catch (error) {
    showToast(error.message || '终止任务失败。');
  }
};

document.addEventListener('DOMContentLoaded', init);
