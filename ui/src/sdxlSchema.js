// ================================================================
// sdxlSchema.js — 多训练类型 Schema 系统
// 支持: LoRA / Finetune / ControlNet / Textual Inversion 全系列
// ================================================================

export const UI_TABS = [
  { key: 'model', label: '模型' },
  { key: 'dataset', label: '数据集' },
  { key: 'network', label: '网络' },
  { key: 'optimizer', label: '优化器' },
  { key: 'training', label: '训练' },
  { key: 'preview', label: '预览/验证' },
  { key: 'speed', label: '加速' },
  { key: 'advanced', label: '高级' },
];

function when(key, expected) { return (c) => c[key] === expected; }
function all(...fns) { return (c) => fns.every((f) => f(c)); }

// ================================================================
// 训练类型注册表
// ================================================================
export const TRAINING_TYPES = [
  // LoRA
  { id: 'sdxl-lora',          group: 'LoRA',              label: 'SDXL' },
  { id: 'sd-lora',            group: 'LoRA',              label: 'SD 1.5' },
  { id: 'flux-lora',          group: 'LoRA',              label: 'FLUX' },
  { id: 'sd3-lora',           group: 'LoRA',              label: 'SD3' },
  { id: 'lumina-lora',        group: 'LoRA',              label: 'Lumina' },
  { id: 'hunyuan-image-lora', group: 'LoRA',              label: '混元图像' },
  { id: 'anima-lora',         group: 'LoRA',              label: 'Anima' },
  // Finetune
  { id: 'sd-dreambooth',      group: 'Finetune',          label: 'SD DreamBooth' },
  { id: 'sdxl-finetune',      group: 'Finetune',          label: 'SDXL' },
  { id: 'flux-finetune',      group: 'Finetune',          label: 'FLUX' },
  { id: 'sd3-finetune',       group: 'Finetune',          label: 'SD3' },
  { id: 'lumina-finetune',    group: 'Finetune',          label: 'Lumina' },
  { id: 'anima-finetune',     group: 'Finetune',          label: 'Anima' },
  // ControlNet
  { id: 'sd-controlnet',      group: 'ControlNet',        label: 'SD 1.5' },
  { id: 'sdxl-controlnet',    group: 'ControlNet',        label: 'SDXL' },
  { id: 'flux-controlnet',    group: 'ControlNet',        label: 'FLUX' },
  // Textual Inversion
  { id: 'sd-textual-inversion',   group: 'Textual Inversion', label: 'SD 1.5 TI' },
  { id: 'sdxl-textual-inversion', group: 'Textual Inversion', label: 'SDXL TI' },
];

// ================================================================
// 共享字段片段
// ================================================================
const S_SAVE = [
  { key: 'output_name', type: 'string', label: '模型保存名称', defaultValue: 'aki' },
  { key: 'output_dir', type: 'folder', pickerType: 'folder', label: '模型保存文件夹', defaultValue: './output' },
  { key: 'save_model_as', type: 'select', label: '保存格式', defaultValue: 'safetensors', options: ['safetensors', 'pt', 'ckpt'] },
  { key: 'save_precision', type: 'select', label: '保存精度', defaultValue: 'fp16', options: ['fp16', 'float', 'bf16'] },
  { key: 'save_every_n_epochs', type: 'number', label: '每 N 轮保存', defaultValue: 2, min: 1 },
  { key: 'save_every_n_steps', type: 'number', label: '每 N 步保存', defaultValue: '', min: 1 },
  { key: 'save_state', type: 'boolean', label: '保存训练状态', defaultValue: false },
  { key: 'save_state_on_train_end', type: 'boolean', label: '结束时额外保存状态', defaultValue: false },
  { key: 'save_last_n_epochs_state', type: 'number', label: '保留最近 N 个 epoch 状态', defaultValue: '', min: 1, visibleWhen: when('save_state', true) },
];
const S_CAPTION = [
  { key: 'caption_extension', type: 'string', label: 'Tag 文件扩展名', defaultValue: '.txt' },
  { key: 'shuffle_caption', type: 'boolean', label: '随机打乱标签', defaultValue: false },
  { key: 'weighted_captions', type: 'boolean', label: '使用带权重 token', defaultValue: false },
  { key: 'keep_tokens', type: 'number', label: '保留前 N 个 token', defaultValue: 0, min: 0, max: 255 },
  { key: 'max_token_length', type: 'number', label: '最大 token 长度', defaultValue: 255, min: 1 },
  { key: 'caption_dropout_rate', type: 'number', label: '全部标签丢弃概率', defaultValue: '', min: 0, step: 0.01 },
];
const S_LR = [
  { key: 'learning_rate', type: 'string', label: '总学习率', defaultValue: '1e-4' },
  { key: 'unet_lr', type: 'string', label: 'U-Net 学习率', defaultValue: '1e-4' },
  { key: 'text_encoder_lr', type: 'string', label: '文本编码器学习率', defaultValue: '1e-5' },
  { key: 'lr_scheduler', type: 'select', label: '学习率调度器', defaultValue: 'cosine_with_restarts', options: ['linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup'] },
  { key: 'lr_warmup_steps', type: 'number', label: '预热步数', defaultValue: 0, min: 0 },
  { key: 'lr_scheduler_num_cycles', type: 'number', label: '重启次数', defaultValue: 1, min: 1, visibleWhen: when('lr_scheduler', 'cosine_with_restarts') },
  { key: 'optimizer_type', type: 'select', label: '优化器', defaultValue: 'AdamW8bit', options: ['AdamW', 'AdamW8bit', 'PagedAdamW8bit', 'Lion', 'Lion8bit', 'DAdaptation', 'DAdaptAdam', 'DAdaptLion', 'AdaFactor', 'Prodigy'] },
  { key: 'min_snr_gamma', type: 'number', label: 'Min-SNR Gamma', defaultValue: '', min: 0, step: 0.1 },
];
const S_TRAIN = (epochs = 10) => [
  { key: 'max_train_epochs', type: 'number', label: '最大训练轮数', defaultValue: epochs, min: 1 },
  { key: 'train_batch_size', type: 'slider', label: '批量大小', defaultValue: 1, min: 1, max: 32, step: 1 },
  { key: 'gradient_checkpointing', type: 'boolean', label: '梯度检查点', defaultValue: true },
  { key: 'gradient_accumulation_steps', type: 'number', label: '梯度累加步数', defaultValue: 1, min: 1 },
  { key: 'network_train_unet_only', type: 'boolean', label: '仅训练 U-Net / DiT', defaultValue: true },
  { key: 'network_train_text_encoder_only', type: 'boolean', label: '仅训练文本编码器', defaultValue: false },
];
const S_PREVIEW = [
  { key: 'enable_preview', type: 'boolean', label: '启用预览图', defaultValue: false },
  { key: 'randomly_choice_prompt', type: 'boolean', label: '随机选择提示词', defaultValue: false, visibleWhen: when('enable_preview', true) },
  { key: 'prompt_file', type: 'file', pickerType: 'text-file', label: '提示词文件路径', defaultValue: '', visibleWhen: when('enable_preview', true) },
  { key: 'positive_prompts', type: 'textarea', label: '正向提示词', defaultValue: 'masterpiece, best quality, 1girl, solo', visibleWhen: when('enable_preview', true) },
  { key: 'negative_prompts', type: 'textarea', label: '反向提示词', defaultValue: 'lowres, bad anatomy, bad hands, text, error', visibleWhen: when('enable_preview', true) },
  { key: 'sample_width', type: 'number', label: '预览图宽度', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
  { key: 'sample_height', type: 'number', label: '预览图高度', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
  { key: 'sample_cfg', type: 'number', label: 'CFG 系数', defaultValue: 7, min: 1, max: 30, visibleWhen: when('enable_preview', true) },
  { key: 'sample_steps', type: 'number', label: '采样步数', defaultValue: 24, min: 1, max: 300, visibleWhen: when('enable_preview', true) },
  { key: 'sample_sampler', type: 'select', label: '采样器', defaultValue: 'euler_a', options: ['ddim', 'pndm', 'lms', 'euler', 'euler_a', 'heun', 'dpm_2', 'dpm_2_a', 'dpmsolver', 'dpmsolver++'], visibleWhen: when('enable_preview', true) },
  { key: 'log_with', type: 'select', label: '日志模块', defaultValue: 'tensorboard', options: ['tensorboard', 'wandb'] },
  { key: 'logging_dir', type: 'folder', pickerType: 'folder', label: '日志保存文件夹', defaultValue: './logs' },
];
const S_SPEED_SDXL = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', defaultValue: 'bf16', options: ['no', 'fp16', 'bf16'] },
  { key: 'xformers', type: 'boolean', label: '启用 xformers', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', defaultValue: true },
  { key: 'sageattn', type: 'boolean', label: '启用 SageAttention', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', defaultValue: false },
  { key: 'lowram', type: 'boolean', label: '低内存模式', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', defaultValue: true },
  { key: 'cache_text_encoder_outputs', type: 'boolean', label: '缓存文本编码器输出', defaultValue: true },
  { key: 'cache_text_encoder_outputs_to_disk', type: 'boolean', label: '缓存文本编码器输出到磁盘', defaultValue: false },
];
const S_SPEED_FLOW = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', defaultValue: 'bf16', options: ['no', 'fp16', 'bf16'] },
  { key: 'fp8_base', type: 'boolean', label: '基础模型使用 FP8', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', defaultValue: true },
  { key: 'sageattn', type: 'boolean', label: '启用 SageAttention', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', defaultValue: false },
  { key: 'lowram', type: 'boolean', label: '低内存模式', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', defaultValue: true },
  { key: 'cache_text_encoder_outputs', type: 'boolean', label: '缓存文本编码器输出', defaultValue: true },
  { key: 'cache_text_encoder_outputs_to_disk', type: 'boolean', label: '缓存文本编码器输出到磁盘', defaultValue: true },
  { key: 'blocks_to_swap', type: 'number', label: 'Block 交换数', desc: '在 CPU/GPU 间交换的 block 数量，省显存。', defaultValue: '', min: 1 },
  { key: 'disable_mmap_load_safetensors', type: 'boolean', label: '禁用 mmap 加载', defaultValue: false },
];
const S_SPEED_SD15 = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', defaultValue: 'fp16', options: ['no', 'fp16', 'bf16'] },
  { key: 'xformers', type: 'boolean', label: '启用 xformers', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', defaultValue: true },
];
const S_ADV = [
  { key: 'noise_offset', type: 'number', label: '噪声偏移', defaultValue: '', step: 0.01 },
  { key: 'seed', type: 'number', label: '随机种子', defaultValue: 1337 },
  { key: 'clip_skip', type: 'slider', label: 'CLIP 跳层', defaultValue: 2, min: 0, max: 12, step: 1 },
  { key: 'masked_loss', type: 'boolean', label: '启用蒙版损失', defaultValue: false },
  { key: 'alpha_mask', type: 'boolean', label: '读取 Alpha 通道作为 Mask', defaultValue: false },
  { key: 'training_comment', type: 'textarea', label: '训练备注', defaultValue: '' },
  { key: 'ui_custom_params', type: 'textarea', label: '自定义 TOML 覆盖', desc: '危险：会直接覆盖界面中的参数。', defaultValue: '' },
];

// dataset fields helper
const ds = (reso, bucketMax = 2048, bucketStep = 64, extra = []) => [
  { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练数据集路径', defaultValue: './train/aki' },
  { key: 'reg_data_dir', type: 'folder', pickerType: 'folder', label: '正则化数据集路径', defaultValue: '' },
  { key: 'prior_loss_weight', type: 'number', label: '先验损失权重', defaultValue: 1, min: 0, step: 0.1 },
  { key: 'resolution', type: 'string', label: '训练分辨率', defaultValue: reso },
  { key: 'enable_bucket', type: 'boolean', label: '启用分桶', defaultValue: true },
  { key: 'min_bucket_reso', type: 'number', label: '桶最小分辨率', defaultValue: 256 },
  { key: 'max_bucket_reso', type: 'number', label: '桶最大分辨率', defaultValue: bucketMax },
  { key: 'bucket_reso_steps', type: 'number', label: '桶划分单位', defaultValue: bucketStep },
  { key: 'bucket_no_upscale', type: 'boolean', label: '桶不放大图片', defaultValue: true },
  ...extra,
];

// LoRA network fields helper
const netLora = (mod, dim = 32, alpha = 32, maxDim = 512, extra = []) => [
  { key: 'network_module', type: 'select', label: '训练网络模块', defaultValue: mod, options: [mod, ...(mod.includes('lycoris') ? [] : ['lycoris.kohya'])] },
  { key: 'network_weights', type: 'file', pickerType: 'model-file', label: '继续训练 LoRA', defaultValue: '' },
  { key: 'network_dim', type: 'slider', label: '网络维度', defaultValue: dim, min: 1, max: maxDim, step: 1 },
  { key: 'network_alpha', type: 'slider', label: '网络 Alpha', defaultValue: alpha, min: 1, max: maxDim, step: 1 },
  { key: 'network_dropout', type: 'number', label: '网络 Dropout', defaultValue: 0, min: 0, step: 0.01 },
  { key: 'dim_from_weights', type: 'boolean', label: '从权重推断 Dim', defaultValue: false },
  { key: 'scale_weight_norms', type: 'number', label: '最大范数正则化', defaultValue: '', min: 0, step: 0.01 },
  { key: 'lycoris_algo', type: 'select', label: 'LyCORIS 算法', defaultValue: 'locon', options: ['locon', 'loha', 'lokr', 'ia3', 'dylora', 'glora', 'diag-oft', 'boft'], visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'conv_dim', type: 'number', label: '卷积维度', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'conv_alpha', type: 'number', label: '卷积 Alpha', defaultValue: 1, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'enable_base_weight', type: 'boolean', label: '启用基础权重', defaultValue: false },
  ...extra,
];

// flow-based model params helper
const flowParams = (defaults = {}) => [
  { key: 'timestep_sampling', type: 'select', label: '时间步采样', defaultValue: defaults.ts || 'sigmoid', options: ['sigma', 'uniform', 'sigmoid', 'shift', 'flux_shift'] },
  { key: 'sigmoid_scale', type: 'number', label: 'sigmoid 缩放', defaultValue: defaults.ss || 1.0, step: 0.001 },
  { key: 'model_prediction_type', type: 'select', label: '模型预测类型', defaultValue: defaults.mp || 'raw', options: ['raw', 'additive', 'sigma_scaled'] },
  { key: 'discrete_flow_shift', type: 'number', label: '离散流位移', defaultValue: defaults.dfs || 1.0, step: 0.001 },
  { key: 'guidance_scale', type: 'number', label: 'CFG 引导缩放', defaultValue: defaults.gs || 1.0, step: 0.01 },
  { key: 'weighting_scheme', type: 'select', label: '权重策略', defaultValue: defaults.ws || 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
  { key: 'loss_type', type: 'select', label: '损失函数类型', defaultValue: defaults.lt || 'l2', options: ['l1', 'l2', 'huber', 'smooth_l1'] },
];

// helper: section factory
const sec = (id, tab, title, desc, fields) => ({ id, tab, title, description: desc, fields });

// ================================================================
// SECTIONS 定义: 每种训练类型
// ================================================================

// ---- SDXL LoRA ----
const SDXL_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL 底模、VAE 与恢复训练。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sdxl-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SDXL 底模路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', defaultValue: false },
    { key: 'zero_terminal_snr', type: 'boolean', label: '零终端 SNR', defaultValue: true, visibleWhen: when('v_parameterization', true) },
    { key: 'scale_v_pred_loss_like_noise_pred', type: 'boolean', label: '缩放 v-pred 损失', defaultValue: true, visibleWhen: when('v_parameterization', true) },
  ]),
  sec('save-settings', 'model', '保存设置', '输出路径、格式与训练状态。', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '训练数据、正则图与分桶。', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '标签打乱与丢弃策略。', [...S_CAPTION]),
  sec('network-settings', 'network', '网络设置', 'LoRA / LyCORIS 参数。', netLora('networks.lora', 32, 32, 512, [
    { key: 'dora_wd', type: 'boolean', label: '启用 DoRA', defaultValue: false },
    { key: 'dylora_unit', type: 'number', label: 'DyLoRA 分块', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'networks.dylora') },
    { key: 'enable_block_weights', type: 'boolean', label: '启用分层学习率', defaultValue: false },
  ])),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '学习率、调度器与优化器。', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '训练轮数、批量与梯度。', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '训练中生成预览图。', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '混合精度、缓存与注意力后端。', [...S_SPEED_SDXL]),
  sec('advanced-settings', 'advanced', '其他设置', '噪声、种子与实验功能。', [...S_ADV]),
];

// ---- SD 1.5 LoRA ----
const SD15_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 底模与恢复训练。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD1.5 底模路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
    { key: 'v2', type: 'boolean', label: 'SD 2.x 模型', defaultValue: false },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora', 32, 32, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- FLUX LoRA ----
const FLUX_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 模型路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('flux-params', 'model', 'FLUX 专用参数', '时间步采样、CFG、损失函数等。', [
    ...flowParams({ ts: 'sigmoid', gs: 1.0 }),
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', defaultValue: '', min: 1 },
    { key: 'apply_t5_attn_mask', type: 'boolean', label: '应用 T5 注意力掩码', defaultValue: true },
    { key: 'train_t5xxl', type: 'boolean', label: '训练T5XXL（不推荐）', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_flux', 4, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- SD3 LoRA ----
const SD3_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD3 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd3-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD3 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', defaultValue: '' },
    { key: 'clip_g', type: 'file', pickerType: 'model-file', label: 'CLIP-G 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('sd3-params', 'model', 'SD3 专用参数', '', [
    { key: 'weighting_scheme', type: 'select', label: '权重策略', defaultValue: 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', defaultValue: '', min: 1 },
    { key: 'apply_lg_attn_mask', type: 'boolean', label: '应用 CLIP-L/G 注意力掩码', defaultValue: false },
    { key: 'train_t5xxl', type: 'boolean', label: '训练 T5XXL', defaultValue: false },
    { key: 'clip_l_dropout_rate', type: 'number', label: 'CLIP-L dropout', defaultValue: '', min: 0, max: 1, step: 0.01 },
    { key: 'clip_g_dropout_rate', type: 'number', label: 'CLIP-G dropout', defaultValue: '', min: 0, max: 1, step: 0.01 },
    { key: 't5_dropout_rate', type: 'number', label: 'T5 dropout', defaultValue: '', min: 0, max: 1, step: 0.01 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_sd3', 4, 1, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- Lumina LoRA ----
const LUMINA_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Lumina 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'lumina-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Lumina 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 模型路径', defaultValue: '' },
    { key: 'gemma2', type: 'file', pickerType: 'model-file', label: 'Gemma2 模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('lumina-params', 'model', 'Lumina 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 6.0 }),
    { key: 'gemma2_max_token_length', type: 'number', label: 'Gemma2 最大 token', defaultValue: '', min: 1 },
    { key: 'use_flash_attn', type: 'boolean', label: '启用 Flash Attention', defaultValue: false },
    { key: 'use_sage_attn', type: 'boolean', label: '启用 Sage Attention', defaultValue: false },
    { key: 'system_prompt', type: 'string', label: '系统提示词', defaultValue: '' },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_lumina', 4, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- HunyuanImage LoRA ----
const HUNYUAN_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', '混元图像模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'hunyuan-image-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'HunyuanImage 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'text_encoder', type: 'file', pickerType: 'model-file', label: 'Qwen2.5-VL 文本编码器', defaultValue: '' },
    { key: 'byt5', type: 'file', pickerType: 'model-file', label: 'ByT5 模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('hunyuan-params', 'model', 'HunyuanImage 专用参数', '', [
    ...flowParams({ ts: 'sigma', dfs: 5.0 }),
    { key: 'attn_mode', type: 'select', label: 'Attention 实现', defaultValue: '', options: ['', 'torch', 'xformers', 'flash', 'sageattn'] },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', defaultValue: false },
    { key: 'text_encoder_cpu', type: 'boolean', label: '文本编码器用 CPU', defaultValue: false },
    { key: 'vae_chunk_size', type: 'number', label: 'VAE 解码分块', defaultValue: '', min: 1 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_hunyuan_image', 16, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- Anima LoRA ----
const ANIMA_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Anima 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'anima-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Anima DiT 权重路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'Qwen Image VAE 路径', defaultValue: '' },
    { key: 'qwen3', type: 'file', pickerType: 'model-file', label: 'Qwen3 文本模型路径', defaultValue: '' },
    { key: 'llm_adapter_path', type: 'file', pickerType: 'model-file', label: 'LLM Adapter 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('anima-params', 'model', 'Anima 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 3.0 }),
    { key: 'qwen3_max_token_length', type: 'number', label: 'Qwen3 最大 token', defaultValue: 512, min: 1 },
    { key: 't5_max_token_length', type: 'number', label: 'T5 最大 token', defaultValue: 512, min: 1 },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', defaultValue: false },
    { key: 'vae_chunk_size', type: 'number', label: 'VAE 分块大小', defaultValue: '', min: 2 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('network-settings', 'network', '网络设置', 'LoRA / LoKr 模式。', [
    { key: 'lora_type', type: 'select', label: '适配器类型', defaultValue: 'lora', options: ['lora', 'lokr'] },
    { key: 'network_weights', type: 'file', pickerType: 'model-file', label: '继续训练 LoRA', defaultValue: '' },
    { key: 'network_dim', type: 'slider', label: '网络维度', defaultValue: 16, min: 1, max: 256, step: 1 },
    { key: 'network_alpha', type: 'slider', label: '网络 Alpha', defaultValue: 16, min: 1, max: 256, step: 1 },
    { key: 'dim_from_weights', type: 'boolean', label: '从权重推断 Dim', defaultValue: false },
    { key: 'scale_weight_norms', type: 'number', label: '最大范数正则化', defaultValue: '', min: 0, step: 0.01 },
    { key: 'train_norm', type: 'boolean', label: '训练 Norm 层', defaultValue: false },
    { key: 'lokr_factor', type: 'number', label: 'LoKr 系数', defaultValue: 8, min: -1, visibleWhen: when('lora_type', 'lokr') },
  ]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- SD DreamBooth / SDXL Finetune (共用 schema) ----
const finetuneModel = (typeId, label) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, defaultValue: './sd-models/model.safetensors' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
];
const DB_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD DreamBooth 全参微调。', [
    ...finetuneModel('sd-dreambooth', 'SD1.5'),
    { key: 'v2', type: 'boolean', label: 'SD 2.x 模型', defaultValue: false },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];
const SDXL_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL 全参微调。', [
    ...finetuneModel('sdxl-finetune', 'SDXL'),
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- FLUX Finetune ----
const FLUX_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('flux-params', 'model', 'FLUX 专用参数', '', [
    ...flowParams({ ts: 'sigma', mp: 'sigma_scaled', dfs: 3.0, gs: 3.5 }),
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', defaultValue: '', min: 1 },
    { key: 'apply_t5_attn_mask', type: 'boolean', label: '应用 T5 注意力掩码', defaultValue: false },
    { key: 'blockwise_fused_optimizers', type: 'boolean', label: 'Blockwise fused optimizer', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- SD3 Finetune ----
const SD3_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD3 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd3-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD3 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', defaultValue: '' },
    { key: 'clip_g', type: 'file', pickerType: 'model-file', label: 'CLIP-G 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('sd3-params', 'model', 'SD3 专用参数', '', [
    { key: 'weighting_scheme', type: 'select', label: '权重策略', defaultValue: 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', defaultValue: 256, min: 1 },
    { key: 'training_shift', type: 'number', label: '训练位移', defaultValue: 1.0, step: 0.001 },
    { key: 'train_text_encoder', type: 'boolean', label: '训练 CLIP-L/G', defaultValue: false },
    { key: 'train_t5xxl', type: 'boolean', label: '训练 T5XXL', defaultValue: false },
    { key: 'blockwise_fused_optimizers', type: 'boolean', label: 'Blockwise fused optimizer', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- Lumina Finetune ----
const LUMINA_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Lumina 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'lumina-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Lumina 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', defaultValue: '' },
    { key: 'gemma2', type: 'file', pickerType: 'model-file', label: 'Gemma2 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('lumina-params', 'model', 'Lumina 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 6.0 }),
    { key: 'gemma2_max_token_length', type: 'number', label: 'Gemma2 最大 token', defaultValue: '', min: 1 },
    { key: 'use_flash_attn', type: 'boolean', label: '启用 Flash Attention', defaultValue: false },
    { key: 'use_sage_attn', type: 'boolean', label: '启用 Sage Attention', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- Anima Finetune ----
const ANIMA_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Anima 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'anima-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Anima DiT 路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'Qwen Image VAE 路径', defaultValue: '' },
    { key: 'qwen3', type: 'file', pickerType: 'model-file', label: 'Qwen3 文本模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('anima-params', 'model', 'Anima 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 3.0 }),
    { key: 'qwen3_max_token_length', type: 'number', label: 'Qwen3 最大 token', defaultValue: 512, min: 1 },
    { key: 't5_max_token_length', type: 'number', label: 'T5 最大 token', defaultValue: 512, min: 1 },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- ControlNet (SD / SDXL / FLUX) ----
const cnModel = (typeId, label, extra = []) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, defaultValue: './sd-models/model.safetensors' },
  { key: 'controlnet_model_name_or_path', type: 'file', pickerType: 'model-file', label: '已有 ControlNet 模型路径', desc: '留空从头训练。', defaultValue: '' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
  ...extra,
];
const cnDataset = (reso, bucketMax, bucketStep) => [
  { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练数据集路径', defaultValue: './train/aki' },
  { key: 'conditioning_data_dir', type: 'folder', pickerType: 'folder', label: '条件图数据集路径', defaultValue: '' },
  { key: 'resolution', type: 'string', label: '训练分辨率', defaultValue: reso },
  { key: 'enable_bucket', type: 'boolean', label: '启用分桶', defaultValue: true },
  { key: 'min_bucket_reso', type: 'number', label: '桶最小分辨率', defaultValue: 256 },
  { key: 'max_bucket_reso', type: 'number', label: '桶最大分辨率', defaultValue: bucketMax },
  { key: 'bucket_reso_steps', type: 'number', label: '桶划分单位', defaultValue: bucketStep },
];
const cnTrainFields = [
  { key: 'max_train_epochs', type: 'number', label: '最大训练轮数', defaultValue: 10, min: 1 },
  { key: 'train_batch_size', type: 'slider', label: '批量大小', defaultValue: 1, min: 1, max: 32, step: 1 },
  { key: 'gradient_checkpointing', type: 'boolean', label: '梯度检查点', defaultValue: false },
  { key: 'gradient_accumulation_steps', type: 'number', label: '梯度累加步数', defaultValue: 1, min: 1 },
  { key: 'max_grad_norm', type: 'number', label: '梯度裁剪上限', defaultValue: 1.0, min: 0, step: 0.1 },
];
const cnLR = [
  { key: 'learning_rate', type: 'string', label: '学习率', defaultValue: '1e-4' },
  { key: 'control_net_lr', type: 'string', label: 'ControlNet 学习率', defaultValue: '1e-4' },
  { key: 'lr_scheduler', type: 'select', label: '学习率调度器', defaultValue: 'cosine_with_restarts', options: ['linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup'] },
  { key: 'lr_warmup_steps', type: 'number', label: '预热步数', defaultValue: 0, min: 0 },
  { key: 'optimizer_type', type: 'select', label: '优化器', defaultValue: 'AdamW8bit', options: ['AdamW', 'AdamW8bit', 'PagedAdamW8bit', 'Lion', 'DAdaptation', 'AdaFactor', 'Prodigy'] },
];
const SD_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 ControlNet。', cnModel('sd-controlnet', 'SD1.5', [{ key: 'v2', type: 'boolean', label: 'SD 2.x', defaultValue: false }])),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];
const SDXL_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL ControlNet。', cnModel('sdxl-controlnet', 'SDXL', [{ key: 'v_parameterization', type: 'boolean', label: 'V 参数化', defaultValue: false }])),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];
const FLUX_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX ControlNet。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-controlnet' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', defaultValue: '' },
    { key: 'controlnet_model_name_or_path', type: 'file', pickerType: 'model-file', label: '已有 ControlNet 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ---- Textual Inversion ----
const tiModel = (typeId, label, extra = []) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, defaultValue: './sd-models/model.safetensors' },
  { key: 'weights', type: 'file', pickerType: 'model-file', label: '初始 embedding 权重路径', defaultValue: '' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', defaultValue: '' },
  ...extra,
];
const tiParams = [
  { key: 'token_string', type: 'string', label: 'Token 字符串', desc: 'tokenizer 中不存在的新 token。', defaultValue: '' },
  { key: 'init_word', type: 'string', label: '初始化词', defaultValue: '' },
  { key: 'num_vectors_per_token', type: 'number', label: '每 token 向量数', defaultValue: 1, min: 1 },
  { key: 'use_object_template', type: 'boolean', label: '使用物体模板', defaultValue: false },
  { key: 'use_style_template', type: 'boolean', label: '使用风格模板', defaultValue: false },
];
const SD_TI_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 Textual Inversion。', tiModel('sd-textual-inversion', 'SD1.5', [{ key: 'v2', type: 'boolean', label: 'SD 2.x', defaultValue: false }])),
  sec('ti-params', 'model', 'Textual Inversion 专用', '', [...tiParams]),
  sec('save-settings', 'model', '保存设置', '', S_SAVE.map((f) => f.key === 'save_model_as' ? { ...f, defaultValue: 'pt' } : f.key === 'output_name' ? { ...f, defaultValue: 'embedding' } : f)),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];
const SDXL_TI_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL Textual Inversion。', tiModel('sdxl-textual-inversion', 'SDXL')),
  sec('ti-params', 'model', 'Textual Inversion 专用', '', [...tiParams]),
  sec('save-settings', 'model', '保存设置', '', S_SAVE.map((f) => f.key === 'save_model_as' ? { ...f, defaultValue: 'pt' } : f.key === 'output_name' ? { ...f, defaultValue: 'embedding' } : f)),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
];

// ================================================================
// SECTIONS_MAP
// ================================================================
const SECTIONS_MAP = {
  'sdxl-lora':              SDXL_LORA_SECTIONS,
  'sd-lora':                SD15_LORA_SECTIONS,
  'flux-lora':              FLUX_LORA_SECTIONS,
  'sd3-lora':               SD3_LORA_SECTIONS,
  'lumina-lora':            LUMINA_LORA_SECTIONS,
  'hunyuan-image-lora':     HUNYUAN_LORA_SECTIONS,
  'anima-lora':             ANIMA_LORA_SECTIONS,
  'sd-dreambooth':          DB_SECTIONS,
  'sdxl-finetune':          SDXL_FT_SECTIONS,
  'flux-finetune':          FLUX_FT_SECTIONS,
  'sd3-finetune':           SD3_FT_SECTIONS,
  'lumina-finetune':        LUMINA_FT_SECTIONS,
  'anima-finetune':         ANIMA_FT_SECTIONS,
  'sd-controlnet':          SD_CN_SECTIONS,
  'sdxl-controlnet':        SDXL_CN_SECTIONS,
  'flux-controlnet':        FLUX_CN_SECTIONS,
  'sd-textual-inversion':   SD_TI_SECTIONS,
  'sdxl-textual-inversion': SDXL_TI_SECTIONS,
};

// 兼容旧名
export const SDXL_SECTIONS = SDXL_LORA_SECTIONS;

// ================================================================
// 公共 API
// ================================================================
export function getSectionsForType(typeId) {
  return SECTIONS_MAP[typeId] || SDXL_LORA_SECTIONS;
}

function buildFieldMap(sections) {
  const map = new Map();
  for (const s of sections) for (const f of s.fields) map.set(f.key, f);
  return map;
}

const _fmCache = {};
function getFieldMapForType(typeId) {
  if (!_fmCache[typeId]) _fmCache[typeId] = buildFieldMap(getSectionsForType(typeId));
  return _fmCache[typeId];
}

export function getFieldDefinition(key, typeId) {
  if (typeId) return getFieldMapForType(typeId).get(key);
  for (const sections of Object.values(SECTIONS_MAP)) {
    const map = buildFieldMap(sections);
    if (map.has(key)) return map.get(key);
  }
  return undefined;
}

export function getSectionsForTab(tabKey, typeId) {
  return getSectionsForType(typeId || 'sdxl-lora').filter((s) => s.tab === tabKey);
}

export function getAvailableTabs(typeId) {
  const sections = getSectionsForType(typeId || 'sdxl-lora');
  const tabSet = new Set();
  for (const s of sections) tabSet.add(s.tab);
  return UI_TABS.filter((t) => tabSet.has(t.key));
}

export function isFieldVisible(field, config) {
  if (!field?.visibleWhen) return true;
  return field.visibleWhen(config);
}

export function createDefaultConfig(typeId) {
  const config = {};
  for (const s of getSectionsForType(typeId || 'sdxl-lora'))
    for (const f of s.fields)
      config[f.key] = Array.isArray(f.defaultValue) ? [...f.defaultValue] : (f.defaultValue ?? '');
  return config;
}

export function normalizeDraftValue(field, rawValue) {
  if (!field) return rawValue;
  if (field.type === 'boolean') return Boolean(rawValue);
  if (field.type === 'number' || field.type === 'slider') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return '';
    const p = Number(rawValue);
    return Number.isNaN(p) ? '' : p;
  }
  return rawValue;
}

export function buildRunConfig(config, typeId) {
  const tid = typeId || config.model_train_type || 'sdxl-lora';
  const payload = {};
  for (const s of getSectionsForType(tid)) {
    for (const f of s.fields) {
      if (f.type !== 'hidden' && !isFieldVisible(f, config)) continue;
      const v = config[f.key];
      if (f.type === 'boolean') { payload[f.key] = Boolean(v); continue; }
      if (f.type === 'number' || f.type === 'slider') {
        if (v === '' || v == null) continue;
        const p = Number(v); if (!Number.isNaN(p)) payload[f.key] = p; continue;
      }
      if (v === '' || v == null) continue;
      payload[f.key] = v;
    }
  }
  payload.model_train_type = tid;
  return payload;
}
