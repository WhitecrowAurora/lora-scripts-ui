import { t } from './i18n.js';
import { api } from './api.js';
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
  activeTrainingType: localStorage.getItem('sd-rescripts:training-type') || 'sdxl-lora',
  config: createDefaultConfig(localStorage.getItem('sd-rescripts:training-type') || 'sdxl-lora'),
  hasLocalDraft: false,
  presets: [],
  tasks: [],
  trainingFailed: false,
  interrogators: null,
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
    state.tasks = tasksResult.value?.data?.tasks || [];
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
  setInterval(async () => {
    try {
      const hadRunning = state.tasks.some((t) => t.status === 'RUNNING');
      const response = await api.getTasks();
      state.tasks = response?.data?.tasks || [];
      const hasRunning = state.tasks.some((t) => t.status === 'RUNNING');

      // 检测训练结束：之前有运行中的任务，现在没了
      if (hadRunning && !hasRunning) {
        const lastTask = state.tasks[state.tasks.length - 1];
        const failed = lastTask && (lastTask.status === 'TERMINATED' || lastTask.returncode !== 0);
        state.trainingFailed = !!failed;
        if (!failed) showToast('✅ 训练已完成');
        else showToast('❌ 训练失败');
      }

      updateJSONPreview();
      renderTaskStatus();
      syncFooterAction();
      // 训练模块的状态卡片也需要实时刷新
      if (state.activeModule === 'training') {
        const badge = $('#training-status-badge');
        if (badge) {
          const r = state.tasks.some((t) => t.status === 'RUNNING');
          if (r) badge.innerHTML = '<span style="color:#f59e0b;font-weight:700;">🔄 训练中</span>';
          else if (state.trainingFailed) badge.innerHTML = '<span style="color:#ef4444;font-weight:700;">❌ 训练失败</span>';
          else if (state.tasks.some((t) => t.status === 'FINISHED')) badge.innerHTML = '<span style="color:#22c55e;font-weight:700;">✅ 已完成</span>';
          else badge.innerHTML = '<span style="color:var(--text-dim);">空闲</span>';
        }
        // 如果有运行中的任务且在训练模块，自动启动日志轮询
        if (hasRunning && !_trainingLogPollTimer) {
          startTrainingLogPolling();
        }
      }
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
  syncFooterAction();

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
  if (module === 'about') {
    renderAbout(container);
    return;
  }
  if (module === 'training') {
    renderTraining(container);
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
  const tt = state.activeTrainingType;
  const typeLabel = TRAINING_TYPES.find((t) => t.id === tt)?.label || tt;
  const sections = getSectionsForTab(state.activeTab, tt);
  const visibleSections = sections.filter((section) =>
    section.fields.some((field) => field.type !== 'hidden' && isFieldVisible(field, state.config))
  );

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>${typeLabel} LoRA 模式</h2>
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
  const isModified = String(value ?? '') !== String(defaultValue);
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

  const modCls = isModified ? ' field-modified' : '';
  if (field.type === 'boolean') {
    return `
      <div class="config-group row boolean-card${modCls}" data-field-key="${field.key}">
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
    let filteredOptions = field.options;
    if (field.key === 'optimizer_type') {
      const vis = JSON.parse(localStorage.getItem('sd-rescripts:visible-optimizers') || '[]');
      if (vis.length > 0) filteredOptions = field.options.filter((o) => vis.includes(o));
    }
    if (field.key === 'lr_scheduler') {
      const vis = JSON.parse(localStorage.getItem('sd-rescripts:visible-schedulers') || '[]');
      if (vis.length > 0) filteredOptions = field.options.filter((o) => vis.includes(o));
    }
    return `
      <div class="config-group${modCls}" data-field-key="${field.key}">
        ${renderHeader()}
        <p class="field-desc">${escapeHtml(field.desc || '')}</p>
        <select onchange="updateConfigValue('${field.key}', this.value)">
          ${filteredOptions.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option || '默认')}</option>`).join('')}
        </select>
      </div>
    `;
  }

  if (field.type === 'textarea') {
    return `
      <div class="config-group${modCls}" data-field-key="${field.key}">
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
      <div class="config-group${modCls}" data-field-key="${field.key}">
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
    <div class="config-group${modCls}" data-field-key="${field.key}">
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

  // === 注意力后端检测 ===
  const xf = state.runtime?.xformers;
  const rt = state.runtime?.runtime;
  const sagePkg = rt?.packages?.sageattention;
  const xfInstalled = xf?.installed;
  const xfSupported = xf?.supported;
  const sageInstalled = sagePkg?.importable;

  let attnLabel = '检测中';
  let attnDetail = '暂无状态信息';
  if (xf || sagePkg) {
    const parts = [];
    if (xfInstalled) {
      parts.push(`xFormers ${xf.version || ''} ${xfSupported ? '✓' : '(不支持)'}`);
    } else {
      parts.push('xFormers 未安装');
    }
    if (sageInstalled) {
      parts.push(`SageAttention ${sagePkg.version || ''} ✓`);
    } else {
      parts.push('SageAttention 未安装');
    }
    attnLabel = (xfSupported || sageInstalled) ? '可用' : '受限';
    attnDetail = parts.join(' · ');
    if (xf?.reason) attnDetail += ` — ${xf.reason}`;
  }

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
      <span class="status-label">注意力后端</span>
      <strong class="status-value">${escapeHtml(attnLabel)}</strong>
      <span class="status-sub">${escapeHtml(attnDetail)}</span>
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
    const groups = {};
    for (const tt of TRAINING_TYPES) {
      if (!groups[tt.group]) groups[tt.group] = [];
      groups[tt.group].push(tt);
    }
    trainingTypeList.innerHTML = Object.entries(groups).map(([group, items]) =>
      `<li class="group-header" style="pointer-events:none;user-select:none;">${group}</li>` +
      items.map((tt) =>
        `<li class="${tt.id === state.activeTrainingType ? 'active' : ''}" onclick="switchTrainingType('${tt.id}')">${tt.label}</li>`
      ).join('')
    ).join('');
  }

  const presetPanel = $('#panel-preset-actions');
  if (presetPanel) {
    presetPanel.innerHTML = `
      <div class="panel-preset-title">参数管理</div>
      <div class="panel-preset-grid">
        <button class="btn btn-outline btn-sm" type="button" onclick="resetAllParams()">重置参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="saveCurrentParams()">保存参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="loadSavedParams()">读取参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="downloadConfigFile()">导出文件</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="importConfigFile()">导入文件</button>
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
  refreshFieldHighlights();
}

function refreshFieldHighlights() {
  document.querySelectorAll('.config-group[data-field-key]').forEach((el) => {
    const key = el.dataset.fieldKey;
    const field = getFieldDefinition(key);
    if (!field) return;
    const value = state.config[key];
    const defaultValue = field.defaultValue ?? '';
    const isModified = String(value ?? '') !== String(defaultValue);
    el.classList.toggle('field-modified', isModified);
  });
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
  if (!bar) return;
  // 在 config 和 training 模块显示
  const showBar = state.activeModule === 'config' || state.activeModule === 'training';
  bar.style.display = showBar ? '' : 'none';
  if (!showBar) return;
  const hasRunningTask = state.tasks.some((task) => task.status === 'RUNNING');
  const hasFailedRecent = state.trainingFailed;

  if (hasRunningTask) {
    bar.innerHTML = `
      <button class="btn btn-execute btn-training-active" disabled>
        <span class="btn-main">🔄 训练中...</span>
      </button>
      <button class="btn btn-terminate" onclick="terminateAllTasks()">
        <span class="btn-main">终止训练</span>
      </button>
    `;
  } else if (hasFailedRecent) {
    bar.innerHTML = `
      <button class="btn btn-execute btn-training-failed" onclick="state.trainingFailed=false;syncFooterAction();">
        <span class="btn-main">❌ 训练失败 — 点击重试</span>
      </button>
    `;
  } else {
    bar.innerHTML = `
      <button class="btn btn-primary btn-execute" onclick="executeTraining()" ${state.loading.run ? 'disabled' : ''}>
        <span class="btn-main">${state.loading.run ? '正在启动训练...' : '开始训练'}</span>
      </button>
    `;
  }
}

function syncTopbarState() {
  if (state.activeFieldMenu) {
    state.activeFieldMenu = null;
  }
  applyLayoutPreferences();

  // 根据当前训练类型决定哪些 tab 可见
  const availTabs = getAvailableTabs(state.activeTrainingType);
  const availKeys = new Set(availTabs.map((t) => t.key));

  // 如果当前 activeTab 在此类型下不存在，回退到第一个可用 tab
  if (!availKeys.has(state.activeTab)) {
    state.activeTab = availTabs[0]?.key || 'model';
    localStorage.setItem('sdxl_ui_tab', state.activeTab);
  }

  $$('.top-nav-item').forEach((item) => {
    const tab = item.dataset.tab;
    const visible = availKeys.has(tab);
    item.style.display = visible ? '' : 'none';
    item.classList.toggle('active', tab === state.activeTab);
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

  $$('.nav-section .section-header.collapsible').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest('.nav-section');
      if (!section) return;
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

  const payload = buildRunConfig(state.config, state.activeTrainingType);
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

function renderTraining(container) {
  const running = state.tasks.filter((t) => t.status === 'RUNNING');
  const finished = state.tasks.filter((t) => t.status === 'FINISHED');
  const terminated = state.tasks.filter((t) => t.status === 'TERMINATED');
  const lastTask = state.tasks[state.tasks.length - 1];
  const hasRunning = running.length > 0;

  let statusBadge = '<span style="color:var(--text-dim);">空闲</span>';
  if (hasRunning) {
    statusBadge = '<span style="color:#f59e0b;font-weight:700;">🔄 训练中</span>';
  } else if (state.trainingFailed) {
    statusBadge = '<span style="color:#ef4444;font-weight:700;">❌ 上次训练失败</span>';
  } else if (finished.length > 0) {
    statusBadge = '<span style="color:#22c55e;font-weight:700;">✅ 上次训练已完成</span>';
  }


  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>训练监控</h2>
        <p>查看训练状态与实时输出。</p>
      </header>

      <!-- 状态概览 -->
      <section class="form-section">
        <header class="section-header"><h3>状态概览</h3></header>
        <div class="section-content" style="display:flex;gap:24px;flex-wrap:wrap;">
          <div class="status-card" style="flex:1;min-width:160px;">
            <div class="status-label">当前状态</div>
            <div class="status-value" id="training-status-badge">${statusBadge}</div>
          </div>
          <div class="status-card" style="flex:1;min-width:160px;">
            <div class="status-label">总任务数</div>
            <div class="status-value">${state.tasks.length}</div>
          </div>
          <div class="status-card" style="flex:1;min-width:160px;">
            <div class="status-label">运行中</div>
            <div class="status-value" style="color:#f59e0b;">${running.length}</div>
          </div>
          <div class="status-card" style="flex:1;min-width:160px;">
            <div class="status-label">已完成</div>
            <div class="status-value" style="color:#22c55e;">${finished.length}</div>
          </div>
        </div>
      </section>

      <!-- 实时输出 -->
      <section class="form-section">
        <header class="section-header">
          <h3>训练输出</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" type="button" onclick="refreshTrainingLog()">刷新</button>
            <label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;color:var(--text-dim);">
              <input type="checkbox" id="training-log-autoscroll" checked> 自动滚动
            </label>
          </div>
        </header>
        <div id="training-log-container" style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:12px;height:400px;overflow-y:auto;font-family:'Cascadia Code','Fira Code',monospace;font-size:0.82rem;line-height:1.6;white-space:pre-wrap;word-break:break-all;color:var(--text-main);">
          ${hasRunning ? '<span style="color:var(--text-dim);">正在加载训练输出...</span>' : '<span style="color:var(--text-dim);">暂无训练任务运行中。点击「开始训练」启动训练后，输出将在此实时显示。</span>'}
        </div>
      </section>

      <!-- 任务历史 -->
      <section class="form-section">
        <header class="section-header"><h3>任务历史</h3></header>
        <div class="section-content" style="display:block;">
          ${state.tasks.length === 0 ? '<p style="color:var(--text-dim);">暂无任务记录</p>' : state.tasks.slice().reverse().map((task) => {
            const statusMap = { RUNNING: '🔄 运行中', FINISHED: '✅ 已完成', TERMINATED: '⛔ 已终止', CREATED: '⏳ 已创建' };
            const statusColor = { RUNNING: '#f59e0b', FINISHED: '#22c55e', TERMINATED: '#ef4444', CREATED: 'var(--text-dim)' };
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <div>
                  <code style="font-size:0.78rem;color:var(--text-dim);">${escapeHtml(task.id)}</code>
                </div>
                <span style="color:${statusColor[task.status] || 'var(--text-dim)'};font-weight:600;font-size:0.85rem;">${statusMap[task.status] || task.status}</span>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;

  syncFooterAction();
  if (hasRunning) startTrainingLogPolling();
}

let _trainingLogPollTimer = null;

function startTrainingLogPolling() {
  if (_trainingLogPollTimer) return;
  _trainingLogPollTimer = setInterval(() => {
    if (!state.tasks.some((t) => t.status === 'RUNNING')) {
      clearInterval(_trainingLogPollTimer);
      _trainingLogPollTimer = null;
      // 最后刷一次
      refreshTrainingLog();
      return;
    }
    refreshTrainingLog();
  }, 2000);
}

window.refreshTrainingLog = async () => {
  const running = state.tasks.filter((t) => t.status === 'RUNNING');
  const target = running[0] || state.tasks[state.tasks.length - 1];
  if (!target) return;

  try {
    const resp = await api.getTaskOutput(target.id, 200);
    const lines = resp?.data?.lines || [];
    const logEl = $('#training-log-container');
    if (!logEl) return;

    if (lines.length === 0) {
      logEl.innerHTML = '<span style="color:var(--text-dim);">等待训练输出...</span>';
      return;
    }

    logEl.textContent = lines.join('\n');

    const autoScroll = $('#training-log-autoscroll');
    if (autoScroll?.checked) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  } catch (e) {
    // 静默失败
  }
};


function renderAbout(container) {
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>关于</h2>
      </header>
      <section class="form-section">
        <div class="section-content" style="display:block;">
          <p style="margin-bottom:16px;">SD-reScripts v2.0.0</p>
          <p style="margin-bottom:16px;">由 <a href="https://github.com/Akegarasu/lora-scripts" target="_blank" rel="noopener" style="color:var(--accent);">schemastery</a> 强力驱动</p>
          <h3 style="margin:24px 0 8px;font-size:1.1rem;">下载地址</h3>
          <p>GitHub 地址：<a href="https://github.com/WhitecrowAurora/lora-rescripts" target="_blank" rel="noopener" style="color:var(--accent);">https://github.com/WhitecrowAurora/lora-rescripts</a></p>
          <h3 style="margin:24px 0 8px;font-size:1.1rem;">本前端反馈</h3>
          <p>GitHub 地址：<a href="https://github.com/LichiTI/lora-scripts-ui" target="_blank" rel="noopener" style="color:var(--accent);">https://github.com/LichiTI/lora-scripts-ui</a></p>
        </div>
      </section>
    </div>
  `;
}


function renderSettings(container) {
  const allOptimizers = ['AdamW','AdamW8bit','PagedAdamW8bit','Lion','Lion8bit','SGDNesterov','SGDNesterov8bit','DAdaptation','DAdaptAdam','DAdaptAdaGrad','DAdaptAdan','DAdaptLion','DAdaptSGD','Adafactor','AdaFactor','Prodigy','pytorch_optimizer.CAME','pytorch_optimizer.Adan','pytorch_optimizer.AdaPNM','pytorch_optimizer.ADOPT','pytorch_optimizer.Lamb','pytorch_optimizer.MADGRAD','pytorch_optimizer.Ranger','pytorch_optimizer.Ranger21','pytorch_optimizer.Tiger'];
  const allSchedulers = ['linear','cosine','cosine_with_restarts','polynomial','constant','constant_with_warmup','adafactor','cosine_annealing','cosine_annealing_with_warmup','cosine_annealing_warm_restarts','rex','inverse_sqrt','warmup_stable_decay'];
  const savedTbUrl = localStorage.getItem('sd-rescripts:tensorboard-url') || '';
  const savedOptimizers = JSON.parse(localStorage.getItem('sd-rescripts:visible-optimizers') || '[]');
  const savedSchedulers = JSON.parse(localStorage.getItem('sd-rescripts:visible-schedulers') || '[]');

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>${t('settings.title', state.lang)}</h2>
        <p>控制界面布局、训练 UI 配置等。</p>
      </header>

      <section class="form-section">
        <header class="section-header"><h3>界面布局</h3></header>
        <div class="section-content" style="display:block;">
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
      </section>

      <section class="form-section">
        <header class="section-header"><h3>训练 UI 设置</h3></header>
        <div class="section-content" style="display:block;">
          <div class="settings-row">
            <div>
              <label>tensorboard_url</label>
              <p class="field-desc">TensorBoard 地址，留空则使用默认端口 6006。</p>
            </div>
            <input class="text-input" type="text" id="settings-tb-url" value="${escapeHtml(savedTbUrl)}" placeholder="http://127.0.0.1:6006" style="width:280px;">
          </div>
          <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div>
              <label>visible_optimizers</label>
              <p class="field-desc">优化器显示列表（可多选，留空=显示全部）</p>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;" id="settings-optimizers">
              ${allOptimizers.map((o) => `<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" value="${o}" ${savedOptimizers.includes(o) ? 'checked' : ''}>${o}</label>`).join('')}
            </div>
          </div>
          <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div>
              <label>visible_lr_schedulers</label>
              <p class="field-desc">调度器显示列表（可多选，留空=显示全部）</p>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;" id="settings-schedulers">
              ${allSchedulers.map((s) => `<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" value="${s}" ${savedSchedulers.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}
            </div>
          </div>
          <div class="settings-row">
            <button class="btn btn-primary btn-sm" type="button" id="save-ui-settings-btn">保存训练 UI 设置</button>
          </div>
        </div>
      </section>
    </div>
  `;

  $('#theme-select')?.addEventListener('change', (e) => { state.theme = e.target.value; localStorage.setItem('theme', state.theme); applyTheme(); });
  $('#navigator-width-slider')?.addEventListener('input', (e) => updateLayoutWidth('navigator', e.target.value, false));
  $('#navigator-width-slider')?.addEventListener('change', (e) => updateLayoutWidth('navigator', e.target.value, true));
  $('#json-width-slider')?.addEventListener('input', (e) => updateLayoutWidth('json', e.target.value, false));
  $('#json-width-slider')?.addEventListener('change', (e) => updateLayoutWidth('json', e.target.value, true));
  $('#reset-layout-btn')?.addEventListener('click', () => {
    state.navigatorWidth = state.layoutDefaults.navigatorWidth;
    state.jsonPanelWidth = state.layoutDefaults.jsonPanelWidth;
    applyAndPersistLayout();
    renderView('settings');
  });
  $('#save-ui-settings-btn')?.addEventListener('click', () => {
    localStorage.setItem('sd-rescripts:tensorboard-url', $('#settings-tb-url')?.value?.trim() || '');
    const checkedOpts = [...$$('#settings-optimizers input:checked')].map((i) => i.value);
    localStorage.setItem('sd-rescripts:visible-optimizers', JSON.stringify(checkedOpts));
    const checkedScheds = [...$$('#settings-schedulers input:checked')].map((i) => i.value);
    localStorage.setItem('sd-rescripts:visible-schedulers', JSON.stringify(checkedScheds));
    showToast('训练 UI 设置已保存。');
  });
}



function renderDataset(container) {
  const activeTab = state.datasetSubTab || 'tagger';
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>数据集处理</h2>
        <p>图片标注、标签编辑、图像预处理、数据集分析与 Caption 清洗。</p>
      </header>
      <div class="dataset-tabs">
        <button class="dataset-tab ${activeTab === 'tagger' ? 'active' : ''}" type="button" onclick="switchDatasetTab('tagger')">标签器</button>
        <button class="dataset-tab ${activeTab === 'editor' ? 'active' : ''}" type="button" onclick="switchDatasetTab('editor')">标签编辑器</button>
        <button class="dataset-tab ${activeTab === 'resize' ? 'active' : ''}" type="button" onclick="switchDatasetTab('resize')">图像预处理</button>
        <button class="dataset-tab ${activeTab === 'analysis' ? 'active' : ''}" type="button" onclick="switchDatasetTab('analysis')">数据集分析</button>
        <button class="dataset-tab ${activeTab === 'cleanup' ? 'active' : ''}" type="button" onclick="switchDatasetTab('cleanup')">Caption 清洗</button>
        <button class="dataset-tab ${activeTab === 'backups' ? 'active' : ''}" type="button" onclick="switchDatasetTab('backups')">Caption 备份</button>
        <button class="dataset-tab ${activeTab === 'maskedloss' ? 'active' : ''}" type="button" onclick="switchDatasetTab('maskedloss')">蒙版损失审查</button>
      </div>
      <div id="dataset-content"></div>
    </div>
  `;
  const renderers = {
    tagger: renderTagger,
    editor: renderTagEditor,
    resize: renderImageResize,
    analysis: renderDatasetAnalysis,
    cleanup: renderCaptionCleanup,
    backups: renderCaptionBackups,
    maskedloss: renderMaskedLossAudit,
  };
  (renderers[activeTab] || renderTagger)();
}

window.switchDatasetTab = (tab) => {
  state.datasetSubTab = tab;
  if (state.activeModule === 'dataset') renderView('dataset');
};


function renderTagger() {
  const content = $('#dataset-content');
  if (!content) return;

  const allInterrogators = state.interrogators?.interrogators || [];
  const defaultModel = state.interrogators?.default || 'wd14-convnextv2-v2';
  const wdModels = allInterrogators.filter((m) => m.kind === 'wd' || m.kind === 'cl');
  const llmModels = allInterrogators.filter((m) => m.kind === 'llm');
  const fallbackModels = [
    'wd-convnext-v3', 'wd-swinv2-v3', 'wd-vit-v3',
    'wd14-convnextv2-v2', 'wd14-swinv2-v2', 'wd14-vit-v2', 'wd14-moat-v2',
    'wd-eva02-large-tagger-v3', 'wd-vit-large-tagger-v3',
    'eva02_large_E621_FULL_V1', 'cl_tagger_1_01',
  ];
  const models = wdModels.length > 0 ? wdModels.map((m) => m.name) : fallbackModels;
  const conflicts = ['ignore', 'copy', 'prepend', 'append'];
  const conflictLabels = { ignore: '跳过已有', copy: '覆盖', prepend: '前置追加', append: '后置追加' };
  const presets = state.interrogators?.llm_template_presets || [
    { id: 'anime-tags', label: '动漫标签 / Anime Tags' },
    { id: 'natural-caption', label: '自然语言描述 / Natural Caption' },
  ];

  content.innerHTML = `
    <!-- WD14 / CL 标签器 -->
    <section class="form-section">
      <header class="section-header"><h3>WD14 / CL 标签器</h3></header>
      <div class="section-summary">对训练数据集进行自动标注，为每张图片生成 .txt 标签文件。使用本地 ONNX 模型运行，无需网络。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('tagger-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="tagger-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>标注模型</label>
          <select id="tagger-model">
            ${models.map((m) => `<option value="${m}" ${m === defaultModel ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="config-group">
          <label>置信度阈值</label>
          <p class="field-desc">模型对标签的最低置信度，低于此值的标签不会写入，简单来说，数值越低打出的标越多。一般推荐 0.5，调低可获得更多标签但可能不准。</p>
          <input class="text-input" type="number" id="tagger-threshold" value="0.5" min="0" max="1" step="0.01">
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
          <div class="label-col"><label>递归扫描子目录</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="tagger-recursive"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>替换下划线为空格</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="tagger-underscore" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>转义括号</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="tagger-escape" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runTagger()">开始标注</button>
      </div>
    </section>

    <!-- LLM 标签器 -->
    <section class="form-section">
      <header class="section-header"><h3>LLM 标签器（大语言模型）</h3></header>
      <div class="section-summary">使用 OpenAI / Claude / 自定义 API 的视觉语言模型对图片进行标注。需要填写 API Key，会消耗 API 额度。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('llm-tagger-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="llm-tagger-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>LLM 提供商</label>
          <select id="llm-provider">
            ${llmModels.length > 0
              ? llmModels.map((m) => `<option value="${m.name}">${m.name}</option>`).join('')
              : '<option value="llm-openai">llm-openai</option><option value="llm-claude">llm-claude</option><option value="llm-custom">llm-custom</option>'
            }
          </select>
        </div>
        <div class="config-group">
          <label>API Key</label>
          <input class="text-input" type="password" id="llm-api-key" placeholder="sk-...">
        </div>
        <div class="config-group">
          <label>模型名称</label>
          <input class="text-input" type="text" id="llm-model" placeholder="gpt-4o-mini / claude-sonnet-4-20250514">
        </div>
        <div class="config-group">
          <label>API 地址</label>
          <p class="field-desc">自定义提供商时必填，OpenAI/Claude 可留空用默认。</p>
          <input class="text-input" type="text" id="llm-api-base" placeholder="https://api.openai.com/v1">
        </div>
        <div class="config-group">
          <label>模板预设</label>
          <select id="llm-preset">
            ${presets.map((p) => `<option value="${p.id}">${escapeHtml(p.label || p.id)}</option>`).join('')}
          </select>
        </div>
        <div class="config-group">
          <label>冲突处理</label>
          <select id="llm-conflict">
            ${conflicts.map((c) => `<option value="${c}" ${c === 'ignore' ? 'selected' : ''}>${conflictLabels[c]}</option>`).join('')}
          </select>
        </div>
        <div class="config-group">
          <label>Temperature</label>
          <input class="text-input" type="number" id="llm-temperature" value="0.2" min="0" max="2" step="0.1">
        </div>
        <div class="config-group">
          <label>最大 Tokens</label>
          <input class="text-input" type="number" id="llm-max-tokens" value="300" min="1" max="8192">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归扫描子目录</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="llm-recursive"><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runLlmTagger()">LLM 开始标注</button>
      </div>
    </section>
  `;
}

window.runLlmTagger = async () => {
  const pathVal = $('#llm-tagger-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  const apiKey = $('#llm-api-key')?.value?.trim();
  if (!apiKey) { showToast('请填写 API Key。'); return; }
  const model = $('#llm-model')?.value?.trim();
  if (!model) { showToast('请填写模型名称。'); return; }
  const params = {
    path: pathVal,
    interrogator_model: $('#llm-provider')?.value || 'llm-openai',
    llm_api_key: apiKey,
    llm_model: model,
    llm_api_base: $('#llm-api-base')?.value?.trim() || '',
    llm_template_preset: $('#llm-preset')?.value || 'anime-tags',
    batch_output_action_on_conflict: $('#llm-conflict')?.value || 'ignore',
    llm_temperature: parseFloat($('#llm-temperature')?.value) || 0.2,
    llm_max_tokens: parseInt($('#llm-max-tokens')?.value) || 300,
    batch_input_recursive: $('#llm-recursive')?.checked || false,
    threshold: 0.5,
  };
  try {
    await api.runInterrogate(params);
    showToast('LLM 标注任务已提交，正在后台运行...');
  } catch (error) {
    showToast(error.message || 'LLM 标注任务启动失败。');
  }
};



window.runTagger = async () => {
  const pathVal = $('#tagger-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  const params = {
    path: pathVal,
    interrogator_model: $('#tagger-model')?.value || 'wd14-convnextv2-v2',
    threshold: parseFloat($('#tagger-threshold')?.value) || 0.5,
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
  const teUrl = `http://${location.hostname}:28001`;
  content.innerHTML = `
    <div id="tageditor-status" style="padding:4px 0 12px;font-size:0.85rem;color:var(--text-dim);"></div>
    <section class="form-section" style="padding:0;overflow:hidden;">
      <header class="section-header">
        <h3>标签编辑器 (Tag Editor)</h3>
        <div style="display:flex;gap:8px;">
          <a class="btn btn-outline btn-sm" href="${teUrl}" target="_blank" rel="noopener">新窗口打开</a>
          <button class="btn btn-outline btn-sm" type="button" onclick="refreshTagEditorIframe()">刷新</button>
        </div>
      </header>
      <iframe id="tageditor-iframe" src="${teUrl}" style="width:100%;height:calc(100vh - 340px);min-height:500px;border:none;background:var(--bg-panel);"></iframe>
    </section>
  `;
  pollTagEditorStatus();
}


async function pollTagEditorStatus() {
  const statusEl = $('#tageditor-status');
  if (!statusEl) return;
  try {
    const data = await api.getTagEditorStatus();
    const labels = {
      ready: '✅ 标签编辑器已就绪',
      starting: '⏳ 标签编辑器正在启动...',
      queued: '⏳ 标签编辑器即将启动...',
      disabled: '⛔ 标签编辑器已禁用（启动时添加了 --disable-tageditor）',
      missing_dependencies: '❌ 依赖未安装，请先运行 install_tageditor',
      missing_launcher: '❌ 文件缺失',
      failed: '❌ 启动失败',
    };
    const text = labels[data.status] || `状态: ${data.status}`;
    statusEl.textContent = text + (data.detail ? ` — ${data.detail}` : '');
    if (!['ready','disabled','failed','missing_dependencies','missing_launcher'].includes(data.status)) {
      setTimeout(pollTagEditorStatus, 2000);
    }
  } catch (e) {
    statusEl.textContent = '无法获取状态';
  }
}

window.refreshTagEditorIframe = () => {
  const iframe = $('#tageditor-iframe');
  if (iframe) iframe.src = `http://${location.hostname}:28001`;
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
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('resize-input-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="resize-input-path" placeholder="选择或输入数据集文件夹路径">
          </div>
          <p class="field-desc">选择或手动输入 train 目录下的数据集文件夹路径。</p>
        </div>
        <div class="config-group" style="grid-column:1/-1;">
          <label>输出目录（留空则覆盖原文件）</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('resize-output', 'folder')">
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
}


window.runImageResize = async () => {
  const inputDir = $('#resize-input-path')?.value?.trim();
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

// ========== 数据集分析 ==========
function renderDatasetAnalysis() {
  const content = $('#dataset-content');
  if (!content) return;
  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>数据集分析</h3></header>
      <div class="section-summary">分析数据集的图片分布、标签统计、分辨率分布等信息。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('analysis-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="analysis-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>Caption 扩展名</label>
          <input class="text-input" type="text" id="analysis-ext" value=".txt">
        </div>
        <div class="config-group">
          <label>Top 标签数</label>
          <input class="text-input" type="number" id="analysis-top" value="40" min="1" max="200">
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runDatasetAnalysis()">开始分析</button>
      </div>
      <div id="analysis-result" style="margin-top:16px;"></div>
    </section>
  `;
}

window.runDatasetAnalysis = async () => {
  const pathVal = $('#analysis-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  const result = $('#analysis-result');
  if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>分析中...</span></div>';
  try {
    const response = await api.analyzeDataset({
      path: pathVal,
      caption_extension: $('#analysis-ext')?.value || '.txt',
      top_tags: parseInt($('#analysis-top')?.value) || 40,
    });
    const data = response?.data;
    if (!data) { if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>无结果</span></div>'; return; }
    if (result) result.innerHTML = `
      <div class="module-list">
        <div class="module-list-item module-list-item-static">
          <div class="module-list-main">
            <strong>图片数量: ${data.total_images ?? '-'}</strong>
            <span class="module-list-meta">有标注: ${data.captioned_images ?? '-'} | 无标注: ${data.uncaptioned_images ?? '-'}</span>
          </div>
        </div>
        ${(data.top_tags || []).map((t) => `
          <div class="module-list-item module-list-item-static">
            <div class="module-list-main"><strong>${escapeHtml(t.tag)}</strong></div>
            <span class="module-list-time">${t.count} 次</span>
          </div>
        `).join('')}
        ${(data.resolution_distribution || []).map((r) => `
          <div class="module-list-item module-list-item-static">
            <div class="module-list-main"><strong>${escapeHtml(r.resolution)}</strong></div>
            <span class="module-list-time">${r.count} 张</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    if (result) result.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '分析失败')}</span></div>`;
  }
};

// ========== Caption 清洗 ==========
function renderCaptionCleanup() {
  const content = $('#dataset-content');
  if (!content) return;
  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>Caption 清洗</h3></header>
      <div class="section-summary">批量清理数据集中的 caption 文件：去重、排序、搜索替换、追加/删除标签等。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('cleanup-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="cleanup-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>Caption 扩展名</label>
          <input class="text-input" type="text" id="cleanup-ext" value=".txt">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归处理子目录</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-recursive" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>去除重复标签</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-dedupe" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>标签排序</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-sort"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>合并空白字符</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-collapse-ws" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>下划线转空格</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-underscore"><span class="slider round"></span></label>
        </div>
        <div class="config-group">
          <label>前置追加标签</label>
          <input class="text-input" type="text" id="cleanup-prepend" placeholder="tag1, tag2">
        </div>
        <div class="config-group">
          <label>后置追加标签</label>
          <input class="text-input" type="text" id="cleanup-append" placeholder="tag1, tag2">
        </div>
        <div class="config-group">
          <label>删除指定标签</label>
          <input class="text-input" type="text" id="cleanup-remove" placeholder="tag_to_remove">
        </div>
        <div class="config-group">
          <label>搜索文本</label>
          <input class="text-input" type="text" id="cleanup-search" placeholder="搜索内容">
        </div>
        <div class="config-group">
          <label>替换文本</label>
          <input class="text-input" type="text" id="cleanup-replace" placeholder="替换为">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>使用正则表达式</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-regex"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>应用前自动备份</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="cleanup-backup" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runCaptionCleanupPreview()">预览变更</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runCaptionCleanupApply()">应用清洗</button>
      </div>
      <div id="cleanup-result" style="margin-top:16px;"></div>
    </section>
  `;
}

function gatherCleanupParams() {
  return {
    path: $('#cleanup-path')?.value?.trim() || '',
    caption_extension: $('#cleanup-ext')?.value || '.txt',
    recursive: $('#cleanup-recursive')?.checked ?? true,
    dedupe_tags: $('#cleanup-dedupe')?.checked ?? true,
    sort_tags: $('#cleanup-sort')?.checked || false,
    collapse_whitespace: $('#cleanup-collapse-ws')?.checked ?? true,
    replace_underscore: $('#cleanup-underscore')?.checked || false,
    prepend_tags: $('#cleanup-prepend')?.value || '',
    append_tags: $('#cleanup-append')?.value || '',
    remove_tags: $('#cleanup-remove')?.value || '',
    search_text: $('#cleanup-search')?.value || '',
    replace_text: $('#cleanup-replace')?.value || '',
    use_regex: $('#cleanup-regex')?.checked || false,
    create_backup_before_apply: $('#cleanup-backup')?.checked ?? true,
  };
}

window.runCaptionCleanupPreview = async () => {
  const params = gatherCleanupParams();
  if (!params.path) { showToast('请先填写数据集路径。'); return; }
  const result = $('#cleanup-result');
  if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>预览中...</span></div>';
  try {
    const response = await api.captionCleanupPreview(params);
    const data = response?.data;
    if (!data) { if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>无结果</span></div>'; return; }
    const summary = data.summary || {};
    const samples = data.samples || [];
    if (result) result.innerHTML = `
      <div class="module-list">
        <div class="module-list-item module-list-item-static">
          <div class="module-list-main">
            <strong>扫描文件: ${summary.total_file_count ?? '-'}</strong>
            <span class="module-list-meta">将变更: ${summary.changed_file_count ?? '-'} | 无变化: ${summary.unchanged_file_count ?? '-'}</span>
          </div>
        </div>
        ${samples.map((s) => `
          <div class="module-list-item module-list-item-static">
            <div class="module-list-main">
              <strong>${escapeHtml(s.file)}</strong>
              <span class="module-list-meta">前: ${escapeHtml(s.before || '')}</span>
              <span class="module-list-meta" style="color:var(--accent);">后: ${escapeHtml(s.after || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    if (result) result.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '预览失败')}</span></div>`;
  }
};

window.runCaptionCleanupApply = async () => {
  const params = gatherCleanupParams();
  if (!params.path) { showToast('请先填写数据集路径。'); return; }
  try {
    const response = await api.captionCleanupApply(params);
    showToast(response?.message || 'Caption 清洗已应用。');
    window.runCaptionCleanupPreview();
  } catch (error) {
    showToast(error.message || 'Caption 清洗失败。');
  }
};

// ========== Caption 备份 ==========
function renderCaptionBackups() {
  const content = $('#dataset-content');
  if (!content) return;
  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>Caption 备份与恢复</h3></header>
      <div class="section-summary">创建数据集 caption 的快照备份，或从已有备份恢复。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('backup-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="backup-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>备份名称</label>
          <input class="text-input" type="text" id="backup-name" placeholder="my-backup">
        </div>
        <div class="config-group">
          <label>Caption 扩展名</label>
          <input class="text-input" type="text" id="backup-ext" value=".txt">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归子目录</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="backup-recursive" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="createCaptionBackup()">创建备份</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="listCaptionBackups()">查看已有备份</button>
      </div>
      <div id="backup-result" style="margin-top:16px;"></div>
    </section>
  `;
}

window.createCaptionBackup = async () => {
  const pathVal = $('#backup-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  try {
    const response = await api.captionBackupCreate({
      path: pathVal,
      caption_extension: $('#backup-ext')?.value || '.txt',
      recursive: $('#backup-recursive')?.checked ?? true,
      snapshot_name: $('#backup-name')?.value?.trim() || '',
    });
    showToast(response?.message || '备份已创建。');
    window.listCaptionBackups();
  } catch (error) {
    showToast(error.message || '备份创建失败。');
  }
};

window.listCaptionBackups = async () => {
  const pathVal = $('#backup-path')?.value?.trim();
  const result = $('#backup-result');
  if (!result) return;
  result.innerHTML = '<div class="builtin-picker-empty"><span>加载中...</span></div>';
  try {
    const response = await api.captionBackupList({ path: pathVal || '' });
    const backups = response?.data?.backups || [];
    if (!backups.length) {
      result.innerHTML = '<div class="builtin-picker-empty"><span>未找到备份</span></div>';
      return;
    }
    result.innerHTML = `
      <div class="module-list">
        ${backups.map((b) => `
          <div class="module-list-item">
            <div class="module-list-main">
              <strong>${escapeHtml(b.archive_name || b.name || '-')}</strong>
              <span class="module-list-meta">${b.file_count ?? '-'} 个文件</span>
            </div>
            <span class="module-list-time">${b.created_at ? new Date(b.created_at).toLocaleString('zh-CN') : '-'}</span>
            <button class="btn btn-outline btn-sm btn-picker-action" type="button" onclick="restoreCaptionBackup('${escapeHtml(b.archive_name || b.name)}')">恢复</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    result.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '读取备份列表失败')}</span></div>`;
  }
};

window.restoreCaptionBackup = async (archiveName) => {
  const pathVal = $('#backup-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  try {
    const response = await api.captionBackupRestore({ path: pathVal, archive_name: archiveName });
    showToast(response?.message || '备份已恢复。');
  } catch (error) {
    showToast(error.message || '备份恢复失败。');
  }
};

// ========== 蒙版损失审查 ==========
function renderMaskedLossAudit() {
  const content = $('#dataset-content');
  if (!content) return;
  content.innerHTML = `
    <section class="form-section">
      <header class="section-header"><h3>蒙版损失数据集审查</h3></header>
      <div class="section-summary">检查数据集中的图像是否包含 Alpha 通道 / 蒙版，用于 masked_loss 训练。</div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="pickPathForInput('maskedloss-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="maskedloss-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归扫描子目录</label></div>
          <label class="switch switch-compact"><input type="checkbox" id="maskedloss-recursive" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runMaskedLossAudit()">开始审查</button>
      </div>
      <div id="maskedloss-result" style="margin-top:16px;"></div>
    </section>
  `;
}

window.runMaskedLossAudit = async () => {
  const pathVal = $('#maskedloss-path')?.value?.trim();
  if (!pathVal) { showToast('请先填写数据集路径。'); return; }
  const result = $('#maskedloss-result');
  if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>审查中...</span></div>';
  try {
    const response = await api.maskedLossAudit({
      path: pathVal,
      recursive: $('#maskedloss-recursive')?.checked ?? true,
    });
    const data = response?.data;
    if (!data) { if (result) result.innerHTML = '<div class="builtin-picker-empty"><span>无结果</span></div>'; return; }
    if (result) result.innerHTML = `
      <div class="module-list">
        <div class="module-list-item module-list-item-static">
          <div class="module-list-main">
            <strong>总图片: ${data.total_images ?? '-'}</strong>
            <span class="module-list-meta">包含 Alpha/Mask: ${data.with_alpha ?? '-'} | 无 Mask: ${data.without_alpha ?? '-'}</span>
          </div>
        </div>
        ${(data.samples || []).map((s) => `
          <div class="module-list-item module-list-item-static">
            <div class="module-list-main">
              <strong>${escapeHtml(s.file || s.name || '-')}</strong>
              <span class="module-list-meta">${s.has_alpha ? '✅ 包含 Alpha' : '❌ 无 Alpha'} | ${s.width}x${s.height}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    if (result) result.innerHTML = `<div class="builtin-picker-empty"><span>${escapeHtml(error.message || '审查失败')}</span></div>`;
  }
};



function renderLogs(container) {
  const customTbUrl = localStorage.getItem('sd-rescripts:tensorboard-url')?.trim();
  const tbUrl = customTbUrl || `http://${location.hostname}:6006`;
  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>TensorBoard</h2>
        <p>训练日志可视化，查看损失曲线、学习率变化与样本图。TensorBoard 已随训练器自动启动。</p>
      </header>
      <section class="form-section" style="padding:0;overflow:hidden;">
        <iframe id="tb-iframe" src="${tbUrl}" style="width:100%;height:calc(100vh - 240px);min-height:500px;border:none;border-radius:12px;background:var(--bg-panel);"></iframe>
      </section>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <a class="btn btn-outline btn-sm" href="${tbUrl}" target="_blank" rel="noopener">在新窗口中打开 TensorBoard</a>
        <button class="btn btn-outline btn-sm" type="button" onclick="document.getElementById('tb-iframe').src='${tbUrl}'">刷新</button>
      </div>
    </div>
  `;
}

function renderTools(container) {
  const tools = [
    {
      id: 'extract_lora',
      title: '从模型提取 LoRA',
      desc: '从两个模型的差异中提取 LoRA 网络权重。',
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
      desc: '将多个 LoRA 按指定权重合并为一个。',
      script: 'networks/merge_lora.py',
      fields: [
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged.safetensors' },
        { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
        { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
    {
      id: 'sdxl_merge_lora',
      title: 'SDXL 合并 LoRA',
      desc: 'SDXL 专用的 LoRA 合并工具。',
      script: 'networks/sdxl_merge_lora.py',
      fields: [
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged_sdxl.safetensors' },
        { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
        { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
    {
      id: 'flux_merge_lora',
      title: 'FLUX 合并 LoRA',
      desc: 'FLUX 专用的 LoRA 合并工具。',
      script: 'networks/flux_merge_lora.py',
      fields: [
     { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged_flux.safetensors' },
        { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
        { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
    {
      id: 'flux_extract_lora',
      title: 'FLUX 提取 LoRA',
      desc: '从 FLUX 模型差异中提取 LoRA。',
      script: 'networks/flux_extract_lora.py',
      fields: [
        { key: 'model_org', label: '原始模型路径', type: 'text', placeholder: '' },
        { key: 'model_tuned', label: '微调模型路径', type: 'text', placeholder: '' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/flux_extracted.safetensors' },
        { key: 'dim', label: '网络维度', type: 'number', placeholder: '16' },
      ],
    },
    {
      id: 'resize_lora',
      title: 'LoRA 缩放 (Resize)',
      desc: '将 LoRA 权重缩放到不同的 dim / rank。',
      script: 'networks/resize_lora.py',
      fields: [
        { key: 'model', label: 'LoRA 模型路径', type: 'text', placeholder: './output/my_lora.safetensors' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/resized.safetensors' },
        { key: 'new_rank', label: '目标 Rank', type: 'number', placeholder: '16' },
        { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
      ],
    },
    {
      id: 'check_lora_weights',
      title: '检查 LoRA 权重',
      desc: '查看 LoRA 文件的权重统计信息。',
      script: 'networks/check_lora_weights.py',
      fields: [
        { key: 'file', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
      ],
    },
    {
      id: 'convert_flux_lora',
      title: '转换 FLUX LoRA 格式',
      desc: '转换 FLUX LoRA 到其他格式。',
      script: 'networks/convert_flux_lora.py',
      fields: [
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/converted.safetensors' },
      ],
    },
    {
      id: 'convert_hunyuan_lora',
      title: '转换混元图像 LoRA 到 ComfyUI',
      desc: '将混元图像 LoRA 转换为 ComfyUI 可用格式。',
      script: 'networks/convert_hunyuan_image_lora_to_comfy.py',
      fields: [
        { key: 'src_path', label: '源文件路径', type: 'text', placeholder: './output/hunyuan_lora.safetensors' },
        { key: 'dst_path', label: '输出路径', type: 'text', placeholder: './output/hunyuan_comfy.safetensors' },
      ],
    },
    {
      id: 'convert_anima_lora',
      title: '转换 Anima LoRA 到 ComfyUI',
      desc: '将 Anima LoRA 转换为 ComfyUI 可用格式。',
      script: 'networks/convert_anima_lora_to_comfy.py',
      fields: [
        { key: 'src_path', label: '源文件路径', type: 'text', placeholder: '' },
        { key: 'dst_path', label: '输出路径', type: 'text', placeholder: '' },
      ],
    },
    {
      id: 'show_metadata',
      title: '查看模型元数据',
      desc: '显示 safetensors/ckpt 文件的元数据信息。',
      script: 'tools/show_metadata.py',
      fields: [
        { key: 'model', label: '模型文件路径', type: 'text', placeholder: './output/model.safetensors' },
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
    {
      id: 'merge_sd3',
      title: '合并 SD3 模型',
      desc: '合并 SD3 safetensors 文件。',
      script: 'tools/merge_sd3_safetensors.py',
      fields: [
        { key: 'model_0', label: '模型 A', type: 'text', placeholder: '' },
        { key: 'model_1', label: '模型 B', type: 'text', placeholder: '' },
        { key: 'save_to', label: '输出路径', type: 'text', placeholder: '' },
      ],
    },
    {
      id: 'convert_diffusers_to_flux',
      title: 'Diffusers 转 FLUX',
      desc: '将 Diffusers 格式转换为 FLUX 格式。',
      script: 'tools/convert_diffusers_to_flux.py',
      fields: [
        { key: 'model_to_load', label: '输入模型路径', type: 'text', placeholder: '' },
        { key: 'model_to_save', label: '输出路径', type: 'text', placeholder: '' },
      ],
    },
    {
      id: 'lora_interrogator',
      title: 'LoRA 识别器',
      desc: '检测 LoRA 网络的训练信息。',
      script: 'networks/lora_interrogator.py',
      fields: [
        { key: 'model', label: 'LoRA 文件路径', type: 'text', placeholder: '' },
      ],
    },
  ];


  const selectedId = state.selectedTool || '';
  const selectedTool = tools.find((t) => t.id === selectedId);

  container.innerHTML = `
    <div class="form-container">
      <header class="section-title">
        <h2>工具箱</h2>
        <p>LoRA 提取、合并等实用工具。选择工具后填写参数并运行。</p>
      </header>
      <div class="config-group">
        <label>选择工具</label>
        <select id="tool-selector">
          <option value="">—— 请选择工具 ——</option>
          ${tools.map((t) => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
        </select>
      </div>
      <div id="tool-detail">
        ${selectedTool ? renderToolDetail(selectedTool) : '<div class="empty-state" style="margin-top:12px;"><strong>请在上方下拉菜单中选择一个工具</strong></div>'}
      </div>
    </div>
  `;

  $('#tool-selector')?.addEventListener('change', (e) => {
    state.selectedTool = e.target.value;
    const detail = $('#tool-detail');
    const tool = tools.find((t) => t.id === e.target.value);
    if (detail) {
      detail.innerHTML = tool ? renderToolDetail(tool) : '<div class="empty-state"><strong>请在上方下拉菜单中选择一个工具</strong></div>';
    }
  });
}

function renderToolDetail(tool) {
  const isPathField = (f) => /model|path|save_to|file|src_|dst_/.test(f.key);
  return `
    <section class="form-section tool-section" id="tool-${tool.id}" style="margin-top:16px;">
      <header class="section-header">
        <h3>${escapeHtml(tool.title)}</h3>
      </header>
      <div class="section-summary">${escapeHtml(tool.desc)}</div>
      <div class="section-content tool-fields">
        ${tool.fields.map((f) => {
          const inputId = `tool-${tool.id}-${f.key}`;
          if (isPathField(f)) {
            return `
          <div class="config-group">
            <label>${escapeHtml(f.label)}</label>
            <div class="input-picker">
              <button class="picker-icon" type="button" onclick="pickPathForInput('${inputId}', '${f.key.includes('save') || f.key.includes('dst') ? 'folder' : 'model-file'}')">
                <svg class="icon"><use href="#icon-folder"></use></svg>
              </button>
              <input class="text-input" type="${f.type}" id="${inputId}" placeholder="${escapeHtml(f.placeholder || '')}">
            </div>
          </div>`;
          }
          return `
          <div class="config-group">
            <label>${escapeHtml(f.label)}</label>
            <input class="text-input" type="${f.type}" id="${inputId}" placeholder="${escapeHtml(f.placeholder || '')}">
          </div>`;
        }).join('')}
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runTool('${tool.id}', '${escapeHtml(tool.script)}', ${JSON.stringify(tool.fields.map((f) => f.key)).replaceAll('"', '&quot;')})">运行</button>
      </div>
    </section>
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

window.pickPathForInput = async (inputId, pickerType) => {
  try {
    const response = await api.pickFile(pickerType);
    if (response.status !== 'success') {
      showToast(response.message || '选择路径失败。');
      return;
    }
    const input = $(`#${inputId}`);
    if (input) {
      input.value = response.data.path;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch (error) {
    showToast(error.message || '选择路径失败。');
  }
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
    const response = await api.runPreflight(buildRunConfig(state.config, state.activeTrainingType));
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
      api.runPreflight(buildRunConfig(state.config, state.activeTrainingType)),
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
  if (footer) footer.innerHTML = `
    <button class="btn btn-outline btn-sm" type="button" onclick="refreshBuiltinPicker()">🔄 刷新</button>
    <button class="btn btn-outline btn-sm" type="button" onclick="closeBuiltinPicker()">取消</button>
  `;
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
  if (state.builtinPicker.loading) {
    list.innerHTML = `<div class="builtin-picker-empty"><span>⏳ 加载中...</span></div>`;
    return;
  }
  if (!state.builtinPicker.items || !state.builtinPicker.items.length) {
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
  state.builtinPicker = { open: true, fieldKey, pickerType, rootLabel: '', items: [], loading: true };
  renderBuiltinPickerModal();
  api.getBuiltinPicker(pickerType)
    .then((response) => {
      state.builtinPicker = {
        open: true,
        fieldKey,
        pickerType,
        rootLabel: response?.data?.rootLabel || '',
        items: response?.data?.items || [],
        loading: false,
      };
      renderBuiltinPickerModal();
    })
    .catch((error) => {
      state.builtinPicker.open = false;
      renderBuiltinPickerModal();
      showToast(error.message || '打开内置文件选择器失败。');
    });
};

window.closeBuiltinPicker = () => {
  state.builtinPicker.open = false;
  renderBuiltinPickerModal();
};
window.refreshBuiltinPicker = () => {
  if (!state.builtinPicker.open) return;
  const { fieldKey, pickerType } = state.builtinPicker;
  state.builtinPicker.loading = true;
  state.builtinPicker.items = [];
  renderBuiltinPickerModal();
  api.getBuiltinPicker(pickerType)
    .then((response) => {
      state.builtinPicker = {
        open: true, fieldKey, pickerType,
        rootLabel: response?.data?.rootLabel || '',
        items: response?.data?.items || [],
        loading: false,
      };
      renderBuiltinPickerModal();
    })
    .catch(() => {
      state.builtinPicker.loading = false;
      renderBuiltinPickerModal();
      showToast('刷新失败');
    });
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

window.switchTrainingType = (typeId) => {
  if (typeId === state.activeTrainingType) return;
  state.activeTrainingType = typeId;
  localStorage.setItem('sd-rescripts:training-type', typeId);
  // 重建配置，保留共用字段的当前值
  const oldConfig = { ...state.config };
  state.config = createDefaultConfig(typeId);
  for (const key of Object.keys(state.config)) {
    if (key === 'model_train_type') continue;
    if (oldConfig[key] !== undefined && oldConfig[key] !== '') {
      state.config[key] = oldConfig[key];
    }
  }
  state.hasLocalDraft = false;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  resetTransientState();
  saveDraft();
  if (state.activeModule === 'config') {
    renderView('config');
  } else {
    updateJSONPreview();
  }
};


window.resetAllParams = () => {
  state.config = createDefaultConfig(state.activeTrainingType);
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
      const payload = buildRunConfig(state.config, state.activeTrainingType);
      payload.__training_type__ = state.activeTrainingType;
      await api.saveConfig(name, payload);
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
    // 自动切换训练类型
    const savedType = data.__training_type__ || data.model_train_type || '';
    delete data.__training_type__;
    if (savedType && savedType !== state.activeTrainingType) {
      const typeExists = TRAINING_TYPES.some((t) => t.id === savedType);
      if (typeExists) {
        state.activeTrainingType = savedType;
        localStorage.setItem('sd-rescripts:training-type', savedType);
        state.config = createDefaultConfig(savedType);
      }
    }
    mergeConfigPatch(data);
    state.hasLocalDraft = true;
    resetTransientState();
    saveDraft();
    window.closeBuiltinPicker();
    showToast(`已载入参数：${name}${savedType ? ` (${savedType})` : ''}`);
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
  const blob = new Blob([JSON.stringify(buildRunConfig(state.config, state.activeTrainingType), null, 2)], { type: 'application/json;charset=utf-8' });
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
  if (state.activeModule === 'config') renderView('config');
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
  syncConfigState();
  if (state.activeModule === 'config') renderView('config');
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

function validateConfigConflicts() {
  const c = state.config;
  const tt = state.activeTrainingType;
  const errors = [];
  const toBool = (v) => v === true || v === 'true' || v === 1;
  const toNum = (v) => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };

  // 1. 缓存文本编码器输出 与 标签打乱/丢弃 冲突
  if (toBool(c.cache_text_encoder_outputs)) {
    const conflicts = [];
    if (toBool(c.shuffle_caption)) conflicts.push('随机打乱标签');
    if (toNum(c.caption_dropout_rate) > 0) conflicts.push('全部标签丢弃概率');
    if (toNum(c.caption_tag_dropout_rate) > 0) conflicts.push('按标签丢弃概率');
    if (toNum(c.token_warmup_step) > 0) conflicts.push('Token 预热步数');
    if (conflicts.length > 0) {
      errors.push(`缓存文本编码器输出时不能同时使用「${conflicts.join('」「')}」。请关闭「缓存文本编码器输出」或关闭「${conflicts.join('」「')}」。`);
    }
  }

  // 2. 缓存文本编码器输出 与 训练文本编码器 冲突
  if (toBool(c.cache_text_encoder_outputs) && !toBool(c.network_train_unet_only)) {
    errors.push('训练文本编码器时不能同时启用「缓存文本编码器输出」。请先关闭该缓存或开启「仅训练 U-Net」。');
  }

  // 3. 磁盘缓存暗示内存缓存
  if (toBool(c.cache_text_encoder_outputs_to_disk) && !toBool(c.cache_text_encoder_outputs)) {
    errors.push('「缓存文本编码器输出到磁盘」已开启但「缓存文本编码器输出」未开启。请一并勾选「缓存文本编码器输出」。');
  }

  // 4. 注意力后端全部未开启
  if (!toBool(c.xformers) && !toBool(c.sdpa) && !toBool(c.sageattn) && !toBool(c.mem_eff_attn)) {
    errors.push('未启用任何注意力加速后端（xformers / SDPA / SageAttention）。训练将极度缓慢且显存占用极高。请至少开启 SDPA。');
  }

  // 5. SageAttention 训练警告
  if (toBool(c.sageattn)) {
    errors.push('⚠️ SageAttention v1 使用量化注意力，训练精度可能不足（loss 异常、生图全黑）。强烈建议训练时用 SDPA。');
  }

  // 6. xformers + SDPA 同时开启
  if (toBool(c.xformers) && toBool(c.sdpa)) {
    // 不阻断，但给提示（这里不加 error，只在 preflight 里显示 g）
  }

  // 7. 桶划分单位校验
  const bucketStep = toNum(c.bucket_reso_steps) || 64;
  if ((tt.startsWith('sdxl') || tt === 'sdxl-controlnet') && bucketStep % 32 !== 0) {
    errors.push(`SDXL 训练的桶划分单位必须是 32 的倍数，当前值 ${bucketStep} 不符合。`);
  }
  if ((tt.startsWith('sd-') || tt === 'sd-dreambooth') && bucketStep % 64 !== 0) {
    errors.push(`SD1.5 训练的桶划分单位必须是 64 的倍数，当前值 ${bucketStep} 不符合。`);
  }

  // 8. 仅训练 U-Net 和 仅训练文本编码器 同时勾选
  if (toBool(c.network_train_unet_only) && toBool(c.network_train_text_encoder_only)) {
    errors.push('不能同时勾选「仅训练 U-Net」和「仅训练文本编码器」。请只保留其中一个，或两个都不勾（即两者都训练）。');
  }

  return errors;
}


window.executeTraining = async () => {
  state.loading.run = true;
  syncFooterAction();

  const clientErrors = validateConfigConflicts();
  if (clientErrors.length > 0) {
    showToast(clientErrors[0]);
    state.preflight = { can_start: false, errors: clientErrors, warnings: [] };
    state.loading.run = false;
    if (state.activeModule === 'config') renderView('config');
    return;
  }

  try {
    const preflightResponse = await api.runPreflight(buildRunConfig(state.config, state.activeTrainingType));
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
    const response = await api.runTraining(buildRunConfig(state.config, state.activeTrainingType));
    if (response.status !== 'success') {
      showToast(response.message || '训练启动失败。');
      return;
    }

    state.trainingFailed = false;
    state.lastMessage = response.message || '训练已启动。';
    showToast(state.lastMessage);
    const tasksResponse = await api.getTasks();
    state.tasks = tasksResponse?.data?.tasks || [];
  } catch (error) {
    showToast(error.message || '训练请求失败。');
  } finally {
    state.loading.run = false;
    if (state.activeModule === 'training') {
      renderView('training');
    } else if (state.activeModule === 'config') {
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
