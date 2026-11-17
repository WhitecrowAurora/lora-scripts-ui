// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Fields for the existing post-training diagnostic providers.
const metricVisible = (name) => {
  const visible = (config) => {
    const raw = config.quality_evaluation_metrics;
    const values = Array.isArray(raw) ? raw : String(raw || '').split(/[;,]/);
    return config.quality_evaluation_enabled === true
      && values.some((value) => String(value).trim().toLowerCase().replaceAll('-', '_') === name);
  };
  visible.deps = new Set(['quality_evaluation_enabled', 'quality_evaluation_metrics']);
  return visible;
};
const readback = metricVisible('spectra_readback');
const classes = metricVisible('class_drift');
const prototypes = (config) => classes(config) && ['clip_generated_prototypes', 'dinov2_gaussian'].includes(config.quality_class_method);
prototypes.deps = new Set([...classes.deps, 'quality_class_method']);
const gaussian = (config) => classes(config) && config.quality_class_method === 'dinov2_gaussian';
gaussian.deps = new Set(prototypes.deps);
const sae = (config) => classes(config) && config.quality_class_method === 'dinov2_sae';
sae.deps = new Set(prototypes.deps);
const classLabels = (config) => classes(config) && !sae(config);
classLabels.deps = new Set(prototypes.deps);
const clip = (config) => classes(config) && !['dinov2_gaussian', 'dinov2_sae'].includes(config.quality_class_method);
clip.deps = new Set(prototypes.deps);
const dinoSimilarity = metricVisible('dino_i');
const copyRisk = metricVisible('copy_risk');
const dino = (config) => gaussian(config) || dinoSimilarity(config) || copyRisk(config);
dino.deps = new Set(prototypes.deps);
const dinoCode = (config) => dino(config) || sae(config);
dinoCode.deps = new Set(prototypes.deps);
const field = (key, label, label_en, desc, desc_en, visibleWhen, extra = {}) => ({
  key, type: 'string', label, label_zh: label, label_en, desc, desc_zh: desc, desc_en, defaultValue: '', visibleWhen,
  guideEntryKey: 'quality_readback_model_path', ...extra,
});
const deviceOptions = [{ value: 'cpu', label: 'CPU' }, { value: 'cuda', label: 'CUDA' }];

export const QUALITY_DIAGNOSTIC_FIELDS = [
  field('quality_readback_model_path', '提示词回读模型目录', 'Prompt readback model directory',
    'spectra_readback 使用本地视觉语言模型计算图像条件下的提示词平均对数概率。不会下载模型；无通用质量推荐。',
    'spectra_readback measures image-conditioned prompt log probability with a local vision-language model. No downloads or established general quality recommendation.', readback),
  field('quality_readback_processor_path', '回读处理器目录', 'Readback processor directory',
    '留空复用模型目录；只读已有本地文件，不执行自定义模型代码。',
    'Leave blank to use the model directory. Local files only; custom model code is disabled.', readback),
  field('quality_readback_device', '回读评估设备', 'Readback evaluation device',
    'CPU节省显存；CUDA会额外占用显存。', 'CPU saves GPU memory; CUDA uses additional GPU memory.', readback,
    { type: 'select', defaultValue: 'cpu', options: deviceOptions }),
  field('quality_class_method', '图像诊断方法', 'Image diagnostic method',
    '默认比较 CLIP 固定类别相对概率。CLIP 原型与 DINOv2 Gaussian 比较独立测试集分类；DINOv2 SAE 对相同提示词与 seed 的基模/检查点图像观察概念能量变化，不代表质量或因果。',
    'Default: fixed-class CLIP probabilities. Prototypes and Gaussian classify independent references. DINOv2 SAE compares concept energies of base/checkpoint images with matched prompts and seeds; it is not a quality or causal score.', classes,
    { type: 'select', defaultValue: 'clip_fixed_class_softmax', options: [
      { value: 'clip_fixed_class_softmax', label: 'CLIP 固定类别相对概率', label_en: 'CLIP fixed-class relative probabilities' },
      { value: 'clip_generated_prototypes', label: 'CLIP 生成图原型', label_en: 'CLIP generated prototypes' },
      { value: 'dinov2_gaussian', label: 'DINOv2 Gaussian 分类', label_en: 'DINOv2 Gaussian classification' },
      { value: 'dinov2_sae', label: 'DINOv2 SAE 图像概念', label_en: 'DINOv2 SAE image concepts' },
    ] }),
  field('quality_sae_encoder_path', 'SAE encoder 文件', 'SAE encoder file',
    '本地 RA-SAE-DINOv2-32k encoder safetensors，含投影、LayerNorm 与评估阈值元数据；不直接载入原始 pickle 或大 decoder。仅 CPU 评估，需开启基础模型对比。',
    'Local RA-SAE-DINOv2-32k encoder safetensors with projection, LayerNorm and evaluation metadata. CPU evaluation only; enable base comparison. Original pickle/decoder files are not loaded.', sae,
    { type: 'file', pickerType: 'file' }),
  field('quality_sae_dino_model_path', 'SAE 的 DINOv2 register 权重', 'SAE DINOv2 register weights',
    '匹配 dinov2_vitb14_reg 的本地权重（4 个 register）。不复用 Gaussian/DINO-I 的模型文件，不自动下载。',
    'Local dinov2_vitb14_reg weights with four register tokens. Separate from Gaussian/DINO-I weights; no automatic download.', sae,
    { type: 'file', pickerType: 'file' }),
  field('quality_class_reference_manifest', '独立标注测试集清单', 'Independently labelled reference manifest',
    '本地 JSON 路径，格式见帮助；填写标签出处、样本 ID、类别和图片路径。至少两类，各类需有生成原型和独立测试图；测试图不能与生成原型同图。不会从预测结果生成标签。',
    'Local JSON path; see help for the format. Supply label source, sample ID, class and image path. At least two classes need generated prototypes and independent test images; prototype/test overlap is rejected. Predictions do not supply labels.', prototypes),
  field('quality_class_model_path', '逐类诊断 CLIP 目录', 'Class diagnostic CLIP directory',
    'class_drift 使用本地完整 CLIP 模型与处理器；不是仅视觉塔权重。固定类别方法比较相对概率，生成图原型方法比较独立测试集准确率。',
    'class_drift requires a local full CLIP model and processor, not vision-only weights. Fixed classes compare relative probabilities; generated prototypes compare independent-test accuracy.', clip),
  field('quality_class_processor_path', '逐类诊断处理器目录', 'Class diagnostic processor directory',
    '留空复用 CLIP 模型目录；不下载文件。', 'Leave blank to use the CLIP model directory; no downloads.', clip),
  field('quality_class_device', '逐类诊断设备', 'Class diagnostic device',
    'CPU节省显存；CUDA会额外占用显存。', 'CPU saves GPU memory; CUDA uses additional GPU memory.', clip,
    { type: 'select', defaultValue: 'cpu', options: deviceOptions }),
  field('quality_dino_model_path', 'DINOv2 权重文件', 'DINOv2 weights',
    '使用本地 DINOv2 权重；Gaussian 使用 CLS，DINO-I 保持原特征协议。不下载。',
    'Local DINOv2 weights. Gaussian uses CLS; DINO-I keeps its own feature protocol. No downloads.', dino,
    { type: 'file', pickerType: 'file' }),
  field('quality_dino_code_path', 'DINOv2 本地代码目录', 'DINOv2 local code directory',
    '已有官方 DINOv2 hub 代码目录，需含 hubconf.py。',
    'Existing official DINOv2 hub directory containing hubconf.py.', dinoCode,
    { type: 'folder', pickerType: 'folder' }),
  field('quality_dino_model', 'DINOv2 模型名', 'DINOv2 model name',
    '必须与权重匹配，例如 dinov2_vits14。模型维度与预处理随报告保存。',
    'Must match the weights, for example dinov2_vits14. Feature dimensions and preprocessing are recorded.', dino,
    { defaultValue: 'dinov2_vits14' }),
  field('quality_dino_device', 'DINOv2 评估设备', 'DINOv2 evaluation device',
    'CPU节省显存；auto 跟随训练设备。', 'CPU saves GPU memory; auto uses the training device.', dino,
    { type: 'select', defaultValue: 'cpu', options: [...deviceOptions, { value: 'auto', label: 'Auto' }] }),
  field('quality_class_gaussian_regularization', 'Gaussian 协方差正则项', 'Gaussian covariance regularization',
    '全协方差加 epsilon I，默认 1e-8。每类至少两张不同生成图且特征有变化；小样本协方差仍秩不足，报告会保留实际秩，不代表质量校准。',
    'Adds epsilon I to full covariance; default 1e-8. Each class needs two distinct generated images with feature variation. Small samples remain low rank and do not establish calibrated quality.', gaussian,
    { type: 'number', defaultValue: 1e-8, min: 1e-12, step: 1e-8 }),
  field('quality_class_labels', '固定类别表', 'Fixed class labels',
    '每行一个类别或 JSON 字符串数组；至少两个不同的非空类别。固定类别方法使用 a photo of {类别} 文本模板；生成图原型方法按这些类别构建图像原型。',
    'One class per line or a JSON string array; at least two distinct nonempty labels. Fixed-class CLIP uses a photo of {class}; The prototype method builds image prototypes for these classes.', classLabels,
    { type: 'textarea', placeholder: 'cat\ndog' }),
  field('quality_class_prompt_labels', '各评估提示词的类别', 'Class per evaluation prompt',
    '顺序对应实际评估提示词，每行一个或 JSON 数组；留空行表示该提示词不参与逐类评分，不会挪动后续类别。类别必须来自固定表。开启基础模型对比才能计算退化。',
    'One line or JSON entry per actual evaluation prompt. Blank entries stay unlabelled without shifting later labels. Use the fixed taxonomy and enable base comparison to measure changes.', classLabels,
    { type: 'textarea', placeholder: '["cat", "", "dog"]' }),
  field('quality_class_degradation_threshold', '逐类评分下降阈值', 'Per-class score drop threshold',
    '固定类别方法比较概率下降，生成图原型方法比较准确率下降（均为0–1数值）。0 保留所有下降观察，不会据此停训或改参数。',
    'Compare a probability drop for fixed-class CLIP or an accuracy drop for generated prototypes (both on a 0–1 scale). Zero preserves every decrease; this does not stop training or change parameters.', classLabels,
    { type: 'number', defaultValue: 0, min: 0, step: 0.01 }),
];
