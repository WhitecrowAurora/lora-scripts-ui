// renderers/configForm.js — 配置表单渲染器
// 整合 11 个紧密耦合的函数：renderSection、renderField、renderFieldDescription
// + 5 个 SectionContent 子函数（dataset / caption / network / optimizer / training）
// + 3 个 group 子函数（NetworkOptionGroup / CaptionTagDropoutGroup / RegularizationFieldGroup）
//
// 依赖（通过工厂参数注入）：
//   - state（读 state.config 等）
//   - canUseBuiltinPicker（业务逻辑：判断字段是否能用内置选择器）
//   - isFieldVisible（来自 sdxlSchema.js）
//   - COLLAPSIBLE_FIELD_KEYS（来自 utils/constants.js）
//
// 注：大量内联 onclick="updateConfigValue(...)" / "pickPath(...)" / "openNativePicker(...)"
//     依赖 window.* 全局函数，Stage 5 才转事件委托。

import { escapeHtml } from '../utils/dom.js';
import {
  resolveFieldLabel,
  resolveFieldDesc,
  resolveOptionLabel,
  resolveSectionTitle,
} from '../schemaFieldI18n.js';
import { api } from '../api.js';
import { createWeightComposerActions, renderWeightComposerPreview, scheduleWeightComposerPreview } from './weightComposerPreview.js';
import { createTrainingIntentProfileActions, renderTrainingIntentProfilePreview } from './trainingIntentProfilePreview.js';
import { renderProgressivePhaseEditorField } from './progressivePhaseEditor.js';
import { renderOrderedMultiSelectField } from './orderedMultiSelect.js';
import { attentionBackendBlockReason, makeAttentionOptions } from '../features/attentionCapabilities.js';
import { deviceOptions } from '../features/deviceOptions.js';
import {
  optionConstraints,
  runtimeAdvisoryNote,
  runtimeForcedReason,
} from '../features/runtimeFieldConstraints.js';
import {
  renderCaptionSettingsContentLayout,
  renderDatasetSettingsContentLayout,
  renderNetworkSettingsContentLayout,
  renderOptimizerSettingsContentLayout,
  renderTrainingSettingsContentLayout,
} from './configSectionLayouts.js';
import {
  getFieldConflict as getTemplateFieldConflict,
  getPreviewGroupsForRender as getTemplatePreviewGroupsForRender,
  isDependencyConflict,
  renderCaptionTagDropoutGroup as renderCaptionTagDropoutGroupTemplate,
  renderConflictHint,
  renderFieldDescription as renderFieldDescriptionTemplate,
  renderGhostReplayHelperCard as renderGhostReplayHelperCardTemplate,
  renderNetworkOptionGroup as renderNetworkOptionGroupTemplate,
  renderPreviewGroupsField as renderPreviewGroupsFieldTemplate,
  renderRegularizationFieldGroup as renderRegularizationFieldGroupTemplate,
  renderSemanticRegionWeightsField,
  toBool,
} from './configFormTemplates.js';

const VRAM_PROFILE_MANAGED_MESSAGE = '受训练显存档位影响，目前已调整为配置值';

export function createConfigFormRenderer({
  state,
  canUseBuiltinPicker,
  isFieldVisible,
  COLLAPSIBLE_FIELD_KEYS,
  getDisplayConfig,
  isManagedField,
}) {
  const configForRender = () => getDisplayConfig?.() || state.config || {};
  const managedField = (key) => Boolean(isManagedField?.(key));
  function renderFieldDescription(field, lang = state.lang) {
    return renderFieldDescriptionTemplate(
      field,
      lang,
      field?.disabled
        ? String(field.disabledReason || '')
        : managedField(field.key) ? VRAM_PROFILE_MANAGED_MESSAGE : '',
      // 英文的 `key@typeId` override 要用当前训练类型才查得到。这个漏斗覆盖 configForm 里
      // 全部 desc 渲染,包括作为回调传进 configFormTemplates 的那两处。
      state.activeTrainingType,
    );
  }

  function renderGhostReplayHelperCard() {
    if (!configForRender().lulynx_ghost_replay) {
      return '';
    }
    return renderGhostReplayHelperCardTemplate(state.ghostReplayRecorder || {});
  }

  function getPreviewGroupsForRender() {
    return getTemplatePreviewGroupsForRender(configForRender());
  }

  function renderPreviewGroupsField(field, disabledAttr, disabledCls, modCls, conflictWith, renderHeader) {
    return renderPreviewGroupsFieldTemplate({
      field,
      groups: getPreviewGroupsForRender(),
      disabledAttr,
      disabledCls,
      modCls,
      conflictWith,
      renderHeader,
      renderFieldDescription,
      renderConflictHint,
      lang: state.lang,
    });
  }

  // 留空到底继承了谁,由后端与 apply_launcher_gpu_default 同源报出来,不在这里猜。
  function deviceEmptyHint() {
    const inherited = String(state.runtime?.runtime?.launcher_selection || '').trim();
    return inherited
      ? `未选择显卡（留空＝继承 launcher 启动时选择的：${inherited}）`
      : '未选择显卡（launcher 未指定，将使用全部可见显卡）';
  }

  // 逐选项的运行时约束(如 rocm-amd 上那几个 8bit / paged 优化器)。字段自己的静态理由
  // 更具体,所以已有 disabledReason 的不覆盖。
  function applyRuntimeOptionBlocks(field, options) {
    const blocked = optionConstraints(field, state.executionProfiles, runtimeConstraintContext());
    if (!Object.keys(blocked).length) return options;
    return options.map((option) => {
      const isObject = option && typeof option === 'object';
      const value = String(isObject ? option.value : option);
      if (!blocked[value]) return option;
      const base = isObject ? { ...option } : { value };
      return { ...base, disabled: true, disabledReason: base.disabledReason || blocked[value] };
    });
  }

  function resolveFieldOptions(field) {
    const config = configForRender();
    // 设备表来自机器,不是 schema 写死的候选集
    if (field.deviceListOptions) return deviceOptions(state.runtime?.cards);
    const source = typeof field.options === 'function'
      ? field.options(config)
      : field.options;
    const options = source && typeof source !== 'string' && source[Symbol.iterator]
      ? Array.from(source)
      : [];
    if (field.attentionBackendOptions) {
      return applyRuntimeOptionBlocks(field, makeAttentionOptions(options, state.executionProfiles, {
        ...config,
        activeTrainingType: state.activeTrainingType,
        runtime: state.runtime,
        lang: state.lang,
      }));
    }
    return applyRuntimeOptionBlocks(field, options);
  }

  function runtimeConstraintContext() {
    return {
      ...configForRender(),
      activeTrainingType: state.activeTrainingType,
      runtime: state.runtime,
      lang: state.lang,
    };
  }

  function getAttentionBackendBlocker(field) {
    return attentionBackendBlockReason(field, state.executionProfiles, runtimeConstraintContext());
  }

  function getFieldConflict(field) {
    return getTemplateFieldConflict(field, configForRender());
  }

  function renderField(field) {
    const config = configForRender();
    const value = config[field.key];
    const label = resolveFieldLabel(field, state.lang, state.activeTrainingType);
    const defaultValue = field.defaultValue ?? '';
    if (field.type === 'ui_group') {
      return `
        <div class="config-group group-heading" data-field-key="${field.key}">
          <div class="group-heading-title">${escapeHtml(label || '')}</div>
          ${(resolveFieldDesc(field, state.lang, state.activeTrainingType) || field.desc) ? `<p class="group-heading-desc">${escapeHtml(resolveFieldDesc(field, state.lang, state.activeTrainingType) || field.desc)}</p>` : ''}
        </div>
      `;
    }
    if (field.type === 'action') {
      const summaryRaw = config[field.summaryKey] || '';
      const summary = summaryRaw ? String(summaryRaw) : '';
      const handler = String(field.handler || '').replace(/'/g, "\\'");
      return `
        <div class="config-group config-action-field-compact" data-field-key="${field.key}">
          <div class="action-field-content">
            <div class="action-field-header">
              <label><span>${escapeHtml(label || '')}</span></label>
            </div>
            ${resolveFieldDesc(field, state.lang, state.activeTrainingType) ? `<p class="action-field-desc">${escapeHtml(resolveFieldDesc(field, state.lang, state.activeTrainingType))}</p>` : ''}
          </div>
          <div class="action-field-button-wrapper">
            <button class="btn btn-outline config-action-btn-full" type="button" onclick="${handler ? `window['${handler}'] && window['${handler}']()` : ''}">
              ${escapeHtml(field.buttonLabel || '打开')}
            </button>
          </div>
          ${summary ? `<p class="action-field-summary">${escapeHtml(summary)}</p>` : ''}
        </div>
      `;
    }
    const isPicker = field.type === 'file' || field.type === 'folder';
    const isModified = String(value ?? '') !== String(defaultValue);
    const showBuiltinPicker = canUseBuiltinPicker(field);
    const canUndo = Object.hasOwn(state.fieldUndo, field.key);
    const canReset = String(value ?? '') !== String(defaultValue ?? '');
    const pickerMode = field.pickerType || field.type;
    const builtinPickerIcon = (pickerMode === 'folder' || pickerMode === 'output-folder') ? '#icon-folder' : '#icon-file';
    const attentionBackendBlocker = getAttentionBackendBlocker(field);
    // 当前运行时会强制覆盖这个字段(forced)⇒ 与冲突同等对待,置灰并给理由;
    // advisory(如 rocm-amd 的 mixed_precision:只有 BF16 不可用时才降 fp16,而 fp16 正是
    // 这条路线想要的档)只出提示,置灰它等于把用户锁在选不了 fp16 的状态。
    const runtimeForced = runtimeForcedReason(field, state.executionProfiles, runtimeConstraintContext());
    const runtimeAdvisory = runtimeAdvisoryNote(field, state.executionProfiles, runtimeConstraintContext());
    const conflictWith = getFieldConflict(field) || attentionBackendBlocker || runtimeForced || runtimeAdvisory;
    const keepActiveAttentionToggleEditable = field.type === 'boolean' && attentionBackendBlocker && toBool(value);
    // execution_backend 拿到冲突时只出提示,不置灰整个下拉框:互斥的是 thunder /
    // torch_compile 两个选项(由逐 option disabled 拦住),optimized / eager 是化解冲突的
    // 出路。整个禁掉等于把选了编译后端的用户锁在冲突态里,只能回头去关 module offload。
    // 这与布尔字段"已开可关"是同一条原则:永远留一条退出路径。
    const keepBackendSelectEditable = field.key === 'execution_backend';
    // 梯度检查点拿到的是"流式 block 驻留档依赖它",不是互斥 —— 后端对这个组合让跑、只发
    // 警告说槽位预算无效。置灰会把它变成硬锁,用户连关都关不掉,与后端裁决不符:提示照出,
    // 复选框仍可点。判据取依赖型前缀而不是字段名:同一字段在模块级 Offload / Layer Swap
    // 下还有一条真互斥规则,那条得继续置灰。
    const keepDependedOnToggleEditable = isDependencyConflict(conflictWith);
    // advisory 走的是同一条提示位,但不能夺走控制权 —— 与上面三条 keep* 同一条原则。
    const keepRuntimeAdvisoryEditable = Boolean(runtimeAdvisory)
      && !getFieldConflict(field) && !attentionBackendBlocker && !runtimeForced;
    const profileManaged = managedField(field.key);
    // schema 自己锁死的控件（后端对非默认值直接 400）走与显存档接管同一条置灰路，
    // 只是理由文案由字段自带。上面那四条 keep* 不适用：那些讲的是「后端让跑、只发警告」。
    const schemaLocked = Boolean(field?.disabled);
    const conflictDisabled = conflictWith
      && !keepActiveAttentionToggleEditable
      && !keepBackendSelectEditable
      && !keepDependedOnToggleEditable
      && !keepRuntimeAdvisoryEditable;
    const disabledAttr = schemaLocked || profileManaged || conflictDisabled ? ' disabled' : '';
    const fieldKeyArg = escapeHtml(JSON.stringify(String(field.key || '')));
    const renderHeader = () => `
      <div class="field-header-row">
        <label>
          <span>${escapeHtml(label)}</span>
          <button class="field-help-btn" type="button" title="查看参数说明" aria-label="查看参数说明" onclick="event.preventDefault(); event.stopPropagation(); openTrainingOptionHelp(${fieldKeyArg})">?</button>
        </label>
        <div class="field-inline-actions" data-field-key="${field.key}">
          <button class="field-menu-toggle" type="button" title="${profileManaged ? VRAM_PROFILE_MANAGED_MESSAGE : '参数更多操作'}" data-field-menu-key="${field.key}"${profileManaged ? ' disabled' : ''}>···</button>
          ${showBuiltinPicker ? `<button class="picker-mode-icon-btn" type="button" title="${profileManaged ? VRAM_PROFILE_MANAGED_MESSAGE : '内置文件选择器'}"${profileManaged ? ' disabled' : ''} onclick="openNativePicker('${field.key}', '${pickerMode}')"><svg class="icon"><use href="${builtinPickerIcon}"></use></svg></button>` : ''}
        </div>
      </div>
    `;

    const modCls = isModified ? ' field-modified' : '';
    const disabledCls = disabledAttr ? ' field-disabled' : '';
    const renderCollapsibleField = (bodyHtml) => {
      const rawSummaryValue = value === undefined || value === null || value === '' ? '' : String(value);
      const summaryValue = rawSummaryValue || '未设置';
      const summaryClass = rawSummaryValue ? '' : ' is-empty';
      return `
        <details class="config-group collapsible-field${modCls}${disabledCls}" data-field-key="${field.key}">
          <summary class="collapsible-field-summary">
            <span class="collapsible-field-title">${escapeHtml(label)}</span>
            <span class="collapsible-field-value${summaryClass}">${escapeHtml(summaryValue)}</span>
            <span class="collapsible-caret" aria-hidden="true">⌄</span>
          </summary>
          ${resolveFieldDesc(field, state.lang, state.activeTrainingType) ? `<p class="field-desc collapsible-field-desc">${escapeHtml(resolveFieldDesc(field, state.lang, state.activeTrainingType))}</p>` : ''}
          <div class="collapsible-field-body">
            ${bodyHtml}
          </div>
        </details>
      `;
    };

    if (field.type === 'boolean') {
      return `
        <div class="config-group row boolean-card${modCls}${disabledCls}" data-field-key="${field.key}">
          <div class="label-col">
            ${renderHeader()}
            ${renderFieldDescription(field, state.lang)}
            ${renderConflictHint(conflictWith)}
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" ${value ? 'checked' : ''}${disabledAttr} onchange="updateConfigValue('${field.key}', this.checked)">
            <span class="slider round"></span>
          </label>
        </div>
      `;
    }

    if (field.type === 'select') {
      const optionValue = (option) => (option && typeof option === 'object') ? option.value : option;
      const optionLabel = (option) => {
        const resolved = resolveOptionLabel(field.key, option, state.lang);
        if (resolved != null && String(resolved).trim()) return resolved;
        if (option && typeof option === 'object') return option.label ?? option.value ?? '默认';
        return option || '默认';
      };
      const optionDisabled = (option) => Boolean(option && typeof option === 'object' && option.disabled);
      const optionTitle = (option) => option && typeof option === 'object' ? (option.disabledReason || option.title || '') : '';
      const renderOption = (option) => {
        const optionVal = optionValue(option);
        const title = optionTitle(option);
        return `<option value="${escapeHtml(optionVal)}" ${String(value) === String(optionVal) ? 'selected' : ''}${optionDisabled(option) ? ' disabled' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${escapeHtml(optionLabel(option))}</option>`;
      };
      const ensureCurrentOption = (options) => {
        const current = value === undefined || value === null ? '' : String(value);
        if (!current || options.some((option) => String(optionValue(option)) === current)) {
          return options;
        }
        return [current, ...options];
      };
      let filteredOptions = ensureCurrentOption(resolveFieldOptions(field));
      if (COLLAPSIBLE_FIELD_KEYS.has(field.key)) {
        return renderCollapsibleField(`
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <select${disabledAttr} onchange="updateConfigValue('${field.key}', this.value)">
            ${filteredOptions.map(renderOption).join('')}
          </select>
        `);
      }
      return `
        <div class="config-group${modCls}${disabledCls}" data-field-key="${field.key}">
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <select${disabledAttr} onchange="updateConfigValue('${field.key}', this.value)">
            ${filteredOptions.map(renderOption).join('')}
          </select>
        </div>
      `;
    }

    if (field.type === 'preview_groups') {
      return renderPreviewGroupsField(field, disabledAttr, disabledCls, modCls, conflictWith, renderHeader);
    }

    if (field.type === 'semantic_region_weights') {
      return renderSemanticRegionWeightsField({
        field,
        value,
        disabledAttr,
        disabledCls,
        modCls,
        conflictWith,
        config,
        segmentationUi: state.semanticSegmentationUi,
        renderHeader,
        renderFieldDescription,
        renderConflictHint,
      });
    }
    if (field.type === 'progressive_phase_editor') {
      return renderProgressivePhaseEditorField({
        field,
        value,
        editorUi: state.progressivePhaseEditorUi,
        disabledAttr,
        disabledCls,
        modCls,
        conflictWith,
        renderHeader,
        renderFieldDescription,
        renderConflictHint,
      });
    }
    if (field.type === 'ordered_multiselect') {
      // 只有设备表这一种候选集来自机器;其余字段的候选集在 ORDERED_MULTISELECT_CATALOGS
      // 里按 key 反查,塞一个空 options 进去会把它们的候选池清空(空数组也是 truthy)。
      // 显卡表读不到时干脆不渲染这个控件:候选池空着,连手填这条唯一的路也被拿走了。
      // 那种情况落到函数末尾的通用输入框,行为回到改动之前。
      const deviceOverride = field.deviceListOptions ? resolveFieldOptions(field) : null;
      if (!deviceOverride || deviceOverride.length) return renderOrderedMultiSelectField({
        field: deviceOverride
          ? { ...field, options: deviceOverride, emptyHint: deviceEmptyHint() }
          : field,
        value,
        disabledAttr,
        disabledCls,
        modCls,
        conflictWith,
        renderHeader,
        renderFieldDescription,
        renderConflictHint,
        lang: state.lang,
      });
    }
    if (field.type === 'textarea') {
      if (COLLAPSIBLE_FIELD_KEYS.has(field.key)) {
        return renderCollapsibleField(`
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <textarea class="text-area"${disabledAttr} oninput="updateConfigValue('${field.key}', this.value)">${escapeHtml(value || '')}</textarea>
        `);
      }
      return `
        <div class="config-group${modCls}${disabledCls}" data-field-key="${field.key}">
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <textarea class="text-area"${disabledAttr} oninput="updateConfigValue('${field.key}', this.value)">${escapeHtml(value || '')}</textarea>
        </div>
      `;
    }

    const inputType = field.type === 'number' || field.type === 'slider' ? 'number' : 'text';
    const inputValue = value === undefined || value === null ? '' : value;

    if (isPicker) {
      const renderPickerButtons = () => `
        <button class="picker-icon" type="button"${disabledAttr} title="${field.allowModelDirectory ? '选择文件' : '选择路径'}" onclick="pickPath('${field.key}', '${field.pickerType || 'folder'}')">
          <svg class="icon"><use href="#icon-${field.type === 'folder' ? 'folder' : 'file'}"></use></svg>
        </button>
        ${field.allowModelDirectory ? `
          <button class="picker-icon" type="button"${disabledAttr} title="选择模型目录" onclick="pickPath('${field.key}', 'folder')">
            <svg class="icon"><use href="#icon-folder"></use></svg>
          </button>
        ` : ''}
      `;
      if (COLLAPSIBLE_FIELD_KEYS.has(field.key)) {
        return renderCollapsibleField(`
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <div class="input-picker">
            ${renderPickerButtons()}
            <input type="text" value="${escapeHtml(inputValue)}"${disabledAttr} oninput="updateConfigValue('${field.key}', this.value)">
          </div>
        `);
      }
      return `
        <div class="config-group${modCls}${disabledCls}" data-field-key="${field.key}">
          ${renderHeader()}
          ${renderFieldDescription(field, state.lang)}
          ${renderConflictHint(conflictWith)}
          <div class="input-picker">
            ${renderPickerButtons()}
            <input type="text" value="${escapeHtml(inputValue)}"${disabledAttr} oninput="updateConfigValue('${field.key}', this.value)">
          </div>
        </div>
      `;
    }



    if (COLLAPSIBLE_FIELD_KEYS.has(field.key)) {
      return renderCollapsibleField(`
        ${renderHeader()}
        ${renderFieldDescription(field, state.lang)}
        ${renderConflictHint(conflictWith)}
        <input class="text-input" type="${inputType}" value="${escapeHtml(inputValue)}"${disabledAttr} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : ''} oninput="updateConfigValue('${field.key}', this.value)">
      `);
    }

    return `
      <div class="config-group${modCls}${disabledCls}" data-field-key="${field.key}">
        ${renderHeader()}
        ${renderFieldDescription(field, state.lang)}
        ${renderConflictHint(conflictWith)}
        <input class="text-input" type="${inputType}" value="${escapeHtml(inputValue)}"${disabledAttr} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : ''} oninput="updateConfigValue('${field.key}', this.value)">
      </div>
    `;
  }

  function renderNetworkOptionGroup(title, note, fields, dataFieldKey) {
    return renderNetworkOptionGroupTemplate({ title, note, fields, dataFieldKey, config: configForRender(), renderField });
  }

  function renderCaptionTagDropoutGroup(fields) {
    return renderCaptionTagDropoutGroupTemplate({ fields, config: configForRender(), renderField });
  }

  function renderRegularizationFieldGroup(regField, priorField) {
    return renderRegularizationFieldGroupTemplate({ regField, priorField, config: configForRender() });
  }

  function renderDatasetSettingsContent(fields) {
    return renderDatasetSettingsContentLayout({ fields, renderField, renderRegularizationFieldGroup });
  }

  function renderCaptionSettingsContent(fields) {
    return renderCaptionSettingsContentLayout({ fields, renderField, renderCaptionTagDropoutGroup });
  }

  function renderNetworkSettingsContent(fields) {
    return renderNetworkSettingsContentLayout({ fields, config: configForRender(), renderField, renderNetworkOptionGroup });
  }

  function renderOptimizerSettingsContent(fields) {
    return renderOptimizerSettingsContentLayout({ fields, renderField });
  }

  function renderTrainingSettingsContent(fields) {
    return renderTrainingSettingsContentLayout({ fields, config: configForRender(), renderField });
  }

  function renderSection(section) {
    const config = configForRender();
    const fields = section.fields.filter((field) => field.type !== 'hidden' && isFieldVisible(field, config));
    const realFieldCount = fields.filter((field) => field.type !== 'ui_group').length;
    const sectionTitle = resolveSectionTitle(section, state.lang);
    const sectionDescription = section.id === 'noise-settings'
      ? (state.lang === 'en'
        ? `Improves LoRA brightness balance ${section.description || ''}`.trim()
        : `改善lora明暗度 ${section.description || ''}`.trim())
      : section.description;
    const content = section.id === 'dataset-settings'
      ? renderDatasetSettingsContent(fields)
      : section.id === 'caption-settings'
        ? renderCaptionSettingsContent(fields)
        : section.id === 'network-settings'
          ? renderNetworkSettingsContent(fields)
          : section.id === 'optimizer-settings'
            ? renderOptimizerSettingsContent(fields)
            : section.id === 'training-settings'
              ? renderTrainingSettingsContent(fields)
        : fields.map((field) => renderField(field)).join('');
    const showGhostReplayHelper = !!(
      config.lulynx_ghost_replay
      && fields.some((field) => String(field.key || '').startsWith('lulynx_ghost_'))
    );
    const contentWithHelpers = content
      + (showGhostReplayHelper ? renderGhostReplayHelperCard() : '')
      + (section.id === 'weight-composer' ? renderWeightComposerPreview() : '')
      + (section.id === 'training-intent-profile' ? renderTrainingIntentProfilePreview() : '');
    if (section.id === 'weight-composer') scheduleWeightComposerPreview(config, api);

    if (section.id === 'data-aug-settings' || section.id === 'noise-settings' || section.id === 'validation-settings') {
      const panelClass = section.id === 'noise-settings'
        ? 'noise-settings-panel'
        : section.id === 'validation-settings'
          ? 'validation-settings-panel'
          : 'data-aug-panel';
      const summaryClass = section.id === 'noise-settings'
        ? 'noise-settings-summary'
        : section.id === 'validation-settings'
          ? 'validation-settings-summary'
          : 'data-aug-summary';
      const summaryDesc = section.id === 'data-aug-settings'
        ? '方法老旧不推荐使用'
        : section.id === 'noise-settings'
          ? '改善lora明暗度'
          : '';
      return `
        <details class="form-section collapsible-panel ${panelClass}" id="${escapeHtml(section.id)}">
          <summary class="section-header collapsible-summary ${summaryClass}">
            <span class="collapsible-summary-main">
              <span class="collapsible-title">${escapeHtml(sectionTitle)}</span>
              ${summaryDesc ? `<span class="collapsible-desc">${escapeHtml(summaryDesc)}</span>` : ''}
            </span>
            <span class="collapsible-actions">
              <span class="section-meta">${realFieldCount} ${state.lang === 'en' ? 'fields' : '项参数'}</span>
              <span class="collapsible-caret" aria-hidden="true">⌄</span>
            </span>
          </summary>
          <div class="section-summary">${escapeHtml(sectionDescription || '')}</div>
          <div class="section-content">${contentWithHelpers}</div>
        </details>
      `;
    }

    return `
      <section class="form-section" id="${escapeHtml(section.id)}">
        <header class="section-header">
          <h3>${escapeHtml(sectionTitle)}</h3>
          <span class="section-meta">${realFieldCount} ${state.lang === 'en' ? 'fields' : '项参数'}</span>
        </header>
        <div class="section-summary">${escapeHtml(sectionDescription)}</div>
        <div class="section-content">${contentWithHelpers}</div>
      </section>
    `;
  }

  const weightComposerActions = createWeightComposerActions({
    state,
    api,
    updateConfigValue: (key, value) => window.updateConfigValue?.(key, value),
    showToast: (message) => window.showToast?.(message),
  });

  const trainingIntentProfileActions = createTrainingIntentProfileActions({
    state,
    api,
    updateConfigValue: (key, value, options) => window.updateConfigValue?.(key, value, options),
    showToast: (message) => window.showToast?.(message),
  });
  return {
    ...weightComposerActions,
    ...trainingIntentProfileActions,
    renderField,
    renderFieldDescription,
    renderSection,
    renderDatasetSettingsContent,
    renderCaptionSettingsContent,
    renderNetworkSettingsContent,
    renderOptimizerSettingsContent,
    renderTrainingSettingsContent,
    renderNetworkOptionGroup,
    renderCaptionTagDropoutGroup,
    renderRegularizationFieldGroup,
  };
}


