import { when } from './schemaCommon.js';

// 两件"只影响训练、不进产物"的事：
//   · 训练适配器：训练前向额外挂一份冻结容量，预览与导出都强制失效。
//   · Context LoRA：本次训练的 LoRA 必须搭配某个外部基座使用，基座冻结、权重
//     不进产物，只把"要搭配谁、多大强度"写进导出元数据。
// 两者都是默认关；关闭时不构造任何宿主，原有前向与导出逐位不变。
const adapterOn = when('training_adapter_enabled', true);
const contextOn = when('context_lora_enabled', true);

const section = {
  id: 'adapter-scaffolds',
  tab: 'network',
  title: '训练脚手架与基座 LoRA',
  description: '这两项都不进导出文件。训练适配器提供训练期的额外冻结容量，预览与导出时强制关掉；Context LoRA 指定一个冻结的外部基座，训练与预览都保持它生效，并在产物元数据里写明需要搭配谁。',
  fields: [
    {
      key: 'training_adapter_enabled', type: 'boolean', label: '启用训练适配器',
      title: 'training_adapter_enabled',
      desc: '在每个标准 LoRA 模块上挂一条独立的零初始化分支，只在训练前向激活。默认关闭。',
      defaultValue: false,
    },
    {
      key: 'training_adapter_id', type: 'string', label: '适配器标识', title: 'training_adapter_id',
      desc: '留空使用默认标识。同名适配器不能重复注册。',
      defaultValue: '', visibleWhen: adapterOn,
    },
    {
      key: 'training_adapter_rank', type: 'number', label: '适配器 rank',
      title: 'training_adapter_rank',
      desc: '训练脚手架的容量；与主 LoRA 的 rank 无关。',
      defaultValue: 8, min: 1, step: 1, visibleWhen: adapterOn,
    },
    {
      key: 'training_adapter_alpha', type: 'number', label: '适配器 alpha',
      title: 'training_adapter_alpha',
      desc: '留空按 rank 取值（LoRA 常见约定）。',
      defaultValue: '', min: 0, step: 1, visibleWhen: adapterOn,
    },
    {
      key: 'context_lora_enabled', type: 'boolean', label: '启用 Context LoRA',
      title: 'context_lora_enabled',
      desc: '开启后本次产物是"挂在某基座上的 LoRA"。默认关闭。',
      defaultValue: false,
    },
    {
      key: 'context_lora_path', type: 'file', label: '基座 LoRA 路径', title: 'context_lora_path',
      desc: '外部基座 .safetensors。开启后必填：留空会直接报错，不会退化成"没有基座"。',
      defaultValue: '', visibleWhen: contextOn,
    },
    {
      key: 'context_lora_strength', type: 'number', label: '基座强度', title: 'context_lora_strength',
      desc: '训练与预览都按这个强度叠加基座，取值 0..2。',
      defaultValue: 1.0, min: 0, max: 2, step: 0.05, visibleWhen: contextOn,
    },
    {
      key: 'context_lora_adapter_id', type: 'string', label: '基座标识', title: 'context_lora_adapter_id',
      desc: '写进元数据，加载方据此区分是哪个基座。留空使用默认标识。',
      defaultValue: 'context_base', visibleWhen: contextOn,
    },
    {
      key: 'context_lora_freeze', type: 'boolean', label: '冻结基座权重',
      title: 'context_lora_freeze',
      desc: '保持开启。关掉会让优化器试着更新基座，而基座权重本来就不在产物里，训练结束就丢了。',
      defaultValue: true, visibleWhen: contextOn,
    },
  ],
};

// 需要注入点才谈得上挂分支：没有网络设置的家族不出现这一节。
export function withAdapterScaffolds(sections) {
  if (sections.some((item) => item.id === section.id)) return sections;
  const index = sections.findIndex((item) => item.id === 'network-settings');
  if (index < 0) return sections;
  return [...sections.slice(0, index + 1), section, ...sections.slice(index + 1)];
}
