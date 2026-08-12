// renderers/orderedMultiSelect.js — 有序多选(可拖动排序)字段渲染器
//
// 目标字段:preference_models / concept_geometry_source_priority。
// 两者原来是纯文本框,用户要手打 "explicit,folder,nl,identity" 这种逗号串,
// 打错的取值后端只会 warning 后静默回落——UI 层根本不给约束。
// 这里把取值集合收口成候选清单,顺序用拖拽表达(concept 来源优先级顺序有语义),
// 写回仍是逗号串,后端契约不动。

import { escapeHtml } from '../utils/dom.js';
import { orderedMultiSelectOptions, orderedMultiSelectRows } from '../features/orderedMultiSelect.js';

function selectedRowHtml(fieldKey, row, index, total, disabledAttr) {
  const keyArg = escapeHtml(JSON.stringify(fieldKey));
  const dragAttrs = disabledAttr
    ? ''
    : ` draggable="true" ondragstart="beginOrderedMultiSelectDrag(${keyArg}, ${index})"`
      + ` ondragover="event.preventDefault()" ondragenter="event.preventDefault()"`
      + ` ondrop="event.preventDefault(); dropOrderedMultiSelect(${keyArg}, ${index})"`
      + ` ondragend="endOrderedMultiSelectDrag()"`;
  return `
    <li class="ordered-multiselect-row" data-ordered-multiselect-row="${index}" data-value="${escapeHtml(row.value)}"${dragAttrs}>
      <span class="ordered-multiselect-grip" aria-hidden="true">⋮⋮</span>
      <span class="ordered-multiselect-index">${index + 1}</span>
      <span class="ordered-multiselect-label">${escapeHtml(row.label)}</span>
      <code class="ordered-multiselect-value">${escapeHtml(row.value)}</code>
      <span class="ordered-multiselect-row-actions">
        <button class="btn btn-outline btn-sm" type="button" title="上移" aria-label="上移"${disabledAttr}${index === 0 ? ' disabled' : ''} onclick="moveOrderedMultiSelectItem(${keyArg}, ${index}, ${index - 1})">↑</button>
        <button class="btn btn-outline btn-sm" type="button" title="下移" aria-label="下移"${disabledAttr}${index >= total - 1 ? ' disabled' : ''} onclick="moveOrderedMultiSelectItem(${keyArg}, ${index}, ${index + 1})">↓</button>
        <button class="btn btn-outline btn-sm" type="button" title="移除" aria-label="移除"${disabledAttr} onclick="toggleOrderedMultiSelectItem(${keyArg}, ${escapeHtml(JSON.stringify(row.value))})">−</button>
      </span>
    </li>
  `;
}

export function renderOrderedMultiSelectField({
  field,
  value,
  disabledAttr = '',
  disabledCls = '',
  modCls = '',
  conflictWith = '',
  renderHeader,
  renderFieldDescription,
  renderConflictHint,
  lang = 'zh',
}) {
  const fieldKey = String(field.key || '');
  const keyArg = escapeHtml(JSON.stringify(fieldKey));
  const options = orderedMultiSelectOptions(field);
  const { selected, unselected, unknown } = orderedMultiSelectRows(value, options);
  const emptyHint = field.emptyHint || (lang === 'en' ? 'Nothing selected (backend default applies)' : '未选择任何项（后端按默认值处理）');
  const listHtml = selected.length
    ? `<ol class="ordered-multiselect-list">${selected.map((row, index) => selectedRowHtml(fieldKey, row, index, selected.length, disabledAttr)).join('')}</ol>`
    : `<p class="ordered-multiselect-empty">${escapeHtml(emptyHint)}</p>`;
  const addHtml = unselected.length
    ? `<div class="ordered-multiselect-pool">${unselected.map((row) => `
        <button class="btn btn-outline btn-sm ordered-multiselect-add" type="button"${disabledAttr} title="${escapeHtml(row.value)}" onclick="toggleOrderedMultiSelectItem(${keyArg}, ${escapeHtml(JSON.stringify(row.value))})">+ ${escapeHtml(row.label)}</button>
      `).join('')}</div>`
    : '';
  // 未知取值来自手改配置或旧版本,保留原样并明确告知,不静默丢弃。
  const unknownHtml = unknown.length
    ? `<div class="ordered-multiselect-unknown" role="status">保留了 ${unknown.length} 个未识别取值：${escapeHtml(unknown.join(', '))}（后端会按未知值处理）</div>`
    : '';
  return `
    <div class="config-group ordered-multiselect${modCls}${disabledCls}" data-field-key="${escapeHtml(fieldKey)}" style="grid-column:1/-1;min-width:0">
      ${renderHeader()}
      ${renderFieldDescription(field, lang)}
      ${renderConflictHint(conflictWith)}
      ${listHtml}
      ${addHtml}
      ${unknownHtml}
    </div>
  `;
}
