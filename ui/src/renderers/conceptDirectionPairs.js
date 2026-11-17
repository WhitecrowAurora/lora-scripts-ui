import { escapeHtml } from '../utils/dom.js';
import { readConceptDirectionPairs } from '../features/conceptDirectionPairs.js';

export function renderConceptDirectionPairsField({
  field, value, disabledAttr, disabledCls, modCls, renderHeader, renderFieldDescription,
}) {
  // Concept direction and slider LoRA share this editor but store their pairs
  // under different keys, so the key travels with every inline handler.
  const fieldKey = field.key;
  const { pairs, text, error } = readConceptDirectionPairs(value);
  const content = error ? `
    <p role="status">${escapeHtml(error)}</p>
    <textarea class="text-area" aria-label="原始概念对配置"${disabledAttr}
      oninput="updateConfigValue('${fieldKey}', this.value)">${escapeHtml(text)}</textarea>
    <button class="btn btn-outline" type="button"${disabledAttr} onclick="refreshConceptDirectionPairs()">显示成对编辑</button>
  ` : `
    ${!pairs.length ? '<p class="field-desc">添加一对描述开始，例如“a smiling person”与“a person”。</p>' : ''}
    ${pairs.map((pair, index) => `
      <fieldset data-concept-pair-index="${index}" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0;">
        <legend>概念对 ${index + 1}</legend>
        <label class="mini-field"><span>正向提示词</span><textarea class="text-area" rows="2" aria-label="概念对 ${index + 1} 正向提示词"${disabledAttr}
          oninput="updateConceptDirectionPair('${fieldKey}', ${index}, 'positive', this.value)">${escapeHtml(pair.positive || '')}</textarea></label>
        <label class="mini-field"><span>负向提示词（对照）</span><textarea class="text-area" rows="2" aria-label="概念对 ${index + 1} 负向提示词"${disabledAttr}
          oninput="updateConceptDirectionPair('${fieldKey}', ${index}, 'negative', this.value)">${escapeHtml(pair.negative || '')}</textarea></label>
        <button class="btn btn-outline btn-sm" type="button" aria-label="移除概念对 ${index + 1}"${disabledAttr}
          onclick="removeConceptDirectionPair('${fieldKey}', ${index})">移除此对</button>
      </fieldset>
    `).join('')}
    <button class="btn btn-outline" type="button"${disabledAttr} onclick="addConceptDirectionPair('${fieldKey}')">添加概念对</button>
  `;
  return `<div class="config-group${modCls}${disabledCls}" style="grid-column:1 / -1;" data-field-key="${field.key}" data-concept-direction-pairs>
    ${renderHeader()}${renderFieldDescription(field)}${content}
  </div>`;
}
