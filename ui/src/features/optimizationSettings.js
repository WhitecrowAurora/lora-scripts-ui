// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Shared by all three WebUIs: choices belong to the submitted training snapshot.
export const LULYNX_OPTIMIZATIONS = [
  ['fp32_affine_norm', 'FP32 仿射 RMSNorm（Krea2 / Boogu / Newbie / Flux3）'],
  ['shared_rms_norm', '共享 RMSNorm（MOSS / H3 / Qwen / Z-Image；适用调制与 RoPE）'],
  ['flux3_shared_modulation', '共享时间条件投影（Flux3，保留逐 token dropout）'],
  ['boogu_compact_gqa', '紧凑 GQA（Boogu / FlashAttention 2）'],
  ['wan_adaptive_norm', 'FP32 自适应 LayerNorm（Wan）'],
  ['ltx_unweighted_norm', '无权重 RMSNorm（LTX）'],
  ['qkv_split_norm', 'QKV 拆分与归一化融合（Anima）'],
  ['gated_residual', '门控残差融合（适用模型调用点）'],
  ['adaln_qkv', 'AdaLN 与 QKV 融合（Anima）'],
  ['adaln_mlp', 'AdaLN 与 MLP / GELU 融合（Anima）'],
  ['lora', 'LoRA 计算融合（符合条件的 BF16 适配器）'],
  ['qkv', 'QKV 投影融合（符合条件的注意力层）'],
  ['adaln', 'AdaLN 计算融合（符合条件的归一化层）'],
  ['ffn', 'FFN / GELU 计算融合（符合条件的前馈层）'],
  ['block_swap_pipeline', 'BlockSwap 流水线（已开启卸载且策略为自动）'],
  ['anima_async_offload', 'Anima 异步卸载（已开启 Block Offload）'],
  ['adalora_gpu_budget', 'AdaLoRA GPU 预算计算（已开启 AdaLoRA）'],
  ['tread_compact', 'TREAD 紧凑索引（已开启 TREAD）'],
  ['diffcr_shortcut', 'DiffCR 无压缩快捷路径（已开启 DiffCR）'],
  ['rope', 'RoPE 加速（Anima / Newbie 的适用运行配置）'],
].map(([value, label]) => ({ value, label }));

export const TURBOCORE_ALGORITHMS = [
  'AdamW', 'AdaMod', 'AdamG', 'Lion', 'Tiger', 'SignSGD', 'SGD', 'SGDW', 'QHM',
  'AggMo', 'RMSprop', 'VSGD', 'ASGD', 'PID', 'Gravity', 'AccSGD', 'PNM', 'SGDSaI',
  'MADGRAD', 'LARS', 'Fromage', 'Nero', 'Prodigy', 'DAdaptAdam', 'DAdaptSGD',
  'DAdaptAdaGrad', 'DAdaptAdan', 'AdamW8bit', 'RAdam', 'AdaBelief', 'Adan', 'Lamb',
];
export const DEFAULT_LULYNX_FEATURES = LULYNX_OPTIMIZATIONS.map((item) => item.value).join(',');
export const DEFAULT_TURBOCORE_ALGORITHMS = TURBOCORE_ALGORITHMS.join(',');
export const OPTIMIZATION_CONFIG_KEYS = [
  'lulynx_optimization_enabled', 'turbocore_enabled',
  'lulynx_optimization_features', 'turbocore_optimizer_algorithms',
];

const FUSION_FIELDS = {
  triton_qkv_split_norm_fused: 'qkv_split_norm',
  triton_gated_residual_fused: 'gated_residual',
  triton_adaln_qkv_fused: 'adaln_qkv',
  triton_adaln_mlp_gelu_fused: 'adaln_mlp',
  triton_ops_inject_lora: 'lora', triton_ops_inject_qkv: 'qkv',
  triton_ops_inject_adaln: 'adaln', triton_ops_inject_ffn: 'ffn',
};
const MANAGED_FIELDS = new Set([...OPTIMIZATION_CONFIG_KEYS, ...Object.keys(FUSION_FIELDS), 'triton_ops_enabled']);
const csv = (value) => Array.isArray(value) ? value.join(',') : String(value ?? '');

export const OPTIMIZATION_SECTIONS = [
  {
    id: 'lulynx-optimization-settings', tab: 'settings', title: 'LULYNX 优化设置',
    description: '总开关控制是否启用，勾选控制允许使用哪些实现。不适用的项目沿用原生路径。勾选偏好用于新草稿；已保存或导入的训练配置保留各自的选择。更改在下次训练生效。',
    fields: [
      { key: 'lulynx_optimization_enabled', type: 'boolean', label: '启用 LULYNX 优化', defaultValue: true, desc: '关闭后，这里管理的模型算子、融合和调度优化均走原生路径。EMA、损失策略和秩调整等训练策略保持独立。' },
      { key: 'lulynx_optimization_features', type: 'csvMultiSelect', label: '允许启用的优化', defaultValue: DEFAULT_LULYNX_FEATURES, options: LULYNX_OPTIMIZATIONS, desc: '默认全选；可取消任意项目以保留对应的原生实现。取消全部表示不启用任何项目。只允许加速已有策略，不会自动开启 AdaLoRA、TREAD、DiffCR 或卸载。' },
    ],
  },
  {
    id: 'turbocore-optimization-settings', tab: 'settings', title: 'TURBOCORE 优化设置',
    description: '只加速当前选用且已勾选的优化器算法，不会替换成另一种优化器。实际支持范围取决于运行时和参数配置。',
    fields: [
      { key: 'turbocore_enabled', type: 'boolean', label: '启用 TURBOCORE', defaultValue: true, desc: '关闭后停用自动 TurboCore 优化器替换。显式选择的优化器及其参数仍由训练配置决定。' },
      { key: 'turbocore_optimizer_algorithms', type: 'csvMultiSelect', label: '允许加速的优化器算法', defaultValue: DEFAULT_TURBOCORE_ALGORITHMS, options: TURBOCORE_ALGORITHMS, desc: '默认全选。例如只勾选 AdamW，其他算法保留各自原生实现。勾选不代表当前环境支持该算法；不满足执行条件时沿用原有回退路径。' },
    ],
  },
];

const sectionCache = new WeakMap();
function independentTrainingSections(section) {
  if (!section.fields.some((field) => field.key === 'lulynx_experimental_core_enabled')) return [section];
  const fields = section.fields.filter((field) => field.key !== 'lulynx_experimental_core_enabled').map((field) => ({
    ...field,
    visibleWhen: field.visibleWhen
      ? (config) => field.visibleWhen({ ...config, lulynx_experimental_core_enabled: true })
      : undefined,
  }));
  const resource = fields.filter((field) => field.key.startsWith('lulynx_resource_'));
  const strategies = fields.filter((field) => !field.key.startsWith('lulynx_resource_'));
  return [
    { ...section, tab: 'training', title: '分层学习率与秩策略', description: '这些选项会改变参数更新或适配器秩，单独启用，与 LULYNX / TURBOCORE 加速开关无关。', fields: strategies },
    { id: `${section.id}-resources`, tab: 'speed', title: '资源监控', description: '单独配置资源日志与缓存管理。', fields: resource },
  ].filter((item) => item.fields.length);
}

export function withOptimizationSettings(sections) {
  if (sectionCache.has(sections)) return sectionCache.get(sections);
  const result = [...sections.flatMap(independentTrainingSections).map((section) => ({
    ...section, fields: section.fields.filter((field) => !MANAGED_FIELDS.has(field.key)),
  })).filter((section) => section.fields.length), ...OPTIMIZATION_SECTIONS];
  sectionCache.set(sections, result);
  return result;
}

export function applyOptimizationSelection(payload, config) {
  // The independent keep-ratio control is also a SmartRank opt-in. A canonical
  // default from another section must not silently mask this explicit choice.
  if (payload.lulynx_smart_rank_enabled === true) payload.smart_rank_enabled = true;
  payload.lulynx_optimization_enabled = config.lulynx_optimization_enabled ?? true;
  payload.turbocore_enabled = config.turbocore_enabled ?? true;
  // Explicit empty selections must survive collectVisiblePayload's empty-value removal.
  payload.lulynx_optimization_features = csv(config.lulynx_optimization_features ?? DEFAULT_LULYNX_FEATURES);
  payload.turbocore_optimizer_algorithms = csv(config.turbocore_optimizer_algorithms ?? DEFAULT_TURBOCORE_ALGORITHMS);
  const selected = new Set(payload.lulynx_optimization_features.split(',').map((item) => item.trim()));
  for (const [key, feature] of Object.entries(FUSION_FIELDS)) {
    payload[key] = Boolean(payload.lulynx_optimization_enabled && selected.has(feature));
  }
  payload.triton_ops_enabled = ['lora', 'qkv', 'adaln', 'ffn'].some((key) => payload[`triton_ops_inject_${key}`]);
  return payload;
}
