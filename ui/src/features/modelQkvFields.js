// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Expose existing physical packing only on the newly supported LoRA pages.
const supportedTypes = new Set(['flux3-lora', 'qwen-image-lora', 'qwen-image-2-lora']);
const modelQkvField = {
  key: 'model_fused_qkv', type: 'boolean', defaultValue: false,
  label: '物理 QKV 投影打包', label_en: 'Physical QKV projection packing',
  title: 'model_fused_qkv',
  desc: '合并符合条件的冻结 Linear 底座投影，保留标准 LoRA 分支；DoRA、动态路由及不兼容量化层沿用原路径。与 Triton QKV 分别配置，默认关闭；实际收益取决于模型与运行配置。',
  desc_en: 'Pack eligible frozen Linear base projections while retaining standard LoRA branches. DoRA, dynamic routing and incompatible quantized layers keep their existing path. Configured separately from Triton QKV and off by default; gains depend on the model and runtime.',
};

export function withModelQkvFields(sections, typeId) {
  if (!supportedTypes.has(typeId)) return sections;
  return sections.map((section) => section.id === 'speed-settings'
    ? { ...section, fields: [...section.fields, modelQkvField] } : section);
}
