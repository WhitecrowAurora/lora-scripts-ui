// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Shared by the three training WebUIs; uses the existing runtime request keys.
import { all, when } from '../schemaCommon.js';
import { withWeightOffloadPrefill } from './weightOffloadPrefillFields.js';

const FAMILIES = {
  'krea2-lora': 'krea2',
  'wan22-ti2v-lora': 'wan22',
  'wan22-t2v-a14b-lora': 'wan22',
  'flux-lora': 'flux',
  'sd3-lora': 'sd3',
  'qwen-image-lora': 'qwen_image',
  'zimage-lora': 'zimage',
  'flux2-lora': 'flux2',
  'boogu-lora': 'boogu',
  'qwen-image-2-lora': 'qwen_image_2',
  'moss-image-lora': 'moss_image',
  'flux3-lora': 'flux3',
  'ltx23-lora': 'ltx23',
  'ltx25-lora': 'ltx23',
  'boogu-edit-lora': 'boogu',
};

const EXACT_PIN_DEFAULT_FAMILIES = new Set(['qwen_image', 'qwen_image_2', 'flux']);

const COMPILED_TYPES = new Set([
  'krea2-lora', 'sd3-lora', 'flux-lora', 'flux2-lora', 'flux3-lora',
  'zimage-lora', 'qwen-image-lora', 'qwen-image-2-lora', 'boogu-lora',
  'boogu-edit-lora', 'moss-image-lora', 'ltx23-lora', 'ltx25-lora', 'wan22-ti2v-lora',
  'wan22-t2v-a14b-lora',
]);

export function withBlockOffloadPrefill(sections, typeId) {
  const family = FAMILIES[typeId];
  if (!family) return withWeightOffloadPrefill(sections, typeId);
  const keys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const pinKey = `${family}_block_offload_pin_memory`;
  const enableKey = `${family}_block_offload_prefill_enabled`;
  const residencyKey = family === 'flux' ? 'flux_transformer_offload' : `${family}_block_residency`;
  const offloadMode = family === 'flux' ? 'block_residency' : 'block_offload';
  const offload = when(residencyKey, offloadMode);
  const ready = all(offload, when(pinKey, false),
    ...(family === 'flux' ? [when('flux_trainer_backend', 'unified')] : []));
  const target = sections.find((section) => section.fields.some((field) => field.key === pinKey))
    || sections.find((section) => section.id === 'speed-settings');
  if (!target) return sections;

  const prerequisites = [];
  if (family === 'flux' && !keys.has('flux_trainer_backend')) {
    prerequisites.push({
      key: 'flux_trainer_backend', type: 'select', label: 'FLUX 训练后端',
      defaultValue: 'unified',
      options: [{ value: 'unified', label: '统一训练（支持 CPU 预填充）' }, { value: 'legacy', label: '旧版兼容' }],
      desc: 'CPU 预填充需要统一训练后端和分块卸载。',
    });
  }
  if (!keys.has(residencyKey)) {
    prerequisites.push({
      key: residencyKey, type: 'select', label: '模型块驻留方式',
      defaultValue: family === 'flux' ? 'auto' : 'block_offload',
      options: family === 'flux'
        ? [{ value: 'auto', label: '自动' }, { value: 'off', label: '关闭卸载' },
          { value: 'aggressive', label: '激进卸载' }, { value: offloadMode, label: '分块卸载（支持 CPU 预填充）' }]
        : [{ value: 'resident', label: '全部驻留 GPU' }, { value: offloadMode, label: '分块卸载到 CPU' }],
    });
  }
  if (family === 'flux') {
    if (!keys.has('flux_block_offload_gpu_slots')) {
      prerequisites.push({
        key: 'flux_block_offload_gpu_slots', type: 'number', label: 'Block Offload GPU 槽位',
        defaultValue: 2, min: 1, max: 32, step: 1, visibleWhen: offload,
        desc: '同时留在 GPU 的 block 数，每个约 680MB 显存；默认 2，16G 卡 4 个以上收益不大。',
      });
    }
    if (!keys.has('flux_block_offload_prefetch_depth')) {
      prerequisites.push({
        key: 'flux_block_offload_prefetch_depth', type: 'number', label: 'Block Offload 预取深度',
        defaultValue: 1, min: 0, max: 8, step: 1, visibleWhen: offload,
        desc: '提前搬运的后续 block 数。搬运与计算能否重叠取决于锁页来源、CPU 预填充选择及本机负载。',
      });
    }
  }
  const pinHint = '关闭整块 Pin Memory 后可设置 CPU 预填充，以小型锁页暂存池搬运冻结权重。';
  const exactPinDesc = '默认开启：按块实际大小锁页，搬运更快。锁页总量有上限（Windows 约为总内存的 45%），并始终保留 8 GiB 空闲；内存不够时只锁一部分，其余走普通内存。';
  if (!keys.has(pinKey)) {
    prerequisites.push({
      key: pinKey, type: 'boolean', label: 'Block Offload Pin Memory',
      defaultValue: EXACT_PIN_DEFAULT_FAMILIES.has(family), visibleWhen: offload,
      desc: EXACT_PIN_DEFAULT_FAMILIES.has(family) ? `${exactPinDesc} ${pinHint}` : pinHint,
    });
  }
  const fields = [
    ...prerequisites,
    {
      key: enableKey, type: 'boolean', label: 'CPU 权重预填充（自动探测）',
      defaultValue: false, visibleWhen: ready,
      desc: `首次训练在第一个模型块计算前探测搬运与计算的重叠；没有明确收益时沿用直接上传。适用于单 GPU、${COMPILED_TYPES.has(typeId) ? '未编译或逐块编译（关闭 fullgraph）' : '未编译'}的 LoRA 块卸载，不保证整步提速。`,
    },
    {
      key: `${family}_block_offload_prefill_budget_mb`, type: 'number',
      label: 'CPU 预填充预算（MiB）', defaultValue: 128, min: 0, step: 1,
      visibleWhen: all(ready, when(enableKey, true)),
      desc: '锁页暂存内存预算；当前候选使用 128 MiB。低于 128 时沿用直接上传，提高预算不会扩大暂存池。',
    },
  ];
  const anchor = target.fields.findIndex((field) => field.key === pinKey);
  const insertion = anchor < 0 ? target.fields.length : anchor + 1;
  return sections.map((section) => section !== target ? section : {
    ...section,
    fields: [
      ...section.fields.slice(0, insertion).map((field) => field.key === pinKey
        ? { ...field, desc: `${field.desc || ''} ${pinHint}`.trim() } : field),
      ...fields,
      ...section.fields.slice(insertion),
    ],
  });
}
