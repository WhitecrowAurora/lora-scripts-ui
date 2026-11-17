// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
import { all, when } from '../schemaCommon.js';

const TYPES = new Set(['sd-lora', 'sdxl-lora', 'anima-lora', 'newbie-lora', 'minimax-h3-lora']);

function uploadEnabled(config) {
  return config.module_offload_enabled === true
    || Number(config.h3_blocks_to_swap) > 0
    || (['block', 'merged_block'].includes(config.swap_granularity)
      && (Number(config.swap_count) > 0 || Number(config.swap_ratio) > 0
        || Number(config.blocks_to_swap) > 0));
}
uploadEnabled.deps = new Set(['module_offload_enabled', 'h3_blocks_to_swap',
  'swap_granularity', 'swap_count', 'swap_ratio', 'blocks_to_swap']);

export function withWeightOffloadPrefill(sections, typeId) {
  if (!TYPES.has(typeId)) return sections;
  // Unrelated model defaults can exist in imported configurations. Only the
  // offload controls actually offered by this page can activate its option.
  const keys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const relevantKeys = [...uploadEnabled.deps].filter((key) => keys.has(key));
  const ready = (config) => uploadEnabled(Object.fromEntries(relevantKeys.map((key) => [key, config[key]])));
  ready.deps = new Set(relevantKeys);
  const target = sections.find((section) => section.id === 'speed-settings')
    || sections.find((section) => section.fields.some((field) => relevantKeys.includes(field.key)));
  if (!target) return sections;
  return sections.map((section) => section !== target ? section : {
    ...section,
    fields: [...section.fields, {
      key: 'weight_offload_prefill_enabled', type: 'boolean',
      label: 'CPU 权重预填充（自动探测）', defaultValue: false, visibleWhen: ready,
      desc: '首次上传普通 CPU 内存中的冻结权重时探测本机搬运策略。支持单 GPU LoRA 的未编译或逐块编译模式（关闭 fullgraph）。已锁页的权重沿用原路径，没有明确收益时直接上传；搬运探测不代表整步训练提速。',
    }, {
      key: 'weight_offload_prefill_budget_mb', type: 'number',
      label: 'CPU 预填充预算（MiB）', defaultValue: 128, min: 0, step: 1,
      visibleWhen: all(ready, when('weight_offload_prefill_enabled', true)),
      desc: '当前候选共用 128 MiB 锁页暂存池。预算不足时直接上传，提高预算不会扩大暂存池。',
    }],
  });
}
