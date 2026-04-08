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
  // 其他模型训练
  { id: 'yolo',                group: '其他模型训练',      label: 'YOLO 模型训练' },
  { id: 'aesthetic-scorer',    group: '其他模型训练',      label: '美学评分模型训练' },
];

// ================================================================
// 共享字段片段
// ================================================================
const S_SAVE = [
  { key: 'output_name', type: 'string', label: '模型保存名称', desc: '模型保存名称', defaultValue: 'aki' },
  { key: 'output_dir', type: 'folder', pickerType: 'folder', label: '模型保存文件夹', desc: '模型保存文件夹', defaultValue: './output' },
  { key: 'save_model_as', type: 'select', label: '保存格式', desc: '模型保存格式', defaultValue: 'safetensors', options: ['safetensors', 'pt', 'ckpt'] },
  { key: 'save_precision', type: 'select', label: '保存精度', desc: '模型保存精度', defaultValue: 'fp16', options: ['fp16', 'float', 'bf16'] },
  { key: 'save_every_n_epochs', type: 'number', label: '每 N 轮保存', desc: '每 N epoch（轮）自动保存一次模型', defaultValue: 2, min: 1 },
  { key: 'save_every_n_steps', type: 'number', label: '每 N 步保存', desc: '每 N 步自动保存一次模型', defaultValue: '', min: 1 },
  { key: 'save_state', type: 'boolean', label: '保存训练状态', desc: '保存训练状态 配合 resume 参数可以继续从某个状态训练', defaultValue: false },
  { key: 'save_state_on_train_end', type: 'boolean', label: '结束时额外保存状态', desc: '训练结束时额外保存一次训练状态', defaultValue: false },
  { key: 'save_last_n_epochs_state', type: 'number', label: '保留最近 N 个 epoch 状态', desc: '仅保存最后 n epoch 的训练状态', defaultValue: '', min: 1, visibleWhen: when('save_state', true) },
  { key: 'save_last_n_steps_state', type: 'number', label: '保留最近 N 步状态', desc: '仅保留最近 N 步范围内的训练状态', defaultValue: '', min: 1, visibleWhen: when('save_state', true) },
  { key: 'save_n_epoch_ratio', type: 'number', label: '按比例保存', desc: '按 epoch 比例保存，保证整个训练阶段至少保存 N 份模型', defaultValue: '', min: 1 },
  { key: 'save_last_n_epochs', type: 'number', label: '仅保留最近 N 轮模型', desc: '仅保留最近 N 个按 epoch 保存的模型', defaultValue: '', min: 1 },
  { key: 'save_last_n_steps', type: 'number', label: '仅保留最近 N 步模型', desc: '仅保留最近 N 步范围内的按 step 保存模型', defaultValue: '', min: 1 },
  { key: 'log_with', type: 'select', label: '日志模块', desc: '日志模块', defaultValue: 'tensorboard', options: ['tensorboard', 'wandb'] },
  { key: 'logging_dir', type: 'folder', pickerType: 'folder', label: '日志保存文件夹', desc: '日志保存文件夹', defaultValue: './logs' },
  { key: 'log_prefix', type: 'string', label: '日志前缀', desc: '日志前缀', defaultValue: '' },
  { key: 'log_tracker_name', type: 'string', label: '追踪器名称', desc: '日志追踪器名称', defaultValue: '' },
 { key: 'wandb_run_name', type: 'string', label: 'WandB 运行名称', desc: 'wandb 单次运行显示名称', defaultValue: '', visibleWhen: when('log_with', 'wandb') },
  { key: 'wandb_api_key', type: 'string', label: 'WandB API Key', desc: 'wandb 的 api 密钥', defaultValue: '', visibleWhen: when('log_with', 'wandb') },
  { key: 'log_tracker_config', type: 'file', pickerType: 'model-file', label: '追踪器配置文件', desc: '日志追踪器配置文件路径', defaultValue: '' },
];
const S_CAPTION = [
  { key: 'caption_extension', type: 'string', label: 'Tag 文件扩展名', desc: 'Tag 文件扩展名', defaultValue: '.txt' },
  { key: 'shuffle_caption', type: 'boolean', label: '随机打乱标签', desc: '训练时随机打乱 tokens', defaultValue: false },
  { key: 'weighted_captions', type: 'boolean', label: '使用带权重 token', desc: '使用带权重的 token，不推荐与 shuffle_caption 一同开启', defaultValue: false },
  { key: 'keep_tokens', type: 'number', label: '保留前 N 个 token', desc: '在随机打乱 tokens 时，保留前 N 个不变', defaultValue: 0, min: 0, max: 255 },
  { key: 'max_token_length', type: 'number', label: '最大 token 长度', desc: '最大 token 长度', defaultValue: 255, min: 1 },
  { key: 'caption_dropout_rate', type: 'number', label: '全部标签丢弃概率', desc: '丢弃全部标签的概率，对一个图片概率不使用 caption 或 class token', defaultValue: '', min: 0, step: 0.01 },
  { key: 'keep_tokens_separator', type: 'string', label: '保留 token 分隔符', desc: '保留 tokens 时使用的分隔符', defaultValue: '' },
  { key: 'caption_dropout_every_n_epochs', type: 'number', label: '每 N 轮丢弃标签', desc: '每 N 个 epoch 丢弃全部标签', defaultValue: '', min: 0, max: 100, step: 1 },
  { key: 'caption_tag_dropout_rate', type: 'number', label: '按标签丢弃概率', desc: '按逗号分隔的标签来随机丢弃 tag 的概率', defaultValue: '', min: 0, step: 0.01 },
];
const S_LR = [
  { key: 'learning_rate', type: 'string', label: '总学习率', desc: '总学习率, 在分开设置 U-Net 与文本编码器学习率后这个值失效。', defaultValue: '1e-4' },
  { key: 'unet_lr', type: 'string', label: 'U-Net 学习率', desc: 'U-Net 学习率', defaultValue: '1e-4' },
  { key: 'text_encoder_lr', type: 'string', label: '文本编码器学习率', desc: '文本编码器学习率', defaultValue: '1e-5' },
  { key: 'lr_scheduler', type: 'select', label: '学习率调度器', desc: '学习率调度器设置', defaultValue: 'cosine_with_restarts', options: ['linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup'] },
  { key: 'lr_warmup_steps', type: 'number', label: '预热步数', desc: '学习率预热步数', defaultValue: 0, min: 0 },
  { key: 'lr_scheduler_num_cycles', type: 'number', label: '重启次数', desc: '重启次数', defaultValue: 1, min: 1, visibleWhen: when('lr_scheduler', 'cosine_with_restarts') },
  { key: 'optimizer_type', type: 'select', label: '优化器', desc: '优化器设置', defaultValue: 'AdamW8bit', options: ['AdamW', 'AdamW8bit', 'PagedAdamW8bit', 'RAdamScheduleFree', 'Lion', 'Lion8bit', 'PagedLion8bit', 'SGDNesterov', 'SGDNesterov8bit', 'DAdaptation', 'DAdaptAdam', 'DAdaptAdaGrad', 'DAdaptAdanIP', 'DAdaptLion', 'DAdaptSGD', 'AdaFactor', 'Prodigy', 'prodigyplus.ProdigyPlusScheduleFree', 'pytorch_optimizer.CAME', 'bitsandbytes.optim.AdEMAMix8bit', 'bitsandbytes.optim.PagedAdEMAMix8bit'] },
  { key: 'min_snr_gamma', type: 'number', label: 'Min-SNR Gamma', desc: '最小信噪比伽马值, 如果启用推荐为 5', defaultValue: '', min: 0, step: 0.1 },
  { key: 'prodigy_d0', type: 'string', label: 'Prodigy d0', desc: 'Prodigy 初始步长估计。留空使用默认值', defaultValue: '', visibleWhen: when('optimizer_type', 'Prodigy') },
  { key: 'prodigy_d_coef', type: 'string', label: 'Prodigy d_coef', desc: 'Prodigy d 系数，影响自适应学习率大小', defaultValue: '2.0', visibleWhen: when('optimizer_type', 'Prodigy') },
  { key: 'lr_scheduler_type', type: 'string', label: '自定义调度器类', desc: '自定义学习率调度器类路径。填写后优先于上方调度器，如 torch.optim.lr_scheduler.CosineAnnealingLR', defaultValue: '' },
  { key: 'lr_scheduler_args', type: 'textarea', label: '自定义调度器参数', desc: '自定义学习率调度器参数，一行一个 key=value', defaultValue: '' },
  { key: 'optimizer_args_custom', type: 'textarea', label: '自定义 optimizer_args', desc: '自定义优化器参数，每行一个 key=value（如 decouple=True）。Prodigy 默认已自动填充标准参数', defaultValue: '' },
];
const S_TRAIN = (epochs = 10) => [
  { key: 'max_train_epochs', type: 'number', label: '最大训练轮数', desc: '最大训练 epoch（轮数）', defaultValue: epochs, min: 1 },
  { key: 'train_batch_size', type: 'slider', label: '批量大小', desc: '批量大小。数值越高显存占用越高。', defaultValue: 1, min: 1, max: 32, step: 1 },
  { key: 'gradient_checkpointing', type: 'boolean', label: '梯度检查点', desc: '梯度检查点', defaultValue: true },
  { key: 'gradient_accumulation_steps', type: 'number', label: '梯度累加步数', desc: '梯度累加步数', defaultValue: 1, min: 1 },
  { key: 'network_train_unet_only', type: 'boolean', label: '仅训练 U-Net / DiT', desc: '仅训练 U-Net / DiT', defaultValue: true },
  { key: 'network_train_text_encoder_only', type: 'boolean', label: '仅训练文本编码器', desc: '仅训练文本编码器', defaultValue: false },
];
const S_PREVIEW = [
  { key: 'enable_preview', type: 'boolean', label: '启用预览图', desc: '启用训练预览图', defaultValue: false },
  { key: 'sample_every_n_epochs', type: 'number', label: '每 N 轮生成预览', desc: '每训练 N 个 epoch 生成一次预览图。留空则仅在 epoch 结束时按默认频率生成', defaultValue: '', min: 1, visibleWhen: when('enable_preview', true) },
  { key: 'sample_every_n_steps', type: 'number', label: '每 N 步生成预览', desc: '每训练 N 步生成一次预览图（优先于按 epoch）。留空不启用', defaultValue: '', min: 1, visibleWhen: when('enable_preview', true) },
  { key: 'sample_at_first', type: 'boolean', label: '训练前先生成预览', desc: '训练开始前先生成一张预览图，可用于确认提示词效果', defaultValue: false, visibleWhen: when('enable_preview', true) },
  { key: 'randomly_choice_prompt', type: 'boolean', label: '随机选择提示词', desc: '随机选择预览图 Prompt', defaultValue: false, visibleWhen: when('enable_preview', true) },
  { key: 'prompt_file', type: 'file', pickerType: 'text-file', label: '提示词文件路径', desc: '预览图 Prompt 文件路径。填写后将采用文件内的 prompt。', defaultValue: '', visibleWhen: when('enable_preview', true) },
  { key: 'positive_prompts', type: 'textarea', label: '正向提示词', desc: '正向提示词', defaultValue: 'masterpiece, best quality, 1girl, solo', visibleWhen: when('enable_preview', true) },
  { key: 'negative_prompts', type: 'textarea', label: '反向提示词', desc: '反向提示词', defaultValue: 'lowres, bad anatomy, bad hands, text, error', visibleWhen: when('enable_preview', true) },
  { key: 'sample_width', type: 'number', label: '预览图宽度', desc: '预览图宽', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
  { key: 'sample_height', type: 'number', label: '预览图高度', desc: '预览图高', defaultValue: 512, min: 64, visibleWhen: when('enable_preview', true) },
  { key: 'sample_cfg', type: 'number', label: 'CFG 系数', desc: 'CFG Scale', defaultValue: 7, min: 1, max: 30, visibleWhen: when('enable_preview', true) },
  { key: 'sample_steps', type: 'number', label: '采样步数', desc: '迭代步数', defaultValue: 24, min: 1, max: 300, visibleWhen: when('enable_preview', true) },
  { key: 'sample_seed', type: 'number', label: '预览图种子', desc: '预览图随机种子。0 或留空表示每次随机', defaultValue: '', min: 0, visibleWhen: when('enable_preview', true) },
  { key: 'sample_sampler', type: 'select', label: '采样器', desc: '生成预览图所用采样器', defaultValue: 'euler_a', options: ['ddim', 'pndm', 'lms', 'euler', 'euler_a', 'heun', 'dpm_2', 'dpm_2_a', 'dpmsolver', 'dpmsolver++'], visibleWhen: when('enable_preview', true) },
  { key: 'random_prompt_include_subdirs', type: 'boolean', label: '从子目录随机选择', desc: '从 train_data_dir 下所有子目录随机选择 Prompt', defaultValue: false, visibleWhen: all(when('enable_preview', true), when('randomly_choice_prompt', true)) },
];
const S_SPEED_SDXL = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', desc: '训练混合精度, RTX30系列以后也可以指定 bf16', defaultValue: 'bf16', options: ['no', 'fp16', 'bf16'] },
  { key: 'xformers', type: 'boolean', label: '启用 xformers', desc: '启用 xformers', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', desc: '启用 sdpa', defaultValue: true },
  { key: 'sageattn', type: 'boolean', label: '启用 SageAttention', desc: '启用 SageAttention（实验性）', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', desc: '启用省显存 attention（比 xformers 更兼容，但通常更慢）', defaultValue: false },
  { key: 'lowram', type: 'boolean', label: '低内存模式', desc: '低内存模式 该模式下会将 U-net、文本编码器、VAE 直接加载到显存中', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', desc: '缓存图像 latent, 缓存 VAE 输出以减少 VRAM 使用', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', desc: '缓存图像 latent 到磁盘', defaultValue: true },
  { key: 'cache_text_encoder_outputs', type: 'boolean', label: '缓存文本编码器输出', desc: '缓存文本编码器的输出，减少显存使用。⚠️ 启用时必须关闭「随机打乱标签」「全部标签丢弃概率」和「按标签丢弃概率」', defaultValue: true },
  { key: 'cache_text_encoder_outputs_to_disk', type: 'boolean', label: '缓存文本编码器输出到磁盘', desc: '缓存文本编码器的输出到磁盘', defaultValue: false },
  { key: 'full_fp16', type: 'boolean', label: '完全 FP16', desc: '完全使用 FP16 精度', defaultValue: false },
  { key: 'full_bf16', type: 'boolean', label: '完全 BF16', desc: '完全使用 BF16 精度', defaultValue: false },
  { key: 'no_half_vae', type: 'boolean', label: '不使用半精度 VAE', desc: '不使用半精度 VAE', defaultValue: false },
  { key: 'persistent_data_loader_workers', type: 'boolean', label: '保持数据加载器', desc: '保留加载训练集的 worker，减少每个 epoch 之间的停顿', defaultValue: true },
  { key: 'vae_batch_size', type: 'number', label: 'VAE 编码批量', desc: 'VAE 编码批量大小', defaultValue: '', min: 1 },
  { key: 'torch_compile', type: 'boolean', label: '启用 torch.compile', desc: '实验性：启用 PyTorch torch.compile', defaultValue: false },
  { key: 'dynamo_backend', type: 'select', label: 'torch.compile 后端', desc: 'torch.compile 后端', defaultValue: 'inductor', options: ['eager', 'aot_eager', 'inductor', 'cudagraphs'], visibleWhen: when('torch_compile', true) },
  { key: 'cpu_offload_checkpointing', type: 'boolean', label: 'CPU 卸载检查点', desc: '梯度检查点时将部分张量卸载到 CPU，节省显存', defaultValue: false },
];
const S_SPEED_FLOW = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', desc: '训练混合精度, RTX30系列以后也可以指定 bf16', defaultValue: 'bf16', options: ['no', 'fp16', 'bf16'] },
  { key: 'fp8_base', type: 'boolean', label: '基础模型使用 FP8', desc: '基础模型使用 FP8 精度', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', desc: '启用 sdpa', defaultValue: true },
  { key: 'sageattn', type: 'boolean', label: '启用 SageAttention', desc: '启用 SageAttention（实验性）', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', desc: '启用省显存 attention（比 xformers 更兼容，但通常更慢）', defaultValue: false },
  { key: 'lowram', type: 'boolean', label: '低内存模式', desc: '低内存模式 该模式下会将 U-net、文本编码器、VAE 直接加载到显存中', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', desc: '缓存图像 latent, 缓存 VAE 输出以减少 VRAM 使用', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', desc: '缓存图像 latent 到磁盘', defaultValue: true },
  { key: 'cache_text_encoder_outputs', type: 'boolean', label: '缓存文本编码器输出', desc: '缓存文本编码器的输出，减少显存使用。⚠️ 启用时必须关闭「随机打乱标签」「全部标签丢弃概率」和「按标签丢弃概率」', defaultValue: true },
  { key: 'cache_text_encoder_outputs_to_disk', type: 'boolean', label: '缓存文本编码器输出到磁盘', desc: '缓存文本编码器的输出到磁盘', defaultValue: true },
  { key: 'blocks_to_swap', type: 'number', label: 'Block 交换数', desc: '在 CPU/GPU 间交换的 block 数量，省显存。', defaultValue: '', min: 1 },
  { key: 'fp8_base_unet', type: 'boolean', label: '仅 U-Net FP8', desc: '仅对 U-Net / DiT 使用 FP8 精度', defaultValue: false },
  { key: 'text_encoder_batch_size', type: 'number', label: '文本编码器缓存批量', desc: '文本编码器缓存批量大小', defaultValue: '', min: 1 },
  { key: 'disable_mmap_load_safetensors', type: 'boolean', label: '禁用 mmap 加载', desc: '禁用 mmap 方式加载 safetensors，减少共享内存占用', defaultValue: false },
  { key: 'full_fp16', type: 'boolean', label: '完全 FP16', desc: '完全使用 FP16 精度', defaultValue: false },
  { key: 'full_bf16', type: 'boolean', label: '完全 BF16', desc: '完全使用 BF16 精度', defaultValue: false },
  { key: 'no_half_vae', type: 'boolean', label: '不使用半精度 VAE', desc: '不使用半精度 VAE', defaultValue: false },
  { key: 'persistent_data_loader_workers', type: 'boolean', label: '保持数据加载器', desc: '保留加载训练集的 worker，减少每个 epoch 之间的停顿', defaultValue: true },
  { key: 'vae_batch_size', type: 'number', label: 'VAE 编码批量', desc: 'VAE 编码批量大小', defaultValue: '', min: 1 },
  { key: 'torch_compile', type: 'boolean', label: '启用 torch.compile', desc: '实验性：启用 PyTorch torch.compile', defaultValue: false },
  { key: 'dynamo_backend', type: 'select', label: 'torch.compile 后端', desc: 'torch.compile 后端', defaultValue: 'inductor', options: ['eager', 'aot_eager', 'inductor', 'cudagraphs'], visibleWhen: when('torch_compile', true) },
  { key: 'cpu_offload_checkpointing', type: 'boolean', label: 'CPU 卸载检查点', desc: '梯度检查点时将部分张量卸载到 CPU省显存', defaultValue: false },
];
const S_SPEED_SD15 = [
  { key: 'mixed_precision', type: 'select', label: '混合精度', desc: '训练混合精度, RTX30系列以后也可以指定 bf16', defaultValue: 'fp16', options: ['no', 'fp16', 'bf16'] },
  { key: 'xformers', type: 'boolean', label: '启用 xformers', desc: '启用 xformers', defaultValue: true },
  { key: 'sdpa', type: 'boolean', label: '启用 SDPA', desc: '启用 sdpa', defaultValue: false },
  { key: 'mem_eff_attn', type: 'boolean', label: '低显存注意力', desc: '启用省显存 attention（比 xformers 更兼容，但通常更慢）', defaultValue: false },
  { key: 'cache_latents', type: 'boolean', label: '缓存 Latent', desc: '缓存图像 latent, 缓存 VAE 输出以减少 VRAM 使用', defaultValue: true },
  { key: 'cache_latents_to_disk', type: 'boolean', label: '缓存 Latent 到磁盘', desc: '缓存图像 latent 到磁盘', defaultValue: true },
  { key: 'full_fp16', type: 'boolean', label: '完全 FP16', desc: '完全使用 FP16 精度', defaultValue: false },
  { key: 'full_bf16', type: 'boolean', label: '完全 BF16', desc: '完全使用 BF16 精度', defaultValue: false },
  { key: 'no_half_vae', type: 'boolean', label: '不使用半精度 VAE', desc: '不使用半精度 VAE', defaultValue: false },
  { key: 'persistent_data_loader_workers', type: 'boolean', label: '保持数据加载器', desc: '保留加载训练集的 worker，减少每个 epoch 之间的停顿', defaultValue: true },
  { key: 'vae_batch_size', type: 'number', label: 'VAE 编码批量', desc: 'VAE 编码批量大小', defaultValue: '', min: 1 },
  { key: 'torch_compile', type: 'boolean', label: '启用 torch.compile', desc: '实验性：启用 PyTorch torch.compile', defaultValue: false },
  { key: 'dynamo_backend', type: 'select', label: 'torch.compile 后端', desc: 'torch.compile 后端', defaultValue: 'inductor', options: ['eager', 'aot_eager', 'inductor', 'cudagraphs'], visibleWhen: when('torch_compile', true) },
  { key: 'cpu_offload_checkpointing', type: 'boolean', label: 'CPU 卸载检查点', desc: '梯度检查点时将部分张量卸载到 CPU，节省显存', defaultValue: false },
];
const S_ADV = [
  { key: 'gpu_ids', type: 'string', label: '指定显卡', desc: '指定参与训练的 GPU 编号，多卡用逗号分隔（如 0,1）。留空使用默认主显卡。可在启动日志中查看可用 GPU 编号', defaultValue: '' },
  { key: 'noise_offset', type: 'number', label: '噪声偏移', desc: '在训练中添加噪声偏移来改良生成非常暗或者非常亮的图像，如果启用推荐为 0.1', defaultValue: '', step: 0.01 },
  { key: 'seed', type: 'number', label: '随机种子', desc: '随机种子', defaultValue: 1337 },
  { key: 'clip_skip', type: 'slider', label: 'CLIP 跳层', desc: 'CLIP 跳过层数 *玄学*（默认值 2 不会发送给后端，等同于不设置）', defaultValue: 2, min: 0, max: 12, step: 1 },
  { key: 'masked_loss', type: 'boolean', label: '启用蒙版损失', desc: '启用 Masked Loss。训练带透明蒙版 / alpha 的图像时可用', defaultValue: false },
  { key: 'alpha_mask', type: 'boolean', label: '读取 Alpha 通道作为 Mask', desc: '读取训练图像的 alpha 通道作为 loss mask', defaultValue: false },
  { key: 'training_comment', type: 'textarea', label: '训练备注', desc: '写入模型元数据的训练备注', defaultValue: '' },
  { key: 'ui_custom_params', type: 'textarea', label: '自定义 TOML 覆盖', desc: '危险：会直接覆盖界面中的参数。', defaultValue: '' },
  { key: 'no_metadata', type: 'boolean', label: '不写入元数据', desc: '不向输出模型写入完整训练元数据', defaultValue: false },
  { key: 'initial_epoch', type: 'number', label: '起始 epoch', desc: '从指定 epoch 编号开始计数', defaultValue: '', min: 1 },
  { key: 'initial_step', type: 'number', label: '起始 step', desc: '从指定 step 编号开始计数，会覆盖 initial_epoch', defaultValue: '', min: 0 },
  { key: 'skip_until_initial_step', type: 'boolean', label: '跳过前面步数', desc: '配合 initial_step 使用，真正跳过前面的训练步数', defaultValue: false },
  { key: 'ema_enabled', type: 'boolean', label: '启用 EMA', desc: '启用 EMA（指数滑动平均）。会额外复制一份参数，保存时写出 EMA 权重', defaultValue: false },
  { key: 'ema_decay', type: 'number', label: 'EMA 衰减率', desc: 'EMA 衰减率。越接近 1 越平滑', defaultValue: 0.999, min: 0, max: 0.99999, step: 0.0001, visibleWhen: when('ema_enabled', true) },
  { key: 'ema_update_every', type: 'number', label: 'EMA 更新间隔', desc: '每 N 个优化 step 更新一次 EMA', defaultValue: 1, min: 1, visibleWhen: when('ema_enabled', true) },
  { key: 'ema_update_after_step', type: 'number', label: 'EMA 起始步', desc: '从第几个优化 step 开始更新 EMA', defaultValue: 0, min: 0, visibleWhen: when('ema_enabled', true) },
  { key: 'safeguard_enabled', type: 'boolean', label: '启用 SafeGuard', desc: '拦截 NaN/Inf loss 与异常 loss spike', defaultValue: false },
  { key: 'safeguard_max_nan_count', type: 'number', label: '最大 NaN 次数', desc: '连续触发多少次 NaN 后停止训练', defaultValue: 3, min: 1, visibleWhen: when('safeguard_enabled', true) },
  { key: 'safeguard_loss_spike_threshold', type: 'number', label: 'Loss Spike 阈值', desc: '当前 loss 超过滚动平均多少倍时跳过', defaultValue: 5.0, min: 1, step: 0.1, visibleWhen: when('safeguard_enabled', true) },
  { key: 'safeguard_auto_reduce_lr', type: 'boolean', label: '自动降低学习率', desc: 'SafeGuard 触发时自动降低学习率', defaultValue: false, visibleWhen: when('safeguard_enabled', true) },
];

const S_NOISE = [
  { key: 'noise_offset_random_strength', type: 'boolean', label: '噪声偏移随机强度', desc: '噪声偏移强度在 0 到 noise_offset 间随机变化', defaultValue: false },
  { key: 'multires_noise_iterations', type: 'number', label: '多分辨率噪声迭代', desc: '多分辨率（金字塔）噪声迭代次数 推荐 6-10', defaultValue: '',step: 1 },
  { key: 'multires_noise_discount', type: 'number', label: '多分辨率噪声衰减', desc: '多分辨率（金字塔）衰减率 推荐 0.3-0.8', defaultValue: '', step: 0.01 },
  { key: 'ip_noise_gamma', type: 'number', label: '输入扰动噪声', desc: '输入扰动噪声强度，常用于正则化', defaultValue: '', step: 0.01 },
  { key: 'ip_noise_gamma_random_strength', type: 'boolean', label: '扰动噪声随机强度', desc: '输入扰动噪声强度在 0 到 ip_noise_gamma 间随机变化', defaultValue: false },
  { key: 'adaptive_noise_scale', type: 'number', label: '自适应噪声缩放', desc: '按 latent 平均绝对值动态追加 noise_offset', defaultValue: '', step: 0.01 },
  { key: 'min_timestep', type: 'number', label: '最小时间步', desc: '训练时允许的最小 timestep', defaultValue: '', min: 0 },
  { key: 'max_timestep', type: 'number', label: '最大时间步', desc: '训练时允许的最大 timestep', defaultValue: '', min: 1 },
];
const S_DATA_AUG = [
  { key: 'color_aug', type: 'boolean', label: '颜色增强', desc: '启用颜色改变数据增强', defaultValue: false },
  { key: 'flip_aug', type: 'boolean', label: '翻转增强', desc: '启用图像翻转数据增强', defaultValue: false },
  { key: 'random_crop', type: 'boolean', label: '随机裁剪', desc: '启用随机剪裁数据增强', defaultValue: false },
];
const S_VALIDATION = [
  { key: 'validation_split', type: 'number', label: '验证集比例', desc: '验证集划分比例，从训练集自动切出一部分做验证', defaultValue: 0, min: 0, max: 1, step: 0.01 },
  { key: 'validation_seed', type: 'number', label: '验证集种子', desc: '验证集切分随机种子', defaultValue: '' },
  { key: 'validate_every_n_steps', type: 'number', label: '每 N 步验证', desc: '每 N 步执行一次验证', defaultValue: '', min: 1 },
  { key: 'validate_every_n_epochs', type: 'number', label: '每 N 轮验证', desc: '每 N 个 epoch 执行一次验证', defaultValue: '', min: 1 },
  { key: 'max_validation_steps', type: 'number', label: '最大验证步数', desc: '每次验证最多处理多少个验证批次', defaultValue: '', min: 1 },
];
const S_THERMAL = [
  { key: 'cooldown_every_n_epochs', type: 'number', label: '每 N 轮冷却', desc: '每 N 个 epoch 暂停训练冷却。留空关闭', defaultValue: '', min: 1 },
  { key: 'cooldown_minutes', type: 'number', label: '冷却分钟数', desc: '每次冷却至少暂停多少分钟', defaultValue: '', min: 0, step: 0.5 },
  { key: 'cooldown_until_temp_c', type: 'number', label: '冷却目标温度(℃)', desc: '等待显卡温度降到多少℃以下再继续', defaultValue: '', min: 1 },
  { key: 'cooldown_poll_seconds', type: 'number', label: '温度轮询间隔(秒)', desc: '温度轮询间隔', defaultValue: 15, min: 1 },
  { key: 'gpu_power_limit_w', type: 'number', label: 'GPU 功率墙(W)', desc: '训练前设置显卡功率墙（瓦）', defaultValue: '', min: 1 },
];

// dataset fields helper
const ds = (reso, bucketMax = 2048, bucketStep = 64, extra = []) => [
  { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练数据集路径', desc: '训练数据集路径', defaultValue: './train/aki' },
  { key: 'reg_data_dir', type: 'folder', pickerType: 'folder', label: '正则化数据集路径', desc: '正则化数据集路径。默认留空，不使用正则化图像', defaultValue: '' },
  { key: 'prior_loss_weight', type: 'number', label: '先验损失权重', desc: '正则化 - 先验损失权重', defaultValue: 1, min: 0, step: 0.1 },
  { key: 'resolution', type: 'string', label: '训练分辨率', desc: '训练图片分辨率，宽x高。支持非正方形，但必须是 64 倍数。', defaultValue: reso },
  { key: 'enable_bucket', type: 'boolean', label: '启用分桶', desc: '启用 arb 桶以允许非固定宽高比的图片', defaultValue: true },
  { key: 'min_bucket_reso', type: 'number', label: '桶最小分辨率', desc: 'arb 桶最小分辨率', defaultValue: 256 },
  { key: 'max_bucket_reso', type: 'number', label: '桶最大分辨率', desc: 'arb 桶最大分辨率', defaultValue: bucketMax },
  { key: 'bucket_reso_steps', type: 'number', label: '桶划分单位', desc: 'arb 桶分辨率划分单位', defaultValue: bucketStep },
  { key: 'bucket_no_upscale', type: 'boolean', label: '桶不放大图片', desc: 'arb 桶不放大图片', defaultValue: true },
  ...extra,
];

// LoRA network fields helper
const netLora = (mod, dim = 32, alpha = 32, maxDim = 512, extra = []) => [
  { key: 'network_module', type: 'select', label: '训练网络模块', desc: '训练网络模块', defaultValue: mod, options: [mod, ...(mod.includes('lycoris') ? [] : ['lycoris.kohya'])] },
  { key: 'network_weights', type: 'file', pickerType: 'output-model-file', label: '继续训练 LoRA', desc: '从已有的 LoRA 模型上继续训练，填写路径', defaultValue: '' },
  { key: 'network_dim', type: 'slider', label: '网络维度', desc: '网络维度，常用 4~128，不是越大越好, 低 dim 可以降低显存占用', defaultValue: dim, min: 1, max: maxDim, step: 1 },
  { key: 'network_alpha', type: 'slider', label: '网络 Alpha', desc: '常用值：等于 network_dim 或 network_dim*1/2 或 1。使用较小的 alpha 需要提升学习率', defaultValue: alpha, min: 1, max: maxDim, step: 1 },
  { key: 'network_dropout', type: 'number', label: '网络 Dropout', desc: 'dropout 概率（与 lycoris 不兼容，需要用 lycoris 自带的）', defaultValue: 0, min: 0, step: 0.01 },
  { key: 'dim_from_weights', type: 'boolean', label: '从权重推断 Dim', desc: '从已有 network_weights 自动推断 rank / dim', defaultValue: false },
  { key: 'scale_weight_norms', type: 'number', label: '最大范数正则化', desc: '最大范数正则化。如果使用，推荐为 1', defaultValue: '', min: 0, step: 0.01 },
  { key: 'lycoris_algo', type: 'select', label: 'LyCORIS 算法', desc: 'LyCORIS 网络算法', defaultValue: 'locon', options: ['locon', 'loha', 'lokr', 'ia3', 'dylora', 'glora', 'diag-oft', 'boft'], visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'conv_dim', type: 'number', label: '卷积维度', desc: 'LyCORIS 卷积维度', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'conv_alpha', type: 'number', label: '卷积 Alpha', desc: 'LyCORIS 卷积 Alpha', defaultValue: 1, min: 1, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'dropout', type: 'number', label: 'LyCORIS Dropout', desc: 'LyCORIS 专用 dropout 概率。推荐 0~0.5，LoHa/LoKr/(IA)^3 暂不支持', defaultValue: 0, min: 0, max: 1, step: 0.01, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'train_norm', type: 'boolean', label: '训练 Norm 层', desc: '训练 Norm 层，不支持 (IA)^3', defaultValue: false, visibleWhen: when('network_module', 'lycoris.kohya') },
  { key: 'lokr_factor', type: 'number', label: 'LoKr 系数', desc: '常用 4~无穷（填写 -1 为无穷）', defaultValue: -1, min: -1, visibleWhen: all(when('network_module', 'lycoris.kohya'), when('lycoris_algo', 'lokr')) },
  { key: 'enable_base_weight', type: 'boolean', label: '启用基础权重', desc: '启用基础权重（差异炼丹）', defaultValue: false },
  { key: 'base_weights', type: 'textarea', label: '基础权重路径', desc: '合并入底模的 LoRA 路径，一行一个路径', defaultValue: '', visibleWhen: when('enable_base_weight', true) },
  { key: 'base_weights_multiplier', type: 'textarea', label: '基础权重比例', desc: '合并入底模的 LoRA 权重，一行一个数字', defaultValue: '', visibleWhen: when('enable_base_weight', true) },
  { key: 'network_args_custom', type: 'textarea', label: '自定义 network_args', desc: '自定义 network_args，每行一个参数', defaultValue: '' },
  ...extra,
];

// flow-based model params helper
const flowParams = (defaults = {}) => [
  { key: 'timestep_sampling', type: 'select', label: '时间步采样', desc: '时间步采样策略', defaultValue: defaults.ts || 'sigmoid', options: ['sigma', 'uniform', 'sigmoid', 'shift', 'flux_shift'] },
  { key: 'sigmoid_scale', type: 'number', label: 'sigmoid 缩放', desc: 'sigmoid 缩放系数', defaultValue: defaults.ss || 1.0, step: 0.001 },
  { key: 'model_prediction_type', type: 'select', label: '模型预测类型', desc: '模型预测类型', defaultValue: defaults.mp || 'raw', options: ['raw', 'additive', 'sigma_scaled'] },
  { key: 'discrete_flow_shift', type: 'number', label: '离散流位移', desc: '离散流位移值', defaultValue: defaults.dfs || 1.0, step: 0.001 },
  { key: 'guidance_scale', type: 'number', label: 'CFG 引导缩放', desc: 'CFG 引导缩放', defaultValue: defaults.gs || 1.0, step: 0.01 },
  { key: 'weighting_scheme', type: 'select', label: '权重策略', desc: '损失加权策略', defaultValue: defaults.ws || 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
  { key: 'loss_type', type: 'select', label: '损失函数类型', desc: '损失函数类型', defaultValue: defaults.lt || 'l2', options: ['l1', 'l2', 'huber', 'smooth_l1'] },
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
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SDXL 底模路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: '(可选) VAE 模型文件路径，使用外置 VAE 文件覆盖模型内本身的', defaultValue: '' },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: 'v-parameterization 学习（训练 Illustrious 等 v-pred 模型时需要开启）', defaultValue: false },
    { key: 'zero_terminal_snr', type: 'boolean', label: '零终端 SNR', desc: 'Zero Terminal SNR（v-pred 模型训练推荐开启）', defaultValue: true, visibleWhen: when('v_parameterization', true) },
    { key: 'scale_v_pred_loss_like_noise_pred', type: 'boolean', label: '缩放 v-pred 损失', desc: '缩放 v-prediction 损失（v-pred 模型训练推荐开启）', defaultValue: true, visibleWhen: when('v_parameterization', true) },
  ]),
  sec('save-settings', 'model', '保存设置', '输出路径、格式与训练状态。', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '训练数据、正则图与分桶。', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '标签打乱与丢弃策略。', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', 'LoRA / LyCORIS 参数。', netLora('networks.lora', 32, 32, 512, [

    { key: 'dora_wd', type: 'boolean', label: '启用 DoRA', desc: '启用 DoRA 训练', defaultValue: false },
    { key: 'dylora_unit', type: 'number', label: 'DyLoRA 分块', desc: 'dylora 分割块数单位，最小 1 也最慢。一般 4、8、12、16 这几个选', defaultValue: 4, min: 1, visibleWhen: when('network_module', 'networks.dylora') },
    { key: 'enable_block_weights', type: 'boolean', label: '启用分层学习率', desc: '启用分层学习率训练（只支持网络模块 networks.lora）', defaultValue: false },
  ])),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '学习率、调度器与优化器。', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '训练轮数、批量与梯度。', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '训练中生成预览图。', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '混合精度、缓存与注意力后端。', [...S_SPEED_SDXL]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '噪声、种子与实验功能。', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];


// ---- SD 1.5 LoRA ----
const SD15_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 底模与恢复训练。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD1.5 底模路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: '(可选) VAE 模型文件路径，使用外置 VAE 文件覆盖模型内本身的', defaultValue: '' },
    { key: 'v2', type: 'boolean', label: 'SD 2.x 模型', desc: '使用 SD 2.x 模型', defaultValue: false },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: 'v-parameterization 学习（训练 Illustrious 等 v-pred 模型时需要开启）', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora', 32, 32, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- FLUX LoRA ----
const FLUX_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 模型路径', desc: 'AutoEncoder 模型路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', desc: 'CLIP-L 文本编码器路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', desc: 'T5-XXL 文本编码器路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('flux-params', 'model', 'FLUX 专用参数', '时间步采样、CFG、损失函数等。', [
    ...flowParams({ ts: 'sigmoid', gs: 1.0 }),
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', desc: 'T5-XXL 最大 token 长度', defaultValue: '', min: 1 },
    { key: 'apply_t5_attn_mask', type: 'boolean', label: '应用 T5 注意力掩码', desc: '应用 T5 注意力掩码以更好处理变长文本', defaultValue: true },
    { key: 'train_t5xxl', type: 'boolean', label: '训练T5XXL（不推荐）', desc: '训练 T5-XXL 文本编码器（不推荐，显存开销极大）', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_flux', 4, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- SD3 LoRA ----
const SD3_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD3 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd3-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD3 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', desc: 'CLIP-L 文本编码器路径', defaultValue: '' },
    { key: 'clip_g', type: 'file', pickerType: 'model-file', label: 'CLIP-G 路径', desc: 'CLIP-G 文本编码器路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', desc: 'T5-XXL 文本编码器路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('sd3-params', 'model', 'SD3 专用参数', '', [
    { key: 'weighting_scheme', type: 'select', label: '权重策略', desc: '权重策略', defaultValue: 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', desc: 'T5-XXL 最大 token 长度', defaultValue: '', min: 1 },
    { key: 'apply_lg_attn_mask', type: 'boolean', label: '应用 CLIP-L/G 注意力掩码', desc: '应用 CLIP-L/G 注意力掩码', defaultValue: false },
    { key: 'train_t5xxl', type: 'boolean', label: '训练 T5XXL', desc: '训练 T5-XXL 文本编码器（不推荐，显存开销极大）', defaultValue: false },
    { key: 'clip_l_dropout_rate', type: 'number', label: 'CLIP-L dropout', desc: 'CLIP-L 文本编码器随机丢弃概率', defaultValue: '', min: 0, max: 1, step: 0.01 },
    { key: 'clip_g_dropout_rate', type: 'number', label: 'CLIP-G dropout', desc: 'CLIP-G 文本编码器随机丢弃概率', defaultValue: '', min: 0, max: 1, step: 0.01 },
    { key: 't5_dropout_rate', type: 'number', label: 'T5 dropout', desc: 'T5 文本编码器随机丢弃概率', defaultValue: '', min: 0, max: 1, step: 0.01 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_sd3', 4, 1, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- Lumina LoRA ----
const LUMINA_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Lumina 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'lumina-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Lumina 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 模型路径', desc: 'AutoEncoder 模型路径', defaultValue: '' },
    { key: 'gemma2', type: 'file', pickerType: 'model-file', label: 'Gemma2 模型路径', desc: 'Gemma2 文本模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('lumina-params', 'model', 'Lumina 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 6.0 }),
    { key: 'gemma2_max_token_length', type: 'number', label: 'Gemma2 最大 token', desc: 'Gemma2 最大 token 长度', defaultValue: '', min: 1 },
    { key: 'use_flash_attn', type: 'boolean', label: '启用 Flash Attention', desc: '启用 Flash Attention 加速', defaultValue: false },
    { key: 'use_sage_attn', type: 'boolean', label: '启用 Sage Attention', desc: '启用 Sage Attention 加速', defaultValue: false },
    { key: 'system_prompt', type: 'string', label: '系统提示词', desc: 'Lumina 系统提示词', defaultValue: '' },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_lumina', 4, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- HunyuanImage LoRA ----
const HUNYUAN_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', '混元图像模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'hunyuan-image-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'HunyuanImage 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'text_encoder', type: 'file', pickerType: 'model-file', label: 'Qwen2.5-VL 文本编码器', desc: '文本编码器路径', defaultValue: '' },
    { key: 'byt5', type: 'file', pickerType: 'model-file', label: 'ByT5 模型路径', desc: 'ByT5 模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('hunyuan-params', 'model', 'HunyuanImage 专用参数', '', [
    ...flowParams({ ts: 'sigma', dfs: 5.0 }),
    { key: 'attn_mode', type: 'select', label: 'Attention 实现', desc: 'Attention 实现方式', defaultValue: '', options: ['', 'torch', 'xformers', 'flash', 'sageattn'] },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', desc: '拆分 attention 以节省显存', defaultValue: false },
    { key: 'text_encoder_cpu', type: 'boolean', label: '文本编码器用 CPU', desc: '将文本编码器放在 CPU 上以节省显存', defaultValue: false },
    { key: 'vae_chunk_size', type: 'number', label: 'VAE 解码分块', desc: 'VAE 解码时的分块大小，更小值更省显存', defaultValue: '', min: 1 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', '', netLora('networks.lora_hunyuan_image', 16, 16, 256)),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- Anima LoRA ----
const ANIMA_LORA_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Anima 模型路径。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'anima-lora' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Anima DiT 权重路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'Qwen Image VAE 路径', desc: '(可选) VAE 模型文件路径，使用外置 VAE 文件覆盖模型内本身的', defaultValue: '' },
    { key: 'qwen3', type: 'file', pickerType: 'model-file', label: 'Qwen3 文本模型路径', desc: 'Qwen3 文本模型路径', defaultValue: '' },
    { key: 'llm_adapter_path', type: 'file', pickerType: 'model-file', label: 'LLM Adapter 路径', desc: 'LLM Adapter 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('anima-params', 'model', 'Anima 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 3.0 }),
    { key: 'qwen3_max_token_length', type: 'number', label: 'Qwen3 最大 token', desc: 'Qwen3 最大 token 长度', defaultValue: 512, min: 1 },
    { key: 't5_max_token_length', type: 'number', label: 'T5 最大 token', desc: 'T5 最大 token 长度', defaultValue: 512, min: 1 },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', desc: '拆分 attention 以节省显存', defaultValue: false },
    { key: 'vae_chunk_size', type: 'number', label: 'VAE 分块大小', desc: 'VAE 解码时的分块大小，更小值更省显存', defaultValue: '', min: 2 },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('network-settings', 'network', '网络设置', 'LoRA / LoKr 模式。', [
    { key: 'lora_type', type: 'select', label: '适配器类型', desc: '适配器类型：lora 或 lokr', defaultValue: 'lora', options: ['lora', 'lokr'] },
    { key: 'network_weights', type: 'file', pickerType: 'output-model-file', label: '继续训练 LoRA', desc: '从已有的 LoRA 模型上继续训练，填写路径', defaultValue: '' },
    { key: 'network_dim', type: 'slider', label: '网络维度', desc: '网络维度，常用 4~128，不是越大越好, 低 dim 可以降低显存占用', defaultValue: 16, min: 1, max: 256, step: 1 },
    { key: 'network_alpha', type: 'slider', label: '网络 Alpha', desc: '常用值：等于 network_dim 或 network_dim*1/2 或 1', defaultValue: 16, min: 1, max: 256, step: 1 },
    { key: 'dim_from_weights', type: 'boolean', label: '从权重推断 Dim', desc: '从已有 network_weights 自动推断 rank / dim', defaultValue: false },
    { key: 'scale_weight_norms', type: 'number', label: '最大范数正则化', desc: '最大范数正则化。如果使用，推荐为 1', defaultValue: '', min: 0, step: 0.01 },
    { key: 'train_norm', type: 'boolean', label: '训练 Norm 层', desc: '训练 Norm 层', defaultValue: false },
    { key: 'lokr_factor', type: 'number', label: 'LoKr 系数', desc: 'LoKr 系数，常用 4~无穷（-1 为无穷）', defaultValue: 8, min: -1, visibleWhen: when('lora_type', 'lokr') },
  ]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- SD DreamBooth / SDXL Finetune (共用 schema) ----
const finetuneModel = (typeId, label) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: '(可选) VAE 模型文件路径，使用外置 VAE 文件覆盖模型内本身的', defaultValue: '' },
];
const DB_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD DreamBooth 全参微调。', [
    ...finetuneModel('sd-dreambooth', 'SD1.5'),
    { key: 'v2', type: 'boolean', label: 'SD 2.x 模型', desc: '使用 SD 2.x 模型', defaultValue: false },
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: 'v-parameterization 学习（训练 Illustrious 等 v-pred 模型时需要开启）', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];
const SDXL_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL 全参微调。', [
    ...finetuneModel('sdxl-finetune', 'SDXL'),
    { key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: 'v-parameterization 学习（训练 Illustrious 等 v-pred 模型时需要开启）', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- FLUX Finetune ----
const FLUX_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', desc: 'AutoEncoder 模型路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', desc: 'CLIP-L 文本编码器路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', desc: 'T5-XXL 文本编码器路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('flux-params', 'model', 'FLUX 专用参数', '', [
    ...flowParams({ ts: 'sigma', mp: 'sigma_scaled', dfs: 3.0, gs: 3.5 }),
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', desc: 'T5-XXL 最大 token 长度', defaultValue: '', min: 1 },
    { key: 'apply_t5_attn_mask', type: 'boolean', label: '应用 T5 注意力掩码', desc: '应用 T5 注意力掩码以更好处理变长文本', defaultValue: false },
    { key: 'blockwise_fused_optimizers', type: 'boolean', label: 'Blockwise fused optimizer', desc: '使用分块融合优化器，全参微调时可大幅省显存', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- SD3 Finetune ----
const SD3_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD3 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'sd3-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'SD3 模型路径', desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: '(可选) VAE 模型文件路径，使用外置 VAE 文件覆盖模型内本身的', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', desc: 'CLIP-L 文本编码器路径', defaultValue: '' },
    { key: 'clip_g', type: 'file', pickerType: 'model-file', label: 'CLIP-G 路径', desc: 'CLIP-G 文本编码器路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', desc: 'T5-XXL 文本编码器路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '从某个 save_state 保存的中断状态继续训练，填写文件路径', defaultValue: '' },
  ]),
  sec('sd3-params', 'model', 'SD3 专用参数', '', [
    { key: 'weighting_scheme', type: 'select', label: '权重策略', desc: '权重策略', defaultValue: 'uniform', options: ['sigma_sqrt', 'logit_normal', 'mode', 'cosmap', 'none', 'uniform'] },
    { key: 't5xxl_max_token_length', type: 'number', label: 'T5XXL 最大 token', desc: 'T5-XXL 最大 token 长度', defaultValue: 256, min: 1 },
    { key: 'training_shift', type: 'number', label: '训练位移', desc: '训练时间步偏移值', defaultValue: 1.0, step: 0.001 },
    { key: 'train_text_encoder', type: 'boolean', label: '训练 CLIP-L/G', desc: '同时训练 CLIP-L/G 文本编码器', defaultValue: false },
    { key: 'train_t5xxl', type: 'boolean', label: '训练 T5XXL', desc: '训练 T5-XXL 文本编码器（不推荐，显存开销极大）', defaultValue: false },
    { key: 'blockwise_fused_optimizers', type: 'boolean', label: 'Blockwise fused optimizer', desc: '使用分块融合优化器，全参微调时可大幅省显存', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(20)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- Lumina Finetune ----
const LUMINA_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Lumina 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'lumina-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Lumina 模型路径', desc: 'Lumina 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', desc: 'AE 路径', defaultValue: '' },
    { key: 'gemma2', type: 'file', pickerType: 'model-file', label: 'Gemma2 路径', desc: 'Gemma2 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '继续训练路径', defaultValue: '' },
  ]),
  sec('lumina-params', 'model', 'Lumina 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 6.0 }),
    { key: 'gemma2_max_token_length', type: 'number', label: 'Gemma2 最大 token', desc: 'Gemma2 最大 token', defaultValue: '', min: 1 },
    { key: 'use_flash_attn', type: 'boolean', label: '启用 Flash Attention', desc: '启用 Flash Attention', defaultValue: false },
    { key: 'use_sage_attn', type: 'boolean', label: '启用 Sage Attention', desc: '启用 Sage Attention', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- Anima Finetune ----
const ANIMA_FT_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'Anima 全参微调。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'anima-finetune' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'Anima DiT 路径', desc: 'Anima DiT 路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'vae', type: 'file', pickerType: 'model-file', label: 'Qwen Image VAE 路径', desc: 'Qwen Image VAE 路径', defaultValue: '' },
    { key: 'qwen3', type: 'file', pickerType: 'model-file', label: 'Qwen3 文本模型路径', desc: 'Qwen3 文本模型路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '继续训练路径', defaultValue: '' },
  ]),
  sec('anima-params', 'model', 'Anima 专用参数', '', [
    ...flowParams({ ts: 'shift', dfs: 3.0 }),
    { key: 'qwen3_max_token_length', type: 'number', label: 'Qwen3 最大 token', desc: 'Qwen3 最大 token', defaultValue: 512, min: 1 },
    { key: 't5_max_token_length', type: 'number', label: 'T5 最大 token', desc: 'T5 最大 token', defaultValue: 512, min: 1 },
    { key: 'split_attn', type: 'boolean', label: '拆分 attention', desc: '拆分 attention', defaultValue: false },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- ControlNet (SD / SDXL / FLUX) ----
const cnModel = (typeId, label, extra = []) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
  { key: 'controlnet_model_name_or_path', type: 'file', pickerType: 'model-file', label: '已有 ControlNet 模型路径', desc: '留空从头训练。', defaultValue: '' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '继续训练路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: 'VAE 路径', defaultValue: '' },
  ...extra,
];
const cnDataset = (reso, bucketMax, bucketStep) => [
  { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练数据集路径', desc: '训练数据集路径', defaultValue: './train/aki' },
  { key: 'conditioning_data_dir', type: 'folder', pickerType: 'folder', label: '条件图数据集路径', desc: '条件图数据集路径', defaultValue: '' },
  { key: 'resolution', type: 'string', label: '训练分辨率', desc: '训练分辨率', defaultValue: reso },
  { key: 'enable_bucket', type: 'boolean', label: '启用分桶', desc: '启用分桶', defaultValue: true },
  { key: 'min_bucket_reso', type: 'number', label: '桶最小分辨率', desc: '桶最小分辨率', defaultValue: 256 },
  { key: 'max_bucket_reso', type: 'number', label: '桶最大分辨率', desc: '桶最大分辨率', defaultValue: bucketMax },
  { key: 'bucket_reso_steps', type: 'number', label: '桶划分单位', desc: '桶划分单位', defaultValue: bucketStep },
];
const cnTrainFields = [
  { key: 'max_train_epochs', type: 'number', label: '最大训练轮数', desc: '最大训练轮数', defaultValue: 10, min: 1 },
  { key: 'train_batch_size', type: 'slider', label: '批量大小', desc: '批量大小', defaultValue: 1, min: 1, max: 32, step: 1 },
  { key: 'gradient_checkpointing', type: 'boolean', label: '梯度检查点', desc: '梯度检查点', defaultValue: false },
  { key: 'gradient_accumulation_steps', type: 'number', label: '梯度累加步数', desc: '梯度累加步数', defaultValue: 1, min: 1 },
  { key: 'max_grad_norm', type: 'number', label: '梯度裁剪上限', desc: '梯度裁剪上限', defaultValue: 1.0, min: 0, step: 0.1 },
];
const cnLR = [
  { key: 'learning_rate', type: 'string', label: '学习率', desc: '学习率', defaultValue: '1e-4' },
  { key: 'control_net_lr', type: 'string', label: 'ControlNet 学习率', desc: 'ControlNet 学习率', defaultValue: '1e-4' },
  { key: 'lr_scheduler', type: 'select', label: '学习率调度器', desc: '学习率调度器', defaultValue: 'cosine_with_restarts', options: ['linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup'] },
  { key: 'lr_warmup_steps', type: 'number', label: '预热步数', desc: '预热步数', defaultValue: 0, min: 0 },
  { key: 'optimizer_type', type: 'select', label: '优化器', desc: '优化器', defaultValue: 'AdamW8bit', options: ['AdamW', 'AdamW8bit', 'PagedAdamW8bit', 'Lion', 'DAdaptation', 'AdaFactor', 'Prodigy'] },
];
const SD_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 ControlNet。', cnModel('sd-controlnet', 'SD1.5', [{ key: 'v2', type: 'boolean', label: 'SD 2.x', desc: 'SD 2.x', defaultValue: false }])),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];
const SDXL_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL ControlNet。', cnModel('sdxl-controlnet', 'SDXL', [{ key: 'v_parameterization', type: 'boolean', label: 'V 参数化', desc: 'V 参数化', defaultValue: false }])),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];
const FLUX_CN_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'FLUX ControlNet。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'flux-controlnet' },
    { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: 'FLUX 模型路径', desc: 'FLUX 模型路径', defaultValue: './sd-models/model.safetensors' },
    { key: 'ae', type: 'file', pickerType: 'model-file', label: 'AE 路径', desc: 'AE 路径', defaultValue: '' },
    { key: 'clip_l', type: 'file', pickerType: 'model-file', label: 'CLIP-L 路径', desc: 'CLIP-L 路径', defaultValue: '' },
    { key: 't5xxl', type: 'file', pickerType: 'model-file', label: 'T5-XXL 路径', desc: 'T5-XXL 路径', defaultValue: '' },
    { key: 'controlnet_model_name_or_path', type: 'file', pickerType: 'model-file', label: '已有 ControlNet 路径', desc: '已有 ControlNet 路径', defaultValue: '' },
    { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '继续训练路径', defaultValue: '' },
  ]),
  sec('save-settings', 'model', '保存设置', '', [...S_SAVE]),
  sec('dataset-settings', 'dataset', '数据集设置', '', cnDataset('768,768', 2048, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', S_CAPTION.filter((f) => f.key !== 'max_token_length')),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...cnLR]),
  sec('training-settings', 'training', '训练参数', '', [...cnTrainFields]),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_FLOW]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- Textual Inversion ----
const tiModel = (typeId, label, extra = []) => [
  { key: 'model_train_type', type: 'hidden', defaultValue: typeId },
  { key: 'pretrained_model_name_or_path', type: 'file', pickerType: 'model-file', label: `${label} 底模路径`, desc: '底模文件路径', defaultValue: './sd-models/model.safetensors' },
  { key: 'weights', type: 'file', pickerType: 'model-file', label: '初始 embedding 权重路径', desc: '初始 embedding 权重路径', defaultValue: '' },
  { key: 'resume', type: 'folder', pickerType: 'output-folder', label: '继续训练路径', desc: '继续训练路径', defaultValue: '' },
  { key: 'vae', type: 'file', pickerType: 'model-file', label: 'VAE 路径', desc: 'VAE 路径', defaultValue: '' },
  ...extra,
];
const tiParams = [
  { key: 'token_string', type: 'string', label: 'Token 字符串', desc: 'tokenizer 中不存在的新 token。', defaultValue: '' },
  { key: 'init_word', type: 'string', label: '初始化词', desc: '初始化词', defaultValue: '' },
  { key: 'num_vectors_per_token', type: 'number', label: '每 token 向量数', desc: '每 token 向量数', defaultValue: 1, min: 1 },
  { key: 'use_object_template', type: 'boolean', label: '使用物体模板', desc: '使用物体模板', defaultValue: false },
  { key: 'use_style_template', type: 'boolean', label: '使用风格模板', desc: '使用风格模板', defaultValue: false },
];
const SD_TI_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SD1.5 Textual Inversion。', tiModel('sd-textual-inversion', 'SD1.5', [{ key: 'v2', type: 'boolean', label: 'SD 2.x', desc: 'SD 2.x', defaultValue: false }])),
  sec('ti-params', 'model', 'Textual Inversion 专用', '', [...tiParams]),
  sec('save-settings', 'model', '保存设置', '', S_SAVE.map((f) => f.key === 'save_model_as' ? { ...f, defaultValue: 'pt' } : f.key === 'output_name' ? { ...f, defaultValue: 'embedding' } : f)),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('512,512', 1024, 64)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SD15]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];
const SDXL_TI_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'SDXL Textual Inversion。', tiModel('sdxl-textual-inversion', 'SDXL')),
  sec('ti-params', 'model', 'Textual Inversion 专用', '', [...tiParams]),
  sec('save-settings', 'model', '保存设置', '', S_SAVE.map((f) => f.key === 'save_model_as' ? { ...f, defaultValue: 'pt' } : f.key === 'output_name' ? { ...f, defaultValue: 'embedding' } : f)),
  sec('dataset-settings', 'dataset', '数据集设置', '', ds('1024,1024', 2048, 32)),
  sec('caption-settings', 'dataset', 'Caption 选项', '', [...S_CAPTION]),
  sec('data-aug-settings', 'dataset', '数据增强', '颜色、翻转与裁剪增强。', [...S_DATA_AUG]),
  sec('optimizer-settings', 'optimizer', '学习率与优化器', '', [...S_LR]),
  sec('training-settings', 'training', '训练参数', '', S_TRAIN(10)),
  sec('preview-settings', 'preview', '预览图设置', '', [...S_PREVIEW]),
  sec('validation-settings', 'preview', '验证设置', '验证集划分与验证频率。', [...S_VALIDATION]),
  sec('speed-settings', 'speed', '速度优化', '', [...S_SPEED_SDXL]),
  sec('noise-settings', 'advanced', '噪声设置', '噪声偏移与多分辨率噪声。', [...S_NOISE]),
  sec('advanced-settings', 'advanced', '其他设置', '', [...S_ADV]),
  sec('thermal-settings', 'training', '散热与功耗', '训练期间冷却与功率管理。', [...S_THERMAL]),
];

// ---- YOLO 训练 ----
const YOLO_SECTIONS = [
  sec('model-settings', 'model', '训练用模型', 'YOLO 模型配置。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'yolo' },
    { key: 'pretrained_model_name_or_path', type: 'string', label: 'YOLO 模型权重', desc: 'YOLO 模型权重或模型 yaml。可填本地路径或官方模型名如 yolo11n.pt', defaultValue: 'yolo11n.pt' },
    { key: 'resume', type: 'file', pickerType: 'model-file', label: '继续训练检查点', desc: '从已有 YOLO 训练检查点继续训练。填写 last.pt 一类的检查点文件路径', defaultValue: '' },
  ]),
  sec('dataset-settings', 'dataset', '数据集设置', 'YOLO 数据集目录与类别。', [
    { key: 'yolo_data_config_path', type: 'file', pickerType: 'model-file', label: '自定义数据集 yaml', desc: '可选。自定义 YOLO 数据集 yaml。填写后下方训练/验证目录仅作参考', defaultValue: '' },
    { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '训练图像目录', desc: '训练图像目录', defaultValue: './datasets/images/train' },
    { key: 'val_data_dir', type: 'folder', pickerType: 'folder', label: '验证图像目录', desc: '验证图像目录。留空时回退为训练目录', defaultValue: './datasets/images/val' },
    { key: 'class_names', type: 'textarea', label: '类别名称', desc: '类别名称，一行一个', defaultValue: 'class0' },
  ]),
  sec('save-settings', 'model', '保存设置', '', [
    { key: 'output_name', type: 'string', label: '输出名称', desc: '本次训练输出名称', defaultValue: 'exp' },
    { key: 'output_dir', type: 'folder', pickerType: 'folder', label: '输出目录', desc: '训练输出目录', defaultValue: './output/yolo' },
    { key: 'save_every_n_epochs', type: 'number', label: '每 N 轮保存', desc: '每 N 个 epoch 保存一次检查点', defaultValue: 10, min: 1 },
  ]),
  sec('training-settings', 'training', '训练参数', '', [
    { key: 'epochs', type: 'number', label: '训练轮数', desc: '训练 epoch 数', defaultValue: 100, min: 1 },
    { key: 'batch', type: 'number', label: '批量大小', desc: '训练批量大小', defaultValue: 16, min: 1 },
    { key: 'imgsz', type: 'number', label: '输入分辨率', desc: '训练输入分辨率', defaultValue: 640, min: 32 },
    { key: 'workers', type: 'number', label: '数据加载 Worker', desc: '数据加载 worker 数量', defaultValue: 8, min: 0 },
    { key: 'device', type: 'string', label: '设备', desc: '手动指定设备，如 0、0,1、cpu。留空自动检测', defaultValue: '' },
    { key: 'seed', type: 'number', label: '随机种子', desc: '随机种子', defaultValue: 1337 },
  ]),
];

// ---- 美学评分模型训练 ----
const AESTHETIC_SCORER_SECTIONS = [
  sec('output-settings', 'model', '输出设置', '模型输出配置。', [
    { key: 'model_train_type', type: 'hidden', defaultValue: 'aesthetic-scorer' },
    { key: 'output_name', type: 'string', label: '模型保存名称', desc: '模型保存名称', defaultValue: 'aesthetic-scorer-best' },
    { key: 'output_dir', type: 'folder', pickerType: 'folder', label: '输出目录', desc: '模型输出目录', defaultValue: './output/aesthetic-scorer' },
    { key: 'save_model_as', type: 'select', label: '保存格式', desc: '模型保存格式', defaultValue: 'safetensors', options: ['safetensors', 'pt', 'pth', 'ckpt'] },
  ]),
  sec('dataset-settings', 'dataset', '数据集设置', '标注文件与图片配置。', [
    { key: 'annotations', type: 'file', pickerType: 'model-file', label: '标注文件路径', desc: '标注文件路径，支持 .jsonl、.csv、.db', defaultValue: './datasets/aesthetic/annotations.jsonl' },
    { key: 'image_root', type: 'folder', pickerType: 'folder', label: '图片根目录', desc: '图片根目录。留空时按标注文件中的路径直接解析', defaultValue: '' },
    { key: 'train_split', type: 'string', label: '训练 split', desc: '训练 split 名称，如 train', defaultValue: '' },
    { key: 'val_split', type: 'string', label: '验证 split', desc: '验证 split 名称，如 val', defaultValue: '' },
    { key: 'val_ratio', type: 'number', label: '验证集比例', desc: '未使用 split 时按比例随机切分验证集', defaultValue: 0.1, min: 0.01, max: 0.99, step: 0.01 },
    { key: 'target_dims', type: 'textarea', label: '评分维度', desc: '参与训练的评分维度，一行一个', defaultValue: 'aesthetic\ncomposition\ncolor\nsexual' },
  ]),
  sec('training-settings', 'training', '训练参数', '', [
    { key: 'batch_size', type: 'number', label: '批量大小', desc: '训练 batch size', defaultValue: 8, min: 1 },
    { key: 'num_workers', type: 'number', label: 'DataLoader Worker', desc: 'DataLoader worker 数', defaultValue: 4, min: 0 },
    { key: 'epochs', type: 'number', label: '训练轮数', desc: '训练轮数', defaultValue: 10, min: 1 },
    { key: 'learning_rate', type: 'string', label: '学习率', desc: '学习率', defaultValue: '3e-4' },
    { key: 'weight_decay', type: 'string', label: '权重衰减', desc: '权重衰减', defaultValue: '1e-4' },
    { key: 'loss', type: 'select', label: '损失函数', desc: '回归损失函数', defaultValue: 'mse', options: ['mse', 'smooth_l1'] },
    { key: 'cls_loss_weight', type: 'number', label: '分类损失权重', desc: 'in_domain 二分类损失权重', defaultValue: 1.0, min: 0, step: 0.1 },
    { key: 'cls_pos_weight', type: 'string', label: '正样本权重', desc: '分类正样本权重。留空不额外加权', defaultValue: '' },
    { key: 'seed', type: 'number', label: '随机种子', desc: '随机种子', defaultValue: 42 },
    { key: 'device', type: 'string', label: '设备', desc: 'cuda、cuda:0、cpu', defaultValue: 'cuda' },
  ]),
  sec('head-settings', 'network', '融合头设置', 'Fusion head 参数。', [
    { key: 'hidden_dims', type: 'string', label: '隐层维度', desc: 'Fusion head 隐层维度，逗号分隔', defaultValue: '1024,256' },
    { key: 'dropout', type: 'number', label: 'Dropout', desc: 'Fusion head dropout', defaultValue: 0.2, min: 0, max: 1, step: 0.01 },
    { key: 'freeze_extractors', type: 'boolean', label: '冻结提取器', desc: '冻结 JTP-3 与 Waifu CLIP 特征提取器', defaultValue: true },
    { key: 'include_waifu_score', type: 'boolean', label: '启用 Waifu 分支', desc: '启用 Waifu Scorer v3 额外分支特征', defaultValue: true },
  ]),
  sec('extractor-settings', 'advanced', '特征提取器设置', '', [
    { key: 'jtp3_model_id', type: 'string', label: 'JTP-3 模型 ID', desc: 'JTP-3 模型 ID 或本地目录', defaultValue: 'RedRocket/JTP-3' },
    { key: 'jtp3_fallback_model_id', type: 'string', label: 'JTP-3 回退模型', desc: 'JTP-3 加载失败时的回退模型 ID', defaultValue: '' },
    { key: 'hf_token_env', type: 'string', label: 'HF Token 环境变量', desc: '读取 HuggingFace Token 的环境变量名', defaultValue: 'HF_TOKEN' },
    { key: 'waifu_clip_model_name', type: 'string',label: 'Waifu CLIP 模型', desc: 'Waifu CLIP 模型名称', defaultValue: 'ViT-L-14' },
    { key: 'waifu_clip_pretrained', type: 'string', label: 'CLIP 预训练', desc: 'Waifu CLIP 预训练权重名称', defaultValue: 'openai' },
    { key: 'wv3_head_path', type: 'file', pickerType: 'model-file', label: 'Waifu v3 头部路径', desc: 'Waifu Scorer v3 头部权重路径。留空时自动尝试内置路径', defaultValue: '' },
  ]),
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
  'yolo':                   YOLO_SECTIONS,
  'aesthetic-scorer':       AESTHETIC_SCORER_SECTIONS,
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
  // 学习率字段虽然 schema type='string'（支持 1e-4 输入），但传给后端必须是数字
  const lrKeys = new Set(['learning_rate', 'unet_lr', 'text_encoder_lr', 'control_net_lr']);
  for (const s of getSectionsForType(tid)) {
    for (const f of s.fields) {
      if (f.type !== 'hidden' && !isFieldVisible(f, config)) continue;
      const v = config[f.key];
      if (f.type === 'boolean') { payload[f.key] = Boolean(v); continue; }
      if (f.type === 'number' || f.type === 'slider') {
        if (v === '' || v == null) continue;
        const p = Number(v); if (!Number.isNaN(p)) {
          // dropout 类参数：值为 0 时不写入，避免传无效参数给后端
          if (p === 0 && (f.key === 'network_dropout' || f.key === 'dropout')) continue;
          if (f.key === 'clip_skip' && p === 2) continue;  // clip_skip=2 是界面默认值，不发送（等同旧前端不传 clip_skip）
          payload[f.key] = p;
        } continue;
      }
      if (v === '' || v == null) continue;
      if (lrKeys.has(f.key)) {
        const n = Number(v);
        if (!Number.isNaN(n)) { payload[f.key] = n; continue; }
      }
      payload[f.key] = v;
    }
  }
  payload.model_train_type = tid;

  // ── Prodigy / 自适应优化器 optimizer_args 自动组装 ──
  // 旧前端会自动生成 optimizer_args = ["decouple=True", "weight_decay=0.01", ...]
  // 新前端需要在这里复现相同逻辑，否则 Prodigy 训练结果全是噪点
  if (payload.optimizer_type === 'Prodigy') {
    const optimArgs = [];
    optimArgs.push('decouple=True');
    optimArgs.push('weight_decay=0.01');
    optimArgs.push('use_bias_correction=True');
    const dCoef = String(payload.prodigy_d_coef || '2.0').trim();
    if (dCoef && dCoef !== '0') {
      optimArgs.push('d_coef=' + dCoef);
    }
    const d0 = String(payload.prodigy_d0 || '').trim();
    if (d0 && d0 !== '' && d0 !== '0') {
      optimArgs.push('d0=' + d0);
    }
    // 合并用户自定义 optimizer_args
    const customArgsRaw = String(payload.optimizer_args_custom || '').trim();
    if (customArgsRaw) {
      const customLines = customArgsRaw.split(/[\n\r]+/).map(s => s.trim()).filter(s => s && s.includes('='));
      // 用户自定义参数覆盖自动生成的同名参数
      const autoKeys = new Set(optimArgs.map(a => a.split('=')[0]));
      for (const line of customLines) {
        const key = line.split('=')[0];
        if (autoKeys.has(key)) {
          // 替换自动生成的
          const idx = optimArgs.findIndex(a => a.startsWith(key + '='));
          if (idx >= 0) optimArgs[idx] = line;
        } else {
          optimArgs.push(line);
        }
      }
    }
    payload.optimizer_args = optimArgs;
    delete payload.prodigy_d0;
    delete payload.prodigy_d_coef;
    delete payload.optimizer_args_custom;
  } else if (payload.optimizer_type && ['DAdaptation', 'DAdaptAdam', 'DAdaptLion'].includes(payload.optimizer_type)) {
    // DAdaptation 系列也需要 decouple
    const optimArgs = ['decouple=True'];
    const customArgsRaw = String(payload.optimizer_args_custom || '').trim();
    if (customArgsRaw) {
      const customLines = customArgsRaw.split(/[\n\r]+/).map(s => s.trim()).filter(s => s && s.includes('='));
      const autoKeys = new Set(optimArgs.map(a => a.split('=')[0]));
      for (const line of customLines) {
        const key = line.split('=')[0];
        if (autoKeys.has(key)) {
          const idx = optimArgs.findIndex(a => a.startsWith(key + '='));
          if (idx >= 0) optimArgs[idx] = line;
        } else {
          optimArgs.push(line);
        }
      }
    }
    payload.optimizer_args = optimArgs;
    delete payload.prodigy_d0;
    delete payload.prodigy_d_coef;
    delete payload.optimizer_args_custom;
  } else {
    // 非自适应优化器：如果有自定义 args 仍然传
    const customArgsRaw = String(payload.optimizer_args_custom || '').trim();
    if (customArgsRaw) {
      payload.optimizer_args = customArgsRaw.split(/[\n\r]+/).map(s => s.trim()).filter(s => s && s.includes('='));
    }
    delete payload.prodigy_d0;
    delete payload.prodigy_d_coef;
    delete payload.optimizer_args_custom;
  }

  // ── LyCORIS network_args 转换 ──
  // 后端 sd-scripts 要求 lycoris.kohya 的参数通过 network_args 数组传入，
  // 如 ["algo=locon", "conv_dim=16", ...]。UI 字段是独立的 key，需要在此组装。
  // Anima 类型由后端 apply_anima_ui_overrides 自行处理，这里跳过。
  if (payload.network_module === 'lycoris.kohya' && !tid.startsWith('anima')) {
    const networkArgs = [];
    const algo = String(payload.lycoris_algo || 'locon').trim().toLowerCase();
    networkArgs.push('algo=' + algo);

    if (payload.conv_dim != null && String(payload.conv_dim) !== '') {
      networkArgs.push('conv_dim=' + payload.conv_dim);
    }
    if (payload.conv_alpha != null && String(payload.conv_alpha) !== '') {
      networkArgs.push('conv_alpha=' + payload.conv_alpha);
    }
    if (payload.dropout != null && Number(payload.dropout) > 0) {
      networkArgs.push('dropout=' + payload.dropout);
    }
    if (payload.train_norm != null) {
      networkArgs.push('train_norm=' + (payload.train_norm ? 'True' : 'False'));
    }
    if (algo === 'lokr' && payload.lokr_factor != null) {
      networkArgs.push('factor=' + payload.lokr_factor);
    }
    if (payload.dora_wd) {
      networkArgs.push('dora_wd=True');
    }
    if (payload.scale_weight_norms != null && String(payload.scale_weight_norms) !== '') {
      networkArgs.push('scale_weight_norms=' + payload.scale_weight_norms);
    }

    payload.network_args = networkArgs;
    // 合并 network_args_custom
    const netArgsCustomRaw = String(payload.network_args_custom || '').trim();
    if (netArgsCustomRaw) {
      const customLines = netArgsCustomRaw.split(/[\n\r]+/).map(s => s.trim()).filter(s => s);
      payload.network_args.push(...customLines);
    }
    // 清理原始 UI 字段，避免 sd-scripts 不认识这些 key 报错或误用
    delete payload.lycoris_algo;
    delete payload.conv_dim;
    delete payload.conv_alpha;
    delete payload.dropout;
    delete payload.train_norm;
    delete payload.lokr_factor;
    delete payload.dora_wd;
    delete payload.network_dropout;  // 与 lycoris 不兼容，避免冲突
    delete payload.enable_base_weight;
    delete payload.network_args_custom;
  } else {
    // 非 LyCORIS: 处理 network_args_custom
    const netArgsCustomRaw = String(payload.network_args_custom || '').trim();
    if (netArgsCustomRaw) {
      const existingArgs = payload.network_args || [];
      const customLines = netArgsCustomRaw.split(/[\n\r]+/).map(s => s.trim()).filter(s => s);
      payload.network_args = [...existingArgs, ...customLines];
    }
    delete payload.network_args_custom;
  }

  // ── base_weights textarea → 数组 ──
  if (payload.enable_base_weight) {
    if (payload.base_weights && typeof payload.base_weights === 'string') {
      const lines = payload.base_weights.split(/[\n\r]+/).map(s => s.trim()).filter(s => s);
      payload.base_weights = lines.length > 0 ? lines : undefined;
    }

    if (payload.base_weights_multiplier && typeof payload.base_weights_multiplier === 'string') {
      const lines = payload.base_weights_multiplier.split(/[\n\r]+/).map(s => s.trim()).filter(s => s);
      payload.base_weights_multiplier = lines.length > 0 ? lines.map(Number).filter(n => !Number.isNaN(n)) : undefined;
    }
  } else {
    delete payload.base_weights;
    delete payload.base_weights_multiplier;
  }
  delete payload.enable_base_weight;

  // ── lr_scheduler_args textarea → 数组 ──
  if (payload.lr_scheduler_args && typeof payload.lr_scheduler_args === 'string') {
    const lines = payload.lr_scheduler_args.split(/[\n\r]+/).map(s => s.trim()).filter(s => s && s.includes('='));
    payload.lr_scheduler_args = lines.length > 0 ? lines : undefined;
    if (!payload.lr_scheduler_args) delete payload.lr_scheduler_args;
  }

  // ── lr_scheduler_type 空值清理 ──
  if (!payload.lr_scheduler_type || !payload.lr_scheduler_type.trim()) delete payload.lr_scheduler_type;
  // ── huber_schedule 空值清理 ──

  if (payload.huber_schedule === '') delete payload.huber_schedule;

  return payload;
}
