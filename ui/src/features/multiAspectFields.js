// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Shared fields for routes with real caption-category and loss consumers.
const enabled = (config) => config.multi_aspect_guidance_enabled;

export const MULTI_ASPECT_FIELDS = [
  { key: 'multi_aspect_guidance_enabled', type: 'boolean', label: '多维审美引导', desc: '按实际 caption 分类分别计算辅助损失；需要带 categories 的 JSON caption，新建缓存会保留类别。旧缓存缺少类别时跳过，默认关闭。', defaultValue: false },
  { key: 'multi_aspect_guidance_weight', type: 'number', label: '多维引导权重', desc: '总辅助损失权重，大于 0 才参与训练；尚无通用推荐值。', defaultValue: 0.0, min: 0, step: 0.01, visibleWhen: enabled },
  { key: 'multi_aspect_guidance_adaptive_weights', type: 'boolean', label: '自适应维度权重', desc: '按各类别损失大小调整相对权重。', defaultValue: true, visibleWhen: enabled },
  { key: 'multi_aspect_guidance_aspect_weights', type: 'string', label: '维度权重 JSON', desc: '例如 {"style":1.0,"character":1.5}；类别名称来自 caption 标注。', defaultValue: '', visibleWhen: enabled },
  { key: 'multi_aspect_guidance_custom_scorers', type: 'string', label: '自定义 scorer JSON', desc: 'Anima 既有 scorer 映射；例如 {"style":"clip"}。普通文件路径不会自动加载任意模型。', defaultValue: '', visibleWhen: enabled },
  { key: 'multi_aspect_guidance_default_scorer', type: 'select', label: '默认 scorer', desc: 'latent_style_contrast 比较 latent 的统计特征，不代表身份或风格语义准确率；CLIP 沿 Anima 既有解码路径。', defaultValue: 'latent_style_contrast', options: [
    { value: 'latent_style_contrast', label: 'Latent 统计对照' },
    { value: 'clip_text_similarity', label: 'CLIP 文本相似度' },
  ], visibleWhen: enabled },
  { key: 'multi_aspect_guidance_min_t', type: 'number', label: '多维引导 σ 下界', desc: '仅噪声比例 σ≥该值的样本参与；每个类别只计算实际带该类别的样本。', defaultValue: 0.0, min: 0, max: 1, step: 0.05, visibleWhen: enabled },
  { key: 'multi_aspect_guidance_max_t', type: 'number', label: '多维引导 σ 上界', desc: '仅噪声比例 σ≤该值的样本参与。', defaultValue: 1.0, min: 0, max: 1, step: 0.05, visibleWhen: enabled },
];

export const LATENT_MULTI_ASPECT_FIELDS = MULTI_ASPECT_FIELDS
  .filter((field) => field.key !== 'multi_aspect_guidance_custom_scorers')
  .map((field) => field.key === 'multi_aspect_guidance_default_scorer'
    ? { ...field, options: [field.options[0], { ...field.options[1], disabled: true,
      label: 'CLIP（当前模型不支持，请手动选择 Latent）',
      label_zh: 'CLIP（当前模型不支持，请手动选择 Latent）',
      label_en: 'CLIP (unsupported on this model; select Latent manually)',
      disabledReason: 'Newbie / SD3 仅支持 Latent；保留旧草稿值，不自动改写算法。',
    }], desc: 'Newbie / SD3 当前支持 Latent 统计对照；旧 CLIP 草稿需手动改选。需要实际 caption 类别，不代表身份或风格语义准确率。' }
    : field);
