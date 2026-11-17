// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
import { all, when, oneOf, lycorisNetworkSelected } from '../schemaCommon.js';

export function withRuntimeMemoryFields(sections, typeId) {
  const keys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const offloadKeys = [...keys].filter((key) => key.endsWith('_block_residency')
    || key === 'module_offload_enabled' || key === 'flux_transformer_offload');
  const offloadActive = (config) => offloadKeys.some((key) => key === 'module_offload_enabled'
    ? config[key] === true : ['block_offload', 'layer_offload', 'block_residency'].includes(config[key]));
  offloadActive.deps = new Set(offloadKeys);
  const additions = new Map();
  const append = (anchor, fields) => {
    const target = sections.find((section) => section.fields.some((field) => field.key === anchor));
    if (!target) return;
    const fresh = fields.filter((field) => !keys.has(field.key));
    fresh.forEach((field) => keys.add(field.key));
    additions.set(target, [...(additions.get(target) || []), ...fresh]);
  };
  if (offloadKeys.length && typeId?.includes('lora')) {
    append(offloadKeys[0], [{
      key: 'module_offload_frozen_backward', type: 'boolean', defaultValue: false,
      label: '冻结 Linear 反向按需读取', visibleWhen: offloadActive,
      desc: '冻结 Linear 在反向重新读取权重，减少对整块重算的依赖。仅支持普通 FP32/FP16/BF16 Linear；未覆盖的块保留原卸载方式。可能增加传输调用和激活占用，收益待实测。',
    }, {
      key: 'module_offload_frozen_prefetch', type: 'boolean', defaultValue: false,
      label: '冻结 Linear 提前搬运', visibleWhen: all(offloadActive, when('module_offload_frozen_backward', true)),
      desc: '学习前向、重算和反向的层访问顺序，最多提前搬入一份不超过 128 MiB 的权重，使用 128 MiB 锁页中转缓冲。仅普通 RAM 权重可用；可能预测未命中，当前 MOSS 对照未确认稳定提速。',
    }]);
    if (!keys.has('activation_cpu_offload_enabled')) append(offloadKeys[0], [
      { key: 'activation_cpu_offload_enabled', type: 'boolean', defaultValue: false, label: '激活 CPU Offload', desc: '将较大激活保存到 CPU，反向时取回。' },
      { key: 'activation_cpu_offload_min_tensor_mb', type: 'number', defaultValue: 1, min: 0, step: 0.5, label: '激活卸载最小体积 MB', visibleWhen: when('activation_cpu_offload_enabled', true) },
      { key: 'activation_cpu_offload_pool_gb', type: 'number', defaultValue: 1, min: 0, step: 0.1, label: '激活 Pinned 池 GB', visibleWhen: when('activation_cpu_offload_enabled', true) },
    ]);
  }
  // An anchor added above belongs to the same section as its offload control.
  const activationAnchor = sections.some((section) => section.fields.some((field) => field.key === 'activation_cpu_offload_enabled'))
    ? 'activation_cpu_offload_enabled' : offloadKeys[0];
  if (keys.has('activation_cpu_offload_enabled')) append(activationAnchor, [
    { key: 'activation_cpu_offload_policy', type: 'select', defaultValue: 'on_demand', label: '激活传输策略',
      options: [{ value: 'on_demand', label: '原按需策略' }, { value: 'shared', label: '共享保存与缓冲复用' }, { value: 'prefetch', label: '共享保存并提前回传' }],
      visibleWhen: when('activation_cpu_offload_enabled', true), desc: '共享策略合并重复保存；提前回传最多多保留一份激活，可能以额外显存换取较少等待。' },
    { key: 'activation_cpu_offload_inflight_mb', type: 'number', defaultValue: 256, min: 1, step: 16, label: '激活在途传输预算 MB',
      visibleWhen: all(when('activation_cpu_offload_enabled', true), oneOf('activation_cpu_offload_policy', ['shared', 'prefetch'])),
      desc: '限制共享策略尚未完成的复制。单个张量超过预算时等待完成；不限制保存激活所需的总 CPU 内存。' },
  ]);
  append('blockwise_fused_optimizers', [{
    key: 'optimizer_state_paging_prefetch', type: 'boolean', defaultValue: false, label: '预取下一批优化器状态',
    visibleWhen: all(when('optimizer_state_paging_enabled', true), when('blockwise_fused_optimizers', true)),
    desc: '需要单 CUDA 设备、CPU 驻留、pin_memory 和保持原精度。提前加载下一批状态可能提高速度，也会额外占用这一批状态的显存。',
  }]);
  append('gradient_accumulation_steps', [{
    key: 'gradient_accumulation_cpu', type: 'boolean', defaultValue: false, label: 'CPU 暂存累积梯度',
    desc: '将尚未完成累积的梯度暂存到 CPU，下次仍在原设备按原顺序相加，更新前还原完整梯度进行裁剪。适合累积步数大于 1；仅单卡 fast 模式，不支持 PCGrad、随机梯度累积、反向中更新和 CUDA Graph。梯度释放可使用 post_step 模式；额外传输可能降低速度。',
  }]);
  const lohaAnchor = ['lycoris_loha_implementation', 'lycoris_algo', 'lora_type'].find(key => keys.has(key));
  const standardLoha = (config) => (lohaAnchor === 'lora_type' ? config.lora_type === 'loha'
    : lycorisNetworkSelected(config) && config.lycoris_algo === 'loha')
    && (!config.lycoris_loha_implementation || config.lycoris_loha_implementation === 'lycoris_standard');
  standardLoha.deps = new Set(['lora_type', 'network_module', 'lycoris_algo', 'lycoris_loha_implementation']);
  if (lohaAnchor) append(lohaAnchor, [{
    key: 'loha_materialized_recompute', type: 'boolean', defaultValue: false, label: 'LoHa 物化权重重算',
    visibleWhen: standardLoha,
    desc: '标准 LoHa 需要生成完整增量权重时，只保存输入和小因子，在反向重新生成大矩阵以节省显存。已有因子化路径保持不变，重算可能降低速度；编译时使用原路径。',
  }]);
  if (typeId?.startsWith('moss-image')) append('gradient_checkpointing', [{
    key: 'moss_image_checkpoint_granularity', type: 'select', defaultValue: 'block', label: 'MOSS 重算粒度',
    visibleWhen: when('gradient_checkpointing', true),
    options: [{ value: 'block', label: '完整块' }, { value: 'sub_block', label: '分别重算注意力与 FFN' }, { value: 'ffn', label: '仅重算 FFN' }],
    desc: '文生图可分别控制注意力与 FFN 的重算。使用块卸载时，局部重算需要冻结 Linear 反向按需读取完整覆盖。仅重算 FFN 保留更多激活，可能显著增加 RAM 和传输时间。',
  }]);
  if (typeId?.startsWith('boogu')) append('gradient_checkpointing', [{
    key: 'boogu_checkpoint_granularity', type: 'select', defaultValue: 'block', label: 'Boogu 重算粒度',
    visibleWhen: when('gradient_checkpointing', true),
    options: [{ value: 'block', label: '完整块' }, { value: 'sub_block', label: '块内再重算注意力与 FFN' }],
    desc: '保留完整块重算，在块内对注意力与 FFN 再次重算，减少反向过程中同时保留的激活。可能增加计算时间；默认使用完整块。当前局部编译数值对照未通过，不建议与编译同时开启。',
  }]);
  return sections.map((section) => additions.has(section)
    ? { ...section, fields: [...section.fields, ...additions.get(section)] } : section);
}
