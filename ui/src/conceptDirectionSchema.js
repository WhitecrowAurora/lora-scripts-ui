import { when } from './schemaCommon.js';

const enabled = when('concept_direction_enabled', true);
const field = (name, type, label, defaultValue, desc, extra = {}) => ({
  key: `concept_direction_${name}`, type, label, defaultValue, desc,
  title: `concept_direction_${name}`, visibleWhen: enabled, ...extra,
});

const section = {
  id: 'concept-direction',
  tab: 'training',
  title: '概念方向训练 · Concept Direction',
  description: '适用于 SD1.5 / SDXL 标准 LoRA。使用前请将训练范围设为仅 UNet，保留已加载且冻结的文本编码器（live TE），并关闭文本编码器输出缓存及其磁盘缓存。每个触发步会额外执行 4 次 UNet 前向，增加训练时间与显存需求；可提高步间隔降低触发频率。',
  fields: [
    field('enabled', 'boolean', '启用概念方向训练', false,
      '通过正向与负向描述学习概念差异。默认关闭；关闭后保留已填写内容。', { visibleWhen: undefined }),
    field('pairs', 'concept_direction_pairs', '概念对', '',
      '正向描述希望增强的概念，负向描述对应的对照；每对两侧都需填写。可添加多对，建议每对只改变一个概念。'),
    field('weight', 'number', '概念损失权重', 1.0,
      '概念方向损失在总损失中的权重；0 表示方向项不计入总损失。', { min: 0, step: 0.1 }),
    field('guidance_scale', 'number', '方向引导强度', 1.0,
      '控制正负概念预测差异的强度；0 为零引导。', { min: 0, step: 0.1 }),
    field('timestep_range', 'string', '采样时间步范围', '',
      '留空使用全部时间步；输入“起点,终点”，如 200,800，包含起点、不包含终点。',
      { placeholder: '留空使用全部时间步，例如 200,800' }),
    field('neutral_reg', 'number', '中性正则强度', 0.0,
      '让负向提示词下的预测保持接近底模，减少对照概念偏移；0 表示关闭。', { min: 0, step: 0.1 }),
    field('every_n_steps', 'number', '触发步间隔', 1,
      '每隔多少步计算一次概念方向损失；1 为每步。增大间隔可降低额外计算成本。', { min: 1, step: 1 }),
  ],
};

const animaSection = {
  ...section,
  description: '实验功能：适用于 Anima 标准 LoRA、faithful forward，需冻结 Qwen3 文本编码器与 LLM adapter；允许使用文本缓存。现有短训尚未证明稳定的概念方向收益。每个触发步会额外执行 4 次 DiT 前向，增加训练时间与显存需求；可提高步间隔降低触发频率。',
};

const sliderEnabled = when('slider_lora_enabled', true);
const sliderField = (name, type, label, defaultValue, desc, extra = {}) => ({
  key: `slider_lora_${name}`, type, label, defaultValue, desc,
  title: `slider_lora_${name}`, visibleWhen: sliderEnabled, ...extra,
});

// Slider 与 concept direction 共用同四次参考前向, 同时开会把两条轴写进同一个
// delta —— 构建期会直接报错。这里把两者的说明写清楚, 让用户在勾选前就看到冲突。
const sliderSection = {
  id: 'slider-lora',
  tab: 'training',
  title: '滑块 LoRA · Slider LoRA',
  description: '把 LoRA 训成「一条可调轴」：导出文件会写入轴名、方向对、强度范围与承载它的 block，因此别人拿到文件就知道怎么推。与「概念方向训练」共用同一组参考前向，两者只能开一个。额外成本同样是每触发步 4 次前向。',
  fields: [
    sliderField('enabled', 'boolean', '启用滑块 LoRA', false,
      '默认关闭；关闭后保留已填写内容。与概念方向训练互斥。', { visibleWhen: undefined }),
    sliderField('pairs', 'concept_direction_pairs', '轴向提示词对', '',
      '一对提示词定义轴的两端（正向为推高方向）。多对会按各自幅度归一后合并，建议只描述同一个概念。'),
    sliderField('name', 'string', '轴名称', 'concept_slider',
      '写进文件元数据；同一轴的两条滑块可以叠加，不同轴不能。'),
    sliderField('weight', 'number', '损失权重', 1.0,
      '方向损失在总损失中的权重；0 表示方向项不计入。', { min: 0, step: 0.1 }),
    sliderField('guidance_scale', 'number', '引导强度', 1.0,
      '目标方向相对底模方向的倍数；1 为与底模自身方向一致。', { min: 0, step: 0.1 }),
    sliderField('strength_min', 'number', '最低强度', -2.0,
      '滑块可以推到的最低值；超出该值的请求会被夹住。绝对值上限 3。', { min: -3, max: 3, step: 0.1 }),
    sliderField('strength_max', 'number', '最高强度', 2.0,
      '滑块可以推到的最高值；绝对值上限 3，超过 3 时适配器开始和底模对抗而不是引导。', { min: -3, max: 3, step: 0.1 }),
    sliderField('neutral', 'number', '中性点', 0.0,
      '该强度下按训练原样生效（倍数 1.0）；须落在最低与最高之间。', { min: -3, max: 3, step: 0.1 }),
    sliderField('every_n_steps', 'number', '触发步间隔', 1,
      '每隔多少步计算一次；1 为每步。', { min: 1, step: 1 }),
    sliderField('block_normalize', 'boolean', '按幅度归一每一对', true,
      '把每对提示词的底模差异归一后再训练，避免幅度大的一对主导整个轴。多对时建议保持开启。'),
  ],
};

export function withConceptDirection(sections, typeId) {
  const source = sections.filter((item) => item.id !== section.id && item.id !== sliderSection.id);
  if (!['sd-lora', 'sdxl-lora', 'anima-lora'].includes(typeId)) return source.length === sections.length ? sections : source;
  const trainingIndex = source.findIndex((item) => item.id === 'training-settings');
  const index = trainingIndex < 0 ? source.length : trainingIndex + 1;
  const pairSection = typeId === 'anima-lora' ? animaSection : section;
  return [...source.slice(0, index), pairSection, sliderSection, ...source.slice(index)];
}
