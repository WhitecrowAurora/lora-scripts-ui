// Universal DiT is an independent experimental contract surface. It is not a
// fallback switch on known model pages: callers must select this training type
// and provide the model/batch/objective/forward contracts explicitly.
import { sec } from './schemaCommon.js';
import { S_LR_DIT, S_SAVE, S_TRAIN, S_SYSTEM_ENV } from './schemaFieldGroups.js';

const passthroughSaveFields = S_SAVE.filter((field) => [
  'output_name', 'output_dir', 'save_model_as', 'save_precision',
  'save_every_n_epochs', 'save_every_n_steps', 'save_state',
  'save_state_on_train_end', 'log_with', 'logging_dir',
].includes(field.key));

const basicTrainingFields = S_TRAIN(10).filter((field) => [
  'train_length_mode', 'max_train_epochs', 'max_train_steps',
  'train_batch_size', 'gradient_checkpointing', 'gradient_accumulation_steps',
  'gradient_accumulation_mode',
].includes(field.key));

export const S_UNIVERSAL_DIT = [
  {
    key: 'universal_dit_probe_mode', type: 'select', label: '结构探测模式',
    desc: 'static 只检查结构；forward/train_smoke 还要求 probe JSON 能构造模型 forward 所需的全部输入。',
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: 'Auto（按证据逐步探测）' },
      { value: 'static', label: '仅静态结构' },
      { value: 'forward', label: '结构 + Forward' },
      { value: 'train_smoke', label: '结构 + Forward + Backward' },
    ],
  },
  {
    key: 'universal_dit_objective_template', type: 'select', label: '训练 Objective 契约',
    desc: '必须与外部模型真实训练目标一致。Auto 在证据不足时会显式失败，不会按类名猜测。',
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: 'Auto（证据不足时拒绝训练）' },
      { value: 'epsilon', label: 'Epsilon prediction' },
      { value: 'v_prediction', label: 'V prediction' },
      { value: 'x0', label: 'X0 prediction' },
      { value: 'flow_matching', label: 'Flow matching' },
      { value: 'rectified_flow', label: 'Rectified flow' },
      { value: 'velocity', label: 'Velocity prediction' },
      { value: 'custom', label: 'Custom objective' },
    ],
  },
  {
    key: 'universal_dit_target_policy', type: 'select', label: 'Linear Target 策略',
    desc: 'attention_mlp 只选注意力/MLP；all_linear 扩大到全部 Linear；explicit 使用严格路径白名单。',
    defaultValue: 'attention_mlp',
    options: [
      { value: 'attention_mlp', label: 'Attention + MLP' },
      { value: 'all_linear', label: '全部 Linear' },
      { value: 'explicit', label: '显式路径白名单' },
    ],
  },
  {
    key: 'universal_dit_allow_fused_qkv', type: 'boolean', label: '允许 fused QKV 整层注入',
    desc: '仅当模型确实用单个 Linear 承载融合 QKV 时开启；不会拆分 q/k/v slice adapter。',
    defaultValue: false,
  },
  {
    key: 'universal_dit_target_modules_json', type: 'textarea', label: '显式 Target 路径 JSON',
    desc: 'explicit 策略必填。路径必须精确存在且是 nn.Linear。',
    defaultValue: '', placeholder: '["blocks.0.attn.to_q"]',
    visibleWhen: (config) => config.universal_dit_target_policy === 'explicit',
  },
  {
    key: 'universal_dit_probe_inputs_json', type: 'textarea', label: 'Forward 输入契约 JSON',
    desc: '描述模型 forward kwargs 的 shape/dtype/value，不执行任意代码。forward/train_smoke 模式必须覆盖模型要求的全部参数。',
    defaultValue: '',
    placeholder: '{"kwargs":{"hidden_states":{"shape":[1,4,8,8]},"timestep":{"shape":[1],"dtype":"int64","value":1}}}',
    visibleWhen: (config) => config.universal_dit_probe_mode !== 'static',
  },
  {
    key: 'universal_dit_forward_mapping_json', type: 'textarea', label: 'Forward 参数映射 JSON（高级）',
    desc: '仅在 cache tensor 与 forward 参数无法唯一匹配时填写。映射冲突或 required 参数无来源会在训练前失败。',
    defaultValue: '',
    placeholder: '{"encoder_hidden_states":{"kind":"cache_tensor","source":"context"}}',
  },
  {
    key: 'universal_dit_output_selector_json', type: 'textarea', label: '模型输出选择 JSON（高级）',
    desc: '多 Tensor 输出必须指定 mapping key、attribute 或 tuple index；运行时不会取第一个 Tensor 猜测。',
    defaultValue: '',
    placeholder: '{"kind":"mapping_key","key":"sample"}',
  },
];

export const UNIVERSAL_DIT_SECTIONS = [
  sec('universal-model', 'model', '高级自定义 DiT（实验）',
    '仅接受带 config 元数据、可由 diffusers/transformers AutoModel 构造的模型目录。未知单文件权重无法安全推断结构，因此不支持；不会自动装配 VAE、文本编码器或 conditioning。', [
      { key: 'model_train_type', type: 'hidden', defaultValue: 'universal-dit-lora' },
      { key: 'universal_dit_enabled', type: 'hidden', defaultValue: true },
      { key: 'pretrained_model_name_or_path', type: 'folder', pickerType: 'folder', label: '自定义 DiT 模型目录', desc: '目录必须包含模型 config；不要选择裸 .safetensors/.ckpt 权重。', defaultValue: '' },
      { key: 'universal_dit_allow_remote_download', type: 'boolean', label: '允许远程模型下载', desc: '默认仅解析本地目录。开启后可解析远程仓库标识。', defaultValue: false },
      { key: 'universal_dit_trust_remote_code', type: 'boolean', label: '信任模型自定义代码', desc: '仅对来源可信且已审查的模型启用。', defaultValue: false },
    ]),
  sec('universal-data', 'dataset', '预计算训练张量',
    '本路线不读取图片、不编码 latent、不编码文本。目录内应是 .npz/.npy/.pt/.safetensors 张量容器，至少含 latents，并提供 objective/forward 所需的其它张量。', [
      { key: 'train_data_dir', type: 'folder', pickerType: 'folder', label: '预计算张量目录', defaultValue: '' },
      { key: 'use_cache', type: 'hidden', defaultValue: true },
    ]),
  sec('universal-contract', 'training', 'Batch / Objective / Forward 契约',
    '这是用户提供的外部模型契约面；Lulynx 只做结构探测、张量回放、objective bridge 与 LoRA 注入，不猜测 conditioning。', [
      ...S_UNIVERSAL_DIT,
    ]),
  sec('universal-network', 'network', 'LoRA 注入', '仅支持现有 Universal DiT 标准 LoRA 路线。', [
      { key: 'network_module', type: 'hidden', defaultValue: 'networks.lora' },
      { key: 'network_dim', type: 'slider', label: 'LoRA Rank', defaultValue: 16, min: 1, max: 256, step: 1 },
      { key: 'network_alpha', type: 'slider', label: 'LoRA Alpha', defaultValue: 16, min: 1, max: 256, step: 1 },
      { key: 'network_dropout', type: 'number', label: 'LoRA Dropout', defaultValue: 0, min: 0, max: 1, step: 0.01 },
    ]),
  sec('universal-optimizer', 'optimizer', '优化器与学习率', '', [...S_LR_DIT]),
  sec('universal-training', 'training', '训练长度与批量', '', basicTrainingFields),
  sec('universal-save', 'model', '保存与日志', '', passthroughSaveFields),
  // 这一段在 NEXT/V2 两个分叉的同名类型上本来就有,只有本分叉缺 ⇒ 补上同时消掉这处分叉漂移。
  // 注意与 advanced:universal-dit-settings 无关:那是 fallback 的 universal_dit_* 九个字段。
  sec('system-settings', 'advanced', '系统设置', '执行环境 Profile、指定显卡与自定义 TOML 覆盖。', [...S_SYSTEM_ENV]),
];
