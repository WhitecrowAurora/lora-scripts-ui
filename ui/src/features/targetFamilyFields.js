// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Mirrors the generic target-family contract; Anima keeps its richer controls.
const supportedTypes = new Set([
  'sd-lora', 'sdxl-lora', 'sd3-lora', 'flux-lora', 'flux3-lora', 'krea2-lora',
  'qwen-image-lora', 'minimax-h3-lora', 'boogu-lora',
  'boogu-edit-lora', 'zimage-lora', 'wan22-ti2v-lora',
  'wan22-t2v-a14b-lora', 'ltx23-lora', 'ltx25-lora',
]);

const visibleWhen = (config) => !config.lora2_adaptive_enabled && !config.ed_lora_enabled;
visibleWhen.deps = new Set(['lora2_adaptive_enabled', 'ed_lora_enabled']);

const targetFamilyField = {
  key: 'lora_target_groups', type: 'select', defaultValue: '',
  label: 'LoRA 训练目标族', label_zh: 'LoRA 训练目标族', label_en: 'LoRA target families', visibleWhen,
  options: [
    { value: '', label: '默认目标（注意力与 MLP）', label_en: 'Default targets (attention and MLP)' },
    { value: 'attention', label: '注意力', label_en: 'Attention' },
    { value: 'mlp', label: 'MLP / FFN', label_en: 'MLP / FFN' },
    { value: 'attention,mlp', label: '注意力与 MLP（显式选择）', label_en: 'Attention and MLP (explicit)' },
  ],
  desc: '选择去噪模型内参与适配器训练的模块族。辅助投影仍按该模型默认目标保留；文本编码器设置独立。留空保持原有目标。LoRA2 自适应与 ED-LoRA 使用各自的注入目标。',
  desc_zh: '选择去噪模型内参与适配器训练的模块族。辅助投影仍按该模型默认目标保留；文本编码器设置独立。留空保持原有目标。LoRA2 自适应与 ED-LoRA 使用各自的注入目标。',
  desc_en: 'Select the denoiser module families to adapt. Auxiliary projections keep the model defaults; text encoder settings are independent. Leave unset for the original targets. Adaptive LoRA2 and ED-LoRA use their own injection targets.',
};

export function withTargetFamilyFields(sections, typeId) {
  if (!supportedTypes.has(typeId)) return sections;
  if (sections.some(section => section.fields.some(field => field.key === targetFamilyField.key))) return sections;
  const target = sections.find(section => section.fields.some(field => field.key === 'network_dim'));
  if (!target) return sections;
  return sections.map(section => section === target
    ? { ...section, fields: [...section.fields, targetFamilyField] } : section);
}
