// requiredFields.js — 提交前必填项检查（红框 + 跳转到缺失字段）。
//
// 后端真正的拦点在 `config_adapter/config_auto_fix.py::_check_missing_critical_paths`
// （底模路径 / 数据集目录为空 = blocking，且各有一族合法的替代字段）。在那之前，
// UI 提交空值会先白付一次 torch 冷启动，再在 worker 里炸出 ValidationError——
// 这正是发布台账 #58/#52 记过的「提交成功 → 启动即失败」形状。
// 本模块把同一条规则搬到提交按钮前面：缺什么 → 对应字段框标红 → 跳到第一个。
//
// 判据口径与后端逐字对齐（替代字段族、dataset_config 豁免），两边不一致时以
// 后端为准并同步这里；tests 用 node 直跑本模块的纯函数部分。

import { getSectionsForType, isFieldVisible } from './schemaIndex.js';

const BASE_MODEL_FIELD = 'pretrained_model_name_or_path';
// Mirror of _BASE_MODEL_ALTERNATIVE_FIELDS in config_auto_fix.py: any one of
// these being non-empty satisfies "a base model was supplied" even when the
// canonical field is blank (Newbie/Anima/H3 family-specific loaders).
const BASE_MODEL_ALTERNATIVES = [
  'pretrained_model',
  'base_model',
  'base_model_path',
  'pretrained_model_path',
  'sd_model_path',
  'checkpoint_path',
  'newbie_diffusers_path',
  'newbie_transformer_path',
  'anima_model_path',
  'h3_transformer_path',
];
const DATASET_FIELD = 'train_data_dir';
// Mirror of the dataset_config exemption in _check_missing_critical_paths.
const DATASET_CONFIG_ALTERNATIVE = 'dataset_config';

const REQUIRED_KEYS = new Set([BASE_MODEL_FIELD, DATASET_FIELD]);

const isBlank = (v) => v == null || (typeof v === 'string' && !v.trim());
const isFilled = (v) => !isBlank(v);

function isSatisfied(key, config) {
  if (isFilled(config[key])) return true;
  if (key === BASE_MODEL_FIELD) {
    return BASE_MODEL_ALTERNATIVES.some((alt) => isFilled(config[alt]));
  }
  if (key === DATASET_FIELD) {
    return isFilled(config[DATASET_CONFIG_ALTERNATIVE]);
  }
  return false;
}

/**
 * 该训练类型下真缺的必填字段。只检查 schema 里真渲染了这个字段的情况——
 * 类型没有该字段（或 visibleWhen 关掉了它）就不报，否则无处可跳。
 * 返回 [{ key, label, tab, sectionId }]，按 schema 出现顺序（第一个=跳转目标）。
 */
export function collectMissingRequiredFields(config, typeId) {
  const missing = [];
  if (!config || typeof config !== 'object') return missing;
  const sections = getSectionsForType(typeId || 'sdxl-lora');
  for (const section of sections) {
    for (const field of section.fields) {
      if (!REQUIRED_KEYS.has(field.key)) continue;
      if (!isFieldVisible(field, config)) continue;
      if (isSatisfied(field.key, config)) continue;
      missing.push({
        key: field.key,
        label: field.label || field.key,
        tab: section.tab,
        sectionId: section.id,
      });
    }
  }
  return missing;
}

// ── DOM 部分：标红 + 切页签 + 滚动 ────────────────────────────────────

let _clearListenerInstalled = false;
function ensureClearOnEdit() {
  if (_clearListenerInstalled) return;
  _clearListenerInstalled = true;
  // 用户开始改这个字段就把红框摘掉（事件委托，不碰 configForm 模板）。
  document.addEventListener('input', (e) => {
    const group = e.target?.closest?.('[data-field-key].field-required-error');
    if (group) group.classList.remove('field-required-error');
  });
}

/**
 * 切到第一个缺失字段所在页签、渲染配置页、给所有缺失字段加红框并滚到第一个。
 * 跳转机制与顶栏搜索的 jumpToConfigField 同形（activeModule/activeTab/
 * localStorage + renderView + rAF 后按 data-field-key 找元素）。
 */
export function markAndJumpMissingRequiredFields(missing, { state, renderView }) {
  if (!missing || missing.length === 0) return;
  const first = missing[0];

  if (state.activeModule !== 'config') {
    state.activeModule = 'config';
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.module === 'config');
    });
  }
  state.activeTab = first.tab;
  try { localStorage.setItem('sdxl_ui_tab', first.tab); } catch (_e) { /* ignore */ }
  renderView('config');

  requestAnimationFrame(() => {
    for (const m of missing) {
      const el = document.querySelector('.config-group[data-field-key="' + m.key + '"]');
      if (el) el.classList.add('field-required-error');
    }
    let target = document.querySelector('.config-group[data-field-key="' + first.key + '"]');
    if (!target) target = document.getElementById(first.sectionId);
    if (target) {
      if (target.tagName === 'DETAILS') target.open = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = target.matches('input, select, textarea')
        ? target
        : target.querySelector('input:not([type=hidden]), select, textarea');
      if (focusable && focusable.focus) focusable.focus({ preventScroll: true });
    }
  });
  ensureClearOnEdit();
}
