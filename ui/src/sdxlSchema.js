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

function when(key, expected) {
  return (config) => config[key] === expected;
}

function all(...conditions) {
  return (config) => conditions.every((condition) => condition(config));
}

export const SDXL_SECTIONS = [
  {
    id: 'model-settings',
    tab: 'model',
    title: '训练用模型',
    description: '底模、VAE 与恢复训练相关设置。',
    fields: [
      { key: 'model_train_type', type: 'hidden', defaultValue: 'sdxl-lora' },
      { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: '底模路径', desc: 'SDXL 底模文件路径。', defaultValue: './sd-models/model.safetensors' },
      { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从 save_state 状态继续训练（保存在 output 文件夹）。', defaultValue: '' },
      { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: '(可选) 外置 VAE 文件路径。', defaultValue: '' },
      { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: '训练 v-pred 模型时需要开启。', defaultValue: false },
      { key: 'zero_terminal_snr', type: 'boolean', label: '零终端 SNR', desc: 'v-pred 模型推荐开启。', defaultValue: true, visibleWhen: when('v_parameterization', true) },
      { key: 'scale_v_pred_loss_like_noise_pred', type: 'boolean', label: '缩放 v-pred 损失', desc: 'v-pred 模型推荐开启。', defaultValue: true, visibleWhen: when('v_parameterization', true) },
    ],
  },
  {
    id: 'save-settings',
    tab: 'model',
    title: '保存设置',
    description: '输出路径、格式与训练状态快照。',
    fields: [
      { key: 'output_name', type: 'string', label: '模型保存名称', desc: '输出模型文件名。', defaultValue: 'aki' },
      { key: 'output_dir', type: 'folder', pickerType: 'folder', label: '模型保存文件夹', desc: '输出目录。', defaultValue: './output' },
      { key: 'save_model_as', type: 'select', label: '保存格式', desc: '模型保存格式。', defaultValue: 'safetensors', options: ['safetensors', 'pt', 'ckpt'] },
      { key: 'save_precision', type: 'select', label: '保存精度', desc: '模型保存时使用的精度。', defaultValue: 'fp16', options: ['fp16', 'float', 'bf16'] },
      { key: 'save_every_n_epochs', type: 'number', label: '每 N 轮保存', desc: '每 N 个 epoch 自动保存一次模型。', defaultValue: 2, min: 1 },
      { key: 'save_every_n_steps', type: 'number', label: '每 N 步保存', desc: '每 N 步自动保存一次模型。', defaultValue: '', min: 1 },
      { key: 'save_state', type: 'boolean', label: '保存训练状态', desc: '可用于 resume 继续训练。', defaultValue: false },
      { key: 'save_state_on_train_end', type: 'boolean', label: '结束时额外保存状态', desc: '训练结束时额外保存一次。保存在 output 文件夹。', defaultValue: false },
      { key: 'save_last_n_epochs_state', type: 'number', label: '保留最近 N 个 epoch 状态', desc: '仅保存最近状态。', defaultValue: '', min: 1, visibleWhen: when('save_state', true) },
    ],
  },
  {
    id: 'network-settings',
    tab: 'network',
    title: '网络设置',
    description: 'LoRA / LyCORIS / DyLoRA 相关参数。',
    fields: [
      { key: 'network_module', type: 'select', label: '训练网络模块', desc: '选择当前训练网络。', defaultValue: 'networks.lora', options: ['networks.lora', 'networks.dylora', 'networks.oft', 'lycoris.kohya'] },
      { key: 'network_weights', type: 'file', pickerType: 'model-file', label: '继续训练 LoRA', desc: '从已有 LoRA 权重继续训练。', defaultValue: '' },
      { key: 'network_dim', type: 'slider', label: '网络维度', desc: '常用 4~128。', defaultValue: 32, min: 1, max: 512, step: 1 },
      { key: 'network_alpha', type: 'slider', label: '网络 Alpha', desc: '常用值等于 dim 或其一半。', defaultValue: 32, min: 1, max: 512, step: 1 },
      { key: 'network_dropout', type: 'number', label: '网络 Dropout', desc: 'LoRA dropout 概率。', defaultValue: 0, min: 0, step: 0.01 },
      { key: 'dim_from_weights', type: 'boolean', label: '从权重推断 Dim', desc: '自动推断 rank / dim。', defaultValue: false },
      { key: 'scale_weight_norms', type: 'number', label: '最大范数正则化', desc: '使用时推荐为 1。', defaultValue: '', min: 0, step: 0.01 },
      { key: 'dora_wd', type: 'boolean', label: '启用 DoRA', desc: '启用 DoRA 训练。', defaultValue: false },
      { key: 'lycoris_algo', type: 'select', label: 'LyCORIS 算法', desc: 'LyCORIS 网络算法。', defaultValue: 'locon', options: ['locon', 'loha', 'lokr', 'ia3', 'dylora', 'glora', 'diag-oft', 'boft'], visibleWhen: when('network_module', 'lycoris.kohya') },
      { key: 'conv_dim', type: 'number', label: '卷积维度', desc: 'LyCORIS 卷积分支 rank。', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
      { key: 'conv_alpha', type: 'number', label: '卷积 Alpha', desc: 'LyCORIS 卷积分支 alpha。', defaultValue: 1, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
      { key: 'dropout', type: 'number', label: 'LyCORIS 丢弃率', desc: '推荐 0~0.5。', defaultValue: 0, min: 0, step: 0.01, visibleWhen: when('network_module', 'lycoris.kohya') },
      { key: 'lokr_factor', type: 'number', label: 'LoKr 系数', desc: '填写 -1 表示无穷。', defaultValue: -1, min: -1, visibleWhen: all(when('network_module', 'lycoris.kohya'), when('lycoris_algo', 'lokr')) },
      { key: 'dylora_unit', type: 'number', label: 'DyLoRA 分块', desc: '常用 4、8、12、16。', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'networks.dylora') },
      { key: 'enable_block_weights', type: 'boolean', label: '启用分层学习率', desc: '只支持 networks.lora。', defaultValue: false },
      { key: 'enable_base_weight', type: 'boolean', label: '启用基础权重', desc: '差异炼丹相关。', defaultValue: false },
    ],
  },
  {
    id: 'dataset-settings',
    tab: 'dataset',
    title: '数据集设置',
    description: '训练数据、正则图与分桶策略。',
    fields: [
      { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练数据集路径', desc: '包含图片和标注文件的数据集目录。', defaultValue: './train/aki' },
      { key: 'reg_data_dir', type: 'folder', pickerType: 'folder', label: '正则化数据集路径', desc: '默认留空，不使用正则化图像。', defaultValue: '' },
      { key: 'prior_loss_weight', type: 'number', label: '先验损失权重', desc: '正则化图像损失权重。', defaultValue: 1, min: 0, step: 0.1 },
      { key: 'resolution', type: 'string', label: '训练分辨率', desc: '格式为 宽,高，必须是 64 的倍数。', defaultValue: '1024,1024' },
      { key: 'enable_bucket', type: 'boolean', label: '启用分桶', desc: '允许不同宽高比图片参与训练。', defaultValue: true },
      { key: 'min_bucket_reso', type: 'number', label: '桶最小分辨率', desc: 'arb 桶最小分辨率。', defaultValue: 256 },
      { key: 'max_bucket_reso', type: 'number', label: '桶最大分辨率', desc: 'arb 桶最大分辨率。', defaultValue: 2048 },
      { key: 'bucket_reso_steps', type: 'number', label: '桶划分单位', desc: 'SDXL 推荐 32。', defaultValue: 32 },
      { key: 'bucket_no_upscale', type: 'boolean', label: '桶不放大图片', desc: '保持原图比例。', defaultValue: true },
    ],
  },
  {
    id: 'caption-settings',
    tab: 'dataset',
    title: 'Caption（Tag）选项',
    description: '训练时如何读取、打乱与丢弃标签。',
    fields: [
      { key: 'caption_extension', type: 'string', label: 'Tag 文件扩展名', desc: '默认是 .txt。', defaultValue: '.txt' },
      { key: 'shuffle_caption', type: 'boolean', label: '随机打乱标签', desc: '训练时随机打乱 tokens。', defaultValue: false },
      { key: 'weighted_captions', type: 'boolean', label: '使用带权重 token', desc: '不推荐与 shuffle_caption 一起开启。', defaultValue: false },
      { key: 'keep_tokens', type: 'number', label: '保留前 N 个 token', desc: '随机打乱时保留前 N 个不变。', defaultValue: 0, min: 0, max: 255 },
      { key: 'max_token_length', type: 'number', label: '最大 token 长度', desc: '默认 255。', defaultValue: 255, min: 1 },
      { key: 'caption_dropout_rate', type: 'number', label: '全部标签丢弃概率', desc: '对某张图不使用 caption 的概率。', defaultValue: '', min: 0, step: 0.01 },
    ],
  },
  {
    id: 'optimizer-settings',
    tab: 'optimizer',
    title: '学习率与优化器设置',
    description: '学习率、调度器与优化器类型。',
    fields: [
      { key: 'learning_rate', type: 'string', label: '总学习率', desc: '分开设置 U-Net 与文本编码器学习率后会失效。', defaultValue: '1e-4' },
      { key: 'unet_lr', type: 'string', label: 'U-Net 学习率', desc: '主网络学习率。', defaultValue: '1e-4' },
      { key: 'text_encoder_lr', type: 'string', label: '文本编码器学习率', desc: '文本编码器学习率。', defaultValue: '1e-5' },
      { key: 'lr_scheduler', type: 'select', label: '学习率调度器', desc: '调度器设置。', defaultValue: 'cosine_with_restarts', options: ['linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup'] },
      { key: 'lr_warmup_steps', type: 'number', label: '预热步数', desc: '学习率预热步数。', defaultValue: 0, min: 0 },
      { key: 'lr_scheduler_num_cycles', type: 'number', label: '重启次数', desc: '仅 cosine_with_restarts 时使用。', defaultValue: 1, min: 1, visibleWhen: when('lr_scheduler', 'cosine_with_restarts') },
      { key: 'optimizer_type', type: 'select', label: '优化器', desc: '当前构建支持的优化器列表。', defaultValue: 'AdamW8bit', options: ['AdamW', 'AdamW8bit', 'PagedAdamW8bit', 'Lion', 'Lion8bit', 'DAdaptation', 'DAdaptAdam', 'DAdaptLion', 'AdaFactor', 'Prodigy', 'pytorch_optimizer.CAME'] },
      { key: 'min_snr_gamma', type: 'number', label: 'Min-SNR Gamma', desc: '如果启用推荐为 5。', defaultValue: '', min: 0, step: 0.1 },
      { key: 'prodigy_d0', type: 'string', label: 'Prodigy d0', desc: 'Prodigy 优化器高级参数。', defaultValue: '', visibleWhen: when('optimizer_type', 'Prodigy') },
      { key: 'prodigy_d_coef', type: 'string', label: 'Prodigy d_coef', desc: 'Prodigy 优化器高级参数。', defaultValue: '2.0', visibleWhen: when('optimizer_type', 'Prodigy') },
    ],
  },
  {
    id: 'training-settings',
    tab: 'training',
    title: '训练相关参数',
    description: '基础训练轮数、批量与反向传播设置。',
    fields: [
      { key: 'max_train_epochs', type: 'number', label: '最大训练轮数', desc: '最大训练 epoch 数。', defaultValue: 10, min: 1 },
      { key: 'train_batch_size', type: 'slider', label: '批量大小', desc: '越高显存占用越高。', defaultValue: 1, min: 1, max: 32, step: 1 },
      { key: 'gradient_checkpointing', type: 'boolean', label: '梯度检查点', desc: '降低显存占用。', defaultValue: true },
      { key: 'gradient_accumulation_steps', type: 'number', label: '梯度累加步数', desc: '模拟更大 batch。', defaultValue: 1, min: 1 },
      { key: 'network_train_unet_only', type: 'boolean', label: '仅训练 U-Net', desc: '基础 SDXL LoRA 推荐开启。', defaultValue: true },
      { key: 'network_train_text_encoder_only', type: 'boolean', label: '仅训练文本编码器', desc: '只训练文本编码器。', defaultValue: false },
    ],
  },
  {
    id: 'preview-settings',
    tab: 'preview',
    title: '训练预览图设置',
    description: '训练中生成预览图的配置。',
    fields: [
      { key: 'enable_preview', type: 'boolean', label: '启用预览图', desc: '训练期间自动生成预览图。', defaultValue: false },
      { key: 'randomly_choice_prompt', type: 'boolean', label: '随机选择提示词', desc: '从数据集标注里随机抽取提示词。', defaultValue: false, visibleWhen: when('enable_preview', true) },
      { key: 'prompt_file', type: 'file', pickerType: 'text-file', label: '提示词文件路径', desc: '填写后优先使用文件中的提示词。', defaultValue: '', visibleWhen: when('enable_preview', true) },
      { key: 'positive_prompts', type: 'textarea', label: '正向提示词', desc: '正向提示词。', defaultValue: 'masterpiece, best quality, 1girl, solo', visibleWhen: when('enable_preview', true) },
      { key: 'negative_prompts', type: 'textarea', label: '反向提示词', desc: '反向提示词。', defaultValue: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts,signature, watermark, username, blurry', visibleWhen: when('enable_preview', true) },
      { key: 'sample_width', type: 'number', label: '预览图宽度', desc: '预览图宽度。', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
      { key: 'sample_height', type: 'number', label: '预览图高度', desc: '预览图高度。', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
      { key: 'sample_cfg', type: 'number', label: 'CFG 系数', desc: '预览图 CFG。', defaultValue: 7, min: 1, max: 30, visibleWhen: when('enable_preview', true) },
      { key: 'sample_steps', type: 'number', label: '采样步数', desc: '预览图迭代步数。', defaultValue: 24, min: 1, max: 300, visibleWhen: when('enable_preview', true) },
      { key: 'sample_sampler', type: 'select', label: '采样器', desc: '生成预览图所用采样器。', defaultValue: 'euler_a', options: ['ddim', 'pndm', 'lms', 'euler', 'euler_a', 'heun', 'dpm_2', 'dpm_2_a', 'dpmsolver', 'dpmsolver++'], visibleWhen: when('enable_preview', true) },
      { key: 'validation_split', type: 'number', label: '验证集划分比例', desc: '会从训练集中自动切出一部分做验证。', defaultValue: 0, min: 0, max: 1, step: 0.01 },
      { key: 'log_with', type: 'select', label: '日志模块', desc: '选择 tensorboard 或 wandb。', defaultValue: 'tensorboard', options: ['tensorboard', 'wandb'] },
      { key: 'logging_dir', type: 'folder', pickerType: 'folder', label: '日志保存文件夹', desc: '日志输出目录。', defaultValue: './logs' },
    ],
  },
  {
    id: 'speed-settings',
    tab: 'speed',
    title: '速度优化选项',
    description: '混合精度、缓存与注意力后端。',
    fields: [
      { key: 'mixed_precision', type: 'select', label: '混合精度', desc: 'RTX30 及以后也可以指定 bf16。', defaultValue: 'bf16', options: ['no', 'fp16', 'bf16'] },
      { key: 'xformers', type: 'boolean', label: '启用 xformers', desc: '启用 xformers 加速。', defaultValue: true },
      { key: 'sageattn', type: 'boolean', label: '启用 SageAttention', desc: '实验性功能，需要 SageAttention 环境。', defaultValue: false },
      { key: 'sdpa', type: 'boolean', label: '启用 SDPA', desc: '启用 SDPA 注意力。', defaultValue: true },
      { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', desc: '更兼容，但通常更慢。', defaultValue: false },
      { key: 'lowram', type: 'boolean', label: '低内存模式', desc: '直接把主要模块加载到显存。', defaultValue: false },
      { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', desc: '缓存图像 latent。', defaultValue: true },
      { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', desc: '把 latent 写入磁盘。', defaultValue: true },
      { key: 'cache_text_encoder_outputs', type: 'boolean', label: '缓存文本编码器输出', desc: '需要关闭 shuffle_caption。', defaultValue: true },
      { key: 'cache_text_encoder_outputs_to_disk', type: 'boolean', label: '缓存文本编码器输出到磁盘', desc: '把文本编码器输出写入磁盘。', defaultValue: false },
    ],
  },
  {
    id: 'advanced-settings',
    tab: 'advanced',
    title: '其他设置',
    description: '噪声、随机种子与实验功能。',
    fields: [
      { key: 'noise_offset', type: 'number', label: '噪声偏移', desc: '改善非常暗或非常亮图像的生成。', defaultValue: '', step: 0.01 },
      { key: 'seed', type: 'number', label: '随机种子', desc: '默认 1337。', defaultValue: 1337 },
      { key: 'clip_skip', type: 'slider', label: 'CLIP 跳层', desc: '当前构建中 SDXL clip_skip 仍属实验。', defaultValue: 2, min: 0, max: 12, step: 1 },
      { key: 'masked_loss', type: 'boolean', label: '启用蒙版损失', desc: '训练带透明蒙版 / alpha 图像时可用。', defaultValue: false },
      { key: 'alpha_mask', type: 'boolean', label: '读取 Alpha 通道作为 Mask', desc: '透明背景 / 抠图训练时通常要一起开启。', defaultValue: false },
      { key: 'training_comment', type: 'textarea', label: '训练备注', desc: '写入模型元数据的备注。', defaultValue: '' },
      { key: 'ui_custom_params', type: 'textarea', label: '自定义 TOML 覆盖', desc: '危险：会直接覆盖界面中的参数。', defaultValue: '' },
      { key: 'ddp_timeout', type: 'number', label: 'DDP 超时时间', desc: '分布式训练超时时间。', defaultValue: '', min: 0 },
    ],
  },
];

const FIELD_MAP = new Map();
for (const section of SDXL_SECTIONS) {
  for (const field of section.fields) {
    FIELD_MAP.set(field.key, field);
  }
}

export function getFieldDefinition(key) {
  return FIELD_MAP.get(key);
}

export function getSectionsForTab(tabKey) {
  return SDXL_SECTIONS.filter((section) => section.tab === tabKey);
}

export function isFieldVisible(field, config) {
  if (!field?.visibleWhen) {
    return true;
  }
  return field.visibleWhen(config);
}

export function createDefaultConfig() {
  const config = {};
  for (const section of SDXL_SECTIONS) {
    for (const field of section.fields) {
      if (Array.isArray(field.defaultValue)) {
        config[field.key] = [...field.defaultValue];
      } else {
        config[field.key] = field.defaultValue ?? '';
      }
    }
  }
  return config;
}

export function normalizeDraftValue(field, rawValue) {
  if (!field) {
    return rawValue;
  }

  if (field.type === 'boolean') {
    return Boolean(rawValue);
  }

  if (field.type === 'number' || field.type === 'slider') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return '';
    }
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? '' : parsed;
  }

  return rawValue;
}

export function buildRunConfig(config) {
  const payload = {};

  for (const section of SDXL_SECTIONS) {
    for (const field of section.fields) {
      if (field.type !== 'hidden' && !isFieldVisible(field, config)) {
        continue;
      }

      const value = config[field.key];

      if (field.type === 'boolean') {
        payload[field.key] = Boolean(value);
        continue;
      }

      if (field.type === 'number' || field.type === 'slider') {
        if (value === '' || value === null || value === undefined) {
          continue;
        }
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          payload[field.key] = parsed;
        }
        continue;
      }

      if (value === '' || value === null || value === undefined) {
        continue;
      }

      payload[field.key] = value;
    }
  }

  payload.model_train_type = 'sdxl-lora';
  return payload;
}
