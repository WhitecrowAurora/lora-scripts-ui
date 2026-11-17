// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// UI exposure of existing shared-loss routes; no new backend adoption.
const supportedTypes = new Set(['anima-lora', 'newbie-lora', 'sd3-lora', 'sd-lora', 'sdxl-lora']);
const localClip = (config) => config.lulynx_embed_anchor_loader === 'local_clip_vision'
  || (!config.lulynx_embed_anchor_loader && config.lulynx_embed_anchor_model_id === 'lulynx-local/clip-vit-vision');
const field = (name, type, label, label_en, defaultValue, desc, desc_en, extra = {}) => ({
  key: `lulynx_embed_anchor_${name}`, type, label, label_en, defaultValue, desc, desc_en, ...extra,
});
const fields = [
  field('enabled', 'boolean', '视觉嵌入锚', 'Visual embedding anchor', false,
    '用冻结视觉模型比较预测图与目标图的嵌入。需要 VAE 解码和额外视觉模型，增加内存与计算；默认关闭。',
    'Compare predicted and target image embeddings through a frozen vision model. Requires VAE decoding and an extra model; off by default.'),
  field('weight', 'number', '嵌入锚权重', 'Embedding anchor weight', 0,
    '大于 0 才参与损失；0 不加载嵌入模型。尚无通用推荐值。', 'A positive value activates the loss. Zero does not load the embedding model.', { min: 0, step: 0.01 }),
  field('model_id', 'string', '嵌入模型 ID 或目录', 'Embedding model ID or directory', 'minchul/cvlface_adaface_vit_base_webface4m',
    '默认是 AdaFace 人脸模型。通用 CLIP 请选择 lulynx-local/clip-vit-vision 并填权重路径；它比较视觉语义，不代表同人身份。任意模型文件不保证兼容。',
    'Defaults to AdaFace. For local CLIP use lulynx-local/clip-vit-vision and a weights path. CLIP measures visual semantics, not identity. Arbitrary checkpoints are not guaranteed compatible.'),
  field('loader', 'select', '嵌入模型加载方式', 'Embedding model loader', '',
    '按模型档案选择可使用已知预处理。HF AutoModel 要求兼容的图像输入/嵌入输出；本地 CLIP 只支持 CLIP 视觉塔权重。',
    'The model profile supplies known preprocessing. HF AutoModel requires compatible image inputs and embeddings; local CLIP accepts CLIP vision weights only.', { options: [
      { value: '', label: '按模型档案', label_en: 'Model profile' },
      { value: 'hf_automodel', label: 'HF AutoModel', label_en: 'HF AutoModel' },
      { value: 'local_clip_vision', label: '本地 CLIP 视觉塔', label_en: 'Local CLIP vision tower' },
    ] }),
  field('weights_path', 'string', '本地 CLIP 权重路径', 'Local CLIP weights path', '',
    'CLIP 权重文件或目录；读取相邻 config.json。无配置的裸权重使用原档案，不能从形状推断激活函数。HF AutoModel 不读取此字段。',
    'CLIP weight file or directory, with adjacent config.json when available. Bare weights use their profile; activation cannot be inferred from shapes. HF AutoModel ignores this field.'),
  field('local_files_only', 'boolean', '仅使用本地模型文件', 'Local model files only', false,
    '开启后 HF 加载器不下载；本地 CLIP 加载器始终只读本地路径。', 'Prevent HF downloads. The local CLIP loader always reads local files only.'),
  field('trust_remote_code', 'boolean', '允许嵌入模型自定义代码', 'Allow custom embedding model code', false,
    '仅 HF 加载器使用；仅在理解并信任所选模型代码时开启。默认关闭。', 'HF loader only. Enable only for a selected model whose custom code you trust; off by default.'),
  field('min_t', 'number', '嵌入锚 σ 下界', 'Embedding anchor minimum sigma', 0,
    '只计算该噪声比例以上的样本。', 'Only evaluate samples at or above this noise fraction.', { min: 0, max: 1, step: 0.05 }),
  field('max_t', 'number', '嵌入锚 σ 上界', 'Embedding anchor maximum sigma', 1,
    '只计算该噪声比例以下的样本；上下界须递增。epsilon 在 σ=1 无法恢复干净图。', 'Only evaluate samples at or below this fraction; maximum must be at least minimum. Epsilon cannot recover a clean sample at sigma=1.', { min: 0, max: 1, step: 0.05 }),
  field('input_size', 'number', '嵌入输入尺寸覆盖', 'Embedding input size override', 0,
    '0 使用档案/本地 CLIP 配置；显式覆盖支持 32–1024，必须与模型的位置编码兼容。', 'Zero uses the profile/local CLIP config. Explicit values must be 32–1024 and compatible with model position embeddings.', { min: 0, max: 1024, step: 1 }),
  field('norm_mean', 'string', 'RGB 均值覆盖', 'RGB mean override', '',
    '留空使用档案；自定义时填 3 个逗号分隔数值。', 'Leave empty for the profile; otherwise enter three comma-separated RGB values.'),
  field('norm_std', 'string', 'RGB 标准差覆盖', 'RGB standard deviation override', '',
    '留空使用档案；自定义时填 3 个非零数值，必须符合模型预处理。', 'Leave empty for the profile; otherwise enter three nonzero values matching model preprocessing.'),
];

export function withEmbedAnchorFields(sections, typeId) {
  if (!supportedTypes.has(typeId)) return sections;
  const needsFlow = typeId === 'sd-lora' || typeId === 'sdxl-lora';
  return [...sections, {
    id: 'embed-anchor', tab: 'frontier', title: '视觉嵌入锚', title_en: 'Visual embedding anchor',
    description: '全图缩放，无人脸检测/对齐；人脸模型仅适合居中单人肖像。只使用已接入的线性 flow 路线。',
    guideEntryKey: 'lulynx_embed_anchor_enabled',
    fields: fields.map((item) => {
      const visibleWhen = (config) => (!needsFlow || config.flow_model === true)
        && (item.key === 'lulynx_embed_anchor_enabled' || config.lulynx_embed_anchor_enabled)
        && (item.key !== 'lulynx_embed_anchor_weights_path' || localClip(config))
        && (item.key !== 'lulynx_embed_anchor_trust_remote_code' || !localClip(config));
      visibleWhen.deps = new Set(['flow_model', 'lulynx_embed_anchor_enabled', 'lulynx_embed_anchor_loader', 'lulynx_embed_anchor_model_id']);
      return { ...item, visibleWhen };
    }),
  }];
}
