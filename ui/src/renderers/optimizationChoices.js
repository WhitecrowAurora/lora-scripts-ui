// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
import { escapeHtml } from '../utils/dom.js';

export function renderOptimizationChoices({ field, value, options, disabledAttr, renderHeader, description, lang }) {
  const selected = Array.isArray(value) ? value : String(value ?? '').split(',').filter(Boolean);
  const arg = (value) => escapeHtml(JSON.stringify(value));
  const update = (value) => `updateConfigValue(${arg(field.key)}, ${arg(value)})`;
  const all = options.map((option) => typeof option === 'object' ? option.value : option).join(',');
  return `<div class="config-group optimization-choices" data-field-key="${escapeHtml(field.key)}">
    ${renderHeader()}${description}
    <div class="optimization-choice-actions">
      <button type="button" class="btn btn-outline btn-sm"${disabledAttr} onclick="${update(all)}">${lang === 'en' ? 'Select all' : '全选'}</button>
      <button type="button" class="btn btn-outline btn-sm"${disabledAttr} onclick="${update('')}">${lang === 'en' ? 'Clear' : '清空'}</button>
    </div>
    <div class="optimization-choice-grid" role="group" aria-label="${escapeHtml(field.label)}">
      ${options.map((option) => {
        const { value: token, label } = typeof option === 'object' ? option : { value: option, label: option };
        const checked = selected.includes(token);
        const next = checked ? selected.filter((item) => item !== token) : [...selected, token];
        return `<label class="optimization-choice"><input type="checkbox"${checked ? ' checked' : ''}${disabledAttr} onchange="${update(next.join(','))}"><span>${escapeHtml(label)}</span></label>`;
      }).join('')}
    </div>
  </div>`;
}
