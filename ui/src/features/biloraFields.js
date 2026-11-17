import { when } from '../schemaCommon.js';
import { S_GRADIENT_RELEASE } from '../schemaFieldGroups.js';

// These ordinary LoRA routes use the shared native Linear injector/runtime.
// Family GPU training and execution combinations are validated separately.
const trainingTypes = new Set([
  'anima-lora', 'newbie-lora', 'krea2-lora', 'flux-lora', 'flux2-lora', 'flux3-lora',
  'sd3-lora', 'qwen-image-lora', 'qwen-image-2-lora', 'moss-image-lora',
  'zimage-lora', 'boogu-lora', 'minimax-h3-lora',
  'wan22-ti2v-lora', 'wan22-t2v-a14b-lora', 'ltx23-lora', 'ltx25-lora',
]);

const enabled = when('bilora_enabled', true);
const fields = [
  {
    key: 'bilora_enabled', type: 'boolean', label: 'Bi-LoRA 辅助对抗分支',
    defaultValue: false,
    desc: '主分支降低损失，辅助分支增大损失并限制全局扰动。适用于原生标准 Linear LoRA，预览与发布只用主分支。使用单卡 PyTorch AdamW（torch_adamw），关闭 TurboCore、梯度释放和 LR Finder；已测模型的短训画质基本持平，尚未证明画质提升。',
  },
  { key: 'bilora_rank', type: 'number', label: '辅助 rank', defaultValue: 4, min: 1, step: 1, visibleWhen: enabled },
  { key: 'bilora_alpha', type: 'number', label: '辅助 alpha', defaultValue: 8, min: 0.01, step: 1, visibleWhen: enabled },
  {
    key: 'bilora_learning_rate', type: 'number', label: '辅助学习率', defaultValue: '', min: 0, step: 0.00001,
    desc: '留空跟随主学习率初始值，之后随同一个调度器变化。', visibleWhen: enabled,
  },
  {
    key: 'bilora_radius', type: 'number', label: '全局扰动半径', defaultValue: 0.05, min: 0.000001, step: 0.01,
    desc: '约束所有辅助有效增量的联合 Frobenius 范数，包含 alpha 缩放。续训需保存完整训练状态；仅有发布 LoRA 无法恢复辅助分支。', visibleWhen: enabled,
  },
];

export function withBiloraFields(sections, typeId) {
  if (!trainingTypes.has(typeId)) return sections;
  const hasGradientRelease = sections.some((section) => section.fields.some((field) => field.key === 'gradient_release_enabled'));
  const additions = hasGradientRelease ? fields : [...fields, {
    ...S_GRADIENT_RELEASE.find((field) => field.key === 'gradient_release_enabled'),
    visibleWhen: enabled,
  }];
  return sections.map((section) => {
    if (section.fields.some((field) => field.key === 'network_dim')) {
      return { ...section, fields: [...section.fields, ...additions] };
    }
    if (section.id === 'optimizer-settings') return {
      ...section,
      fields: section.fields.map((field) => field.key === 'optimizer_backend' ? {
        ...field,
        visibleWhen: (config) => config.bilora_enabled === true || field.visibleWhen(config),
      } : field),
    };
    return section;
  });
}
