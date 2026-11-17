import { when } from './schemaCommon.js';

// 蒸馏预览：把当前 LoRA 挂到一个独立加载、步数很少的蒸馏基座上出图。
// 它是"更快但不等于训练模型"的一条预览路，所以说明里必须写清楚它替代不了 A/B。
const enabled = when('distilled_preview_enabled', true);

const section = {
  id: 'distilled-preview',
  tab: 'preview',
  title: '蒸馏基座预览（少步数）',
  description: '用另一个少步数蒸馏基座出预览，比在训练模型上采样快得多。它跟随上面的「预览图设置」排程：没启用预览图、或者预览排程为空时，这里单独打开也不会出图。代价是蒸馏基座和训练基座不是同一个分布：逐轮看趋势可以，拿两张图判断某个改动是否让 LoRA 变好不行。蒸馏基座与训练模型同时在显存里放不下时会跳过并在日志里说明，不会悄悄退回训练模型出图。',
  fields: [
    {
      key: 'distilled_preview_enabled', type: 'boolean', label: '启用蒸馏基座预览',
      title: 'distilled_preview_enabled',
      desc: '默认关闭；关闭时预览完全走原有路径，相关字段的残留值不参与任何判断。',
      defaultValue: false,
    },
    {
      key: 'distilled_preview_model', type: 'file', label: '蒸馏基座权重', title: 'distilled_preview_model',
      desc: '独立加载的蒸馏基座 .safetensors。启用后必填：留空会直接报错。',
      defaultValue: '', visibleWhen: enabled,
    },
    {
      key: 'distilled_preview_arch', type: 'string', label: '蒸馏基座架构', title: 'distilled_preview_arch',
      desc: '留空则沿用本次训练的架构。不同家族的 LoRA 键空间不同，写错会导致一个模块都挂不上。',
      defaultValue: '', placeholder: '留空 = 与训练架构相同', visibleWhen: enabled,
    },
    {
      key: 'distilled_preview_steps', type: 'number', label: '蒸馏采样步数', title: 'distilled_preview_steps',
      desc: '允许 1~8。超过 8 就不再是快路径，模块会直接拒绝而不是慢慢跑。',
      defaultValue: 4, min: 1, max: 8, step: 1, visibleWhen: enabled,
    },
    {
      key: 'distilled_preview_guidance', type: 'number', label: '蒸馏基座 CFG', title: 'distilled_preview_guidance',
      desc: '蒸馏基座常用 1.0；留空则沿用训练预览的 CFG。',
      defaultValue: 1.0, min: 0, step: 0.5, visibleWhen: enabled,
    },
    {
      key: 'distilled_preview_vae', type: 'file', label: '独立 VAE（可选）', title: 'distilled_preview_vae',
      desc: '空表示用蒸馏基座自带的 VAE。',
      defaultValue: '', visibleWhen: enabled,
    },
  ],
};

// 只有本来就有预览设置的家族才加这一节：没有预览路径的家族加了也点不出图。
export function withDistilledPreview(sections) {
  if (sections.some((item) => item.id === section.id)) return sections;
  const index = sections.findIndex((item) => item.id === 'preview-settings');
  if (index < 0) return sections;
  return [...sections.slice(0, index + 1), section, ...sections.slice(index + 1)];
}
