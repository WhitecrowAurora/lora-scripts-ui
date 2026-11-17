// renderers/tools.js — 工具箱页面（LoRA 提取/合并/缩放等脚本入口）
// 依赖（工厂注入）：state、$、escapeHtml、renderSlot
// 注意：onclick="runTool(...)" 仍依赖 window.runTool（main.js 保留）

import { $, escapeHtml } from '../utils/dom.js';
import { createToolTemplates } from './toolsTemplates.js';

export function createToolsRenderer({ state, renderSlot }) {
  const PRUNER_BLOCKS = ['TE1', 'TE2', 'IN00', 'IN01', 'IN02', 'IN03', 'IN04', 'IN05', 'IN06', 'IN07', 'IN08', 'M00', 'OUT00', 'OUT01', 'OUT02', 'OUT03', 'OUT04', 'OUT05', 'OUT06', 'OUT07', 'OUT08'];
  const PRUNER_GROUPS = [
    { label: 'TE', blocks: ['TE1', 'TE2'] },
    { label: 'IN', blocks: ['IN00', 'IN01', 'IN02', 'IN03', 'IN04', 'IN05', 'IN06', 'IN07', 'IN08'] },
    { label: 'MID', blocks: ['M00'] },
    { label: 'OUT', blocks: ['OUT00', 'OUT01', 'OUT02', 'OUT03', 'OUT04', 'OUT05', 'OUT06', 'OUT07', 'OUT08'] },
  ];
  const { renderToolCard, renderToolChip, renderToolWelcome, renderToolDetail } = createToolTemplates({
    escapeHtml,
    prunerGroups: PRUNER_GROUPS,
  });

  function renderTools(container) {
    const tools = [
      {
        id: 'core_lora_analyze',
        title: 'LoRA Analyzer / XRay',
        desc: 'OUT',
        group: 'LoRA XRay',
        icon: '🔎',
        endpoint: '/api/tools/lora/analyze',
        fields: [
          { key: 'file_path', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
        ],
      },
      {
        id: 'core_lora_block_analyze',
        title: 'LoRA Block XRay',
        desc: '按 IN/MID/OUT/TE 区块统计 LoRA 作用强度',
        group: 'LoRA XRay',
        icon: '📊',
        endpoint: '/api/tools/lora/block-analyze',
        fields: [
          { key: 'path', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
        ],
      },
      {
        id: 'core_lora_prune',
        title: 'LoRA Pruner',
        desc: 'LoRA 文件路径',
        group: 'LoRA XRay',
        icon: '✂',
        endpoint: '/api/tools/lora/prune',
        fields: [
          { key: 'path', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/my_lora_pruned.safetensors' },
          { key: 'keep_blocks', label: '保留区块（逗号分隔）', type: 'text', placeholder: 'IN00,IN01,M00,OUT08' },
          { key: 'drop_blocks', label: '移除区块（逗号分隔）', type: 'text', placeholder: 'TE1,TE2' },
        ],
        presets: [
          { name: '保留角色', keep: 'TE1,TE2,IN00,IN01,IN02,IN03,IN04,IN05,IN06,IN07,IN08,M00,OUT00,OUT01,OUT02', drop: '' },
          { name: '保留风格', keep: 'M00,OUT03,OUT04,OUT05,OUT06,OUT07,OUT08', drop: '' },
          { name: '只留输出', keep: 'OUT04,OUT05,OUT06,OUT07,OUT08', drop: '' },
          { name: '全保留', keep: 'TE1,TE2,IN00,IN01,IN02,IN03,IN04,IN05,IN06,IN07,IN08,M00,OUT00,OUT01,OUT02,OUT03,OUT04,OUT05,OUT06,OUT07,OUT08', drop: '' },
          { name: '清空', keep: '', drop: '' },
        ],
      },
      {
        id: 'core_lora_svd_merge',
        title: 'LoRA SVD Merger',
        desc: '把两个 LoRA 重建到 dense delta 后按比例融合',
        group: 'LoRA Surgery',
        icon: '🧬',
        endpoint: '/api/merger/merge-lora',
        fields: [
          { key: 'model_a', label: 'LoRA A 路径', type: 'text', placeholder: './output/a.safetensors' },
          { key: 'model_b', label: 'LoRA B 路径', type: 'text', placeholder: './output/b.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/merged_svd.safetensors' },
          { key: 'ratio', label: 'A 权重比例', type: 'number', placeholder: '0.5' },
          { key: 'rank', label: '目标 Rank', type: 'number', placeholder: '128' },
        ],
      },
      {
        id: 'core_lora_extract',
        title: 'LoRA Extractor',
        desc: '从底模和微调模型的差分中提取 LoRA。',
        group: 'LoRA Surgery',
        icon: '🧲',
        endpoint: '/api/merger/extract',
        fields: [
          { key: 'base_model', label: '底模路径', type: 'text', placeholder: './models/base.safetensors' },
          { key: 'finetuned_model', label: '微调模型路径', type: 'text', placeholder: './models/tuned.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/extracted.safetensors' },
          { key: 'rank', label: 'Rank', type: 'number', placeholder: '32' },
        ],
      },
      {
        id: 'core_diagnostic_card',
        title: 'Diagnostic Card',
        desc: '生成训练/LoRA 诊断分享卡',
        group: 'Reports',
        icon: '▣',
        endpoint: '/api/tools/diagnostic-card',
        fields: [
          { key: 'model_name', label: '模型/LoRA 名称', type: 'text', placeholder: 'my_lora_v1' },
          { key: 'health_score', label: '健康分数 0-100', type: 'number', placeholder: '85' },
          { key: 'issues', label: '问题列表（逗号分隔）', type: 'text', placeholder: 'OUT08 RMS偏高,TE1 很弱' },
        ],
      },
      {
        id: 'core_qpissa_convert',
        title: 'QPiSSA Converter',
        desc: '手动把模型中的 2D 主体权重拆成 residual',
        group: 'Advanced',
        icon: 'Σ',
        endpoint: '/api/tools/qpissa/convert',
        fields: [
          { key: 'model_path', label: '模型路径', type: 'text', placeholder: './models/model.safetensors' },
          { key: 'output_dir', label: '输出目录', type: 'text', placeholder: './output/qpissa' },
          { key: 'rank', label: 'Rank', type: 'number', placeholder: '16' },
          { key: 'layers_pattern', label: '层名正则（可选）', type: 'text', placeholder: 'attn|mlp|proj' },
          { key: 'precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'core_model_merge',
        title: 'Model Merger',
        desc: '保存精度',
        group: 'Model Tools',
        icon: '⇄',
        endpoint: '/api/tools/model/merge',
        fields: [
          { key: 'model_a', label: '模型 A 路径', type: 'text', placeholder: './models/a.safetensors' },
          { key: 'model_b', label: '模型 B 路径', type: 'text', placeholder: './models/b.safetensors' },
          { key: 'model_c', label: '模型 C 路径（add_difference 用）', type: 'text', placeholder: './models/base.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/merged_model.safetensors' },
          { key: 'alpha', label: 'Alpha', type: 'number', placeholder: '0.5' },
          { key: 'method', label: '方法', type: 'text', placeholder: 'weighted_sum' },
          { key: 'precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'core_model_tensor_convert',
        title: 'Model Converter',
        desc: '在 safetensors 与 PyTorch pt/pth',
        group: 'Model Tools',
        icon: '⇆',
        endpoint: '/api/tools/model/convert-tensors',
        fields: [
          { key: 'input_path', label: '输入路径', type: 'text', placeholder: './models/model.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/model.pt' },
          { key: 'output_format', label: '输出格式', type: 'text', placeholder: 'pt' },
        ],
      },
      {
        id: 'core_diffusers_convert',
        title: 'Checkpoint 转 Diffusers',
        desc: '手动把单文件 checkpoint/safetensors 转成',
        group: 'Model Tools',
        icon: '◫',
        endpoint: '/api/tools/model/convert-diffusers',
        fields: [
          { key: 'checkpoint_path', label: 'Checkpoint 路径', type: 'text', placeholder: './models/model.safetensors' },
          { key: 'output_dir', label: '输出目录', type: 'text', placeholder: './output/diffusers_model' },
          { key: 'model_type', label: '模型类型', type: 'text', placeholder: 'sdxl' },
          { key: 'half', label: '半精度 true/false', type: 'text', placeholder: 'true' },
        ],
      },
      {
        id: 'core_xyz_plot',
        title: 'XYZ Plot',
        desc: '手动生成推理参数网格图。会加载模型，建议先用小尺寸和少步数测试。',
        group: 'Reports',
        icon: '▦',
        endpoint: '/api/tools/xyz-plot/generate',
        fields: [
          { key: 'model_path', label: '模型路径/目录', type: 'text', placeholder: './models/model.safetensors' },
          { key: 'output_path', label: '输出图片路径', type: 'text', placeholder: './output/xyz_plot.png' },
          { key: 'model_type', label: '模型类型', type: 'text', placeholder: 'sdxl' },
          { key: 'base_params', label: '基础参数 JSON', type: 'text', placeholder: '{"prompt":"1girl","steps":8,"cfg":7,"width":512,"height":512,"seed":42}' },
          { key: 'x_axis', label: 'X 轴 JSON', type: 'text', placeholder: '{"name":"cfg","values":[5,7,9]}' },
          { key: 'y_axis', label: 'Y 轴 JSON（可选）', type: 'text', placeholder: '{"name":"steps","values":[8,12]}' },
          { key: 'save_cells', label: '保存单元原图与参数 true/false（可选）', type: 'text', placeholder: 'false' },
        ],
      },
      {
        id: 'core_lora_block_energy',
        title: 'Block Energy',
        desc: 'CPU 只读分析 LoRA 能量与谱集中度。可添加后续保存点比较变化趋势；填底模可比较更新强度，指定模块可对照谱方向，大层可能耗时较长。',
        group: 'Block Studio',
        icon: '📶',
        endpoint: '/api/tools/lora/block-energy',
        fields: [
          { key: 'file_path', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'checkpoint_paths', label: '后续保存点（可选，每行一个路径，按时间先后；首点使用上方文件）', type: 'textarea', placeholder: './output/step-200.safetensors\n./output/step-400.safetensors' },
          { key: 'family', label: '家族（sdxl/sd15/anima/flux/krea2/qwen_image/qwen_image_2/moss_image/wan22/ltx23）', type: 'text', placeholder: 'sdxl' },
          { key: 'base_model_path', label: '底模（可选，非量化 safetensors 文件、索引或含唯一索引的组件目录）', type: 'text', placeholder: './models/transformer 或 ./models/base.safetensors' },
          { key: 'diagnostic_module', label: '完整模块名（可选；趋势仅分析此层，提供底模后同时计算谱方向）', type: 'text', placeholder: '从报告 JSON 的 modules 中复制模块名' },
          { key: 'spectral_top_k', label: '检查前 k 个方向（默认 16）', type: 'number', placeholder: '16' },
          { key: 'intrusion_threshold', label: '入侵方向余弦阈值（默认 0.5；不代表画质阈值）', type: 'number', placeholder: '0.5' },
          { key: 'base_key_map', label: '底模键映射（可选；指定来源键，已知 QKV 布局自动切片）', type: 'text', placeholder: '{"LoRA模块名":"底模完整.weight键"}' },
        ],
      },
      {
        id: 'core_lora_block_advice',
        title: 'Block Advice',
        desc: '把能量报告翻成逐 block 的滑块建议：死块归零、过重块压到 0.7。',
        group: 'Block Studio',
        icon: '🎚',
        endpoint: '/api/tools/lora/block-advice',
        fields: [
          { key: 'file_path', label: 'LoRA 文件路径（与下方报告二选一）', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'family', label: '家族', type: 'text', placeholder: 'sdxl' },
          { key: 'energy_report', label: '能量报告 JSON（可选，贴 Block Energy 的结果）', type: 'text', placeholder: '{"blocks":[...]}' },
          { key: 'dead_share', label: '死块阈值（能量占比）', type: 'number', placeholder: '0.0001' },
          { key: 'hot_ratio', label: '过热倍数（相对中位数）', type: 'number', placeholder: '2.5' },
        ],
      },
      {
        id: 'core_lora_block_bake',
        title: 'Block Bake',
        desc: '把两个 LoRA 按 block 权重精确烘焙成一个：rank 拼接，不是 SVD 近似。',
        group: 'Block Studio',
        icon: '⧉',
        endpoint: '/api/tools/lora/block-bake',
        fields: [
          { key: 'lora_a_path', label: 'LoRA A 路径', type: 'text', placeholder: './output/a.safetensors' },
          { key: 'lora_b_path', label: 'LoRA B 路径', type: 'text', placeholder: './output/b.safetensors' },
          { key: 'output_path', label: '输出路径', type: 'text', placeholder: './output/baked.safetensors' },
          { key: 'family', label: '家族', type: 'text', placeholder: 'sdxl' },
          { key: 'scales_a', label: 'A 的 block 权重 JSON（可选）', type: 'text', placeholder: '{"in.04":0.7,"out.08":0.0}' },
          { key: 'scales_b', label: 'B 的 block 权重 JSON（可选）', type: 'text', placeholder: '{"in.04":1.0}' },
        ],
      },
      {
        id: 'core_lora_render_preview',
        title: 'Block Render',
        desc: '按 block 权重渲染一张图：所见即烘焙后所得。会加载模型，别和训练同时跑。',
        group: 'Block Studio',
        icon: '🖼',
        endpoint: '/api/tools/lora/render-preview',
        fields: [
          { key: 'lora_path', label: 'LoRA 路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'model_path', label: '基座模型路径', type: 'text', placeholder: './models/sd_xl_base_1.0.safetensors' },
          { key: 'model_arch', label: '架构', type: 'text', placeholder: 'sdxl' },
          { key: 'block_scales', label: 'block 权重 JSON', type: 'text', placeholder: '{"in.04":0.7,"out.08":0.0}' },
          { key: 'prompt', label: '提示词', type: 'text', placeholder: 'a portrait photo' },
          { key: 'negative_prompt', label: '反向提示词', type: 'text', placeholder: '' },
          { key: 'steps', label: '步数', type: 'number', placeholder: '20' },
          { key: 'guidance_scale', label: 'CFG', type: 'number', placeholder: '4' },
          { key: 'output_dir', label: '输出目录', type: 'text', placeholder: './output/renders' },
        ],
      },
      {
        id: 'core_lora_render_distilled',
        title: 'Distilled Render',
        desc: '用少步数蒸馏基座出预览。不可与训练模型预览直接比较时会在结果里标出来。',
        group: 'Block Studio',
        icon: '⚡',
        endpoint: '/api/tools/lora/render-distilled',
        fields: [
          { key: 'lora_path', label: 'LoRA 路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'model_path', label: '蒸馏基座路径', type: 'text', placeholder: './models/distilled.safetensors' },
          { key: 'model_arch', label: '架构', type: 'text', placeholder: 'sdxl' },
          { key: 'prompt', label: '提示词', type: 'text', placeholder: 'a portrait photo' },
          { key: 'steps', label: '步数（1-8）', type: 'number', placeholder: '4' },
          { key: 'output_dir', label: '输出目录', type: 'text', placeholder: './output/renders' },
        ],
      },
      {
        id: 'extract_lora',
        title: '从模型提取 LoRA',
        desc: '从两个模型的差异中提取 LoRA 网络权重。',
        script: 'networks/extract_lora_from_models.py',
        fields: [
          { key: 'model_org', label: '原始模型路径', type: 'text', placeholder: './sd-models/original.safetensors' },
          { key: 'model_tuned', label: '微调模型路径', type: 'text', placeholder: './sd-models/finetuned.safetensors' },
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/extracted.safetensors' },
          { key: 'dim', label: '网络维度 (dim)', type: 'number', placeholder: '32' },
        ],
      },
      {
        id: 'extract_dylora',
        title: '从 DyLoRA 提取 LoRA',
        desc: '从 DyLoRA 模型中提取指定维度的 LoRA 权重。',
        script: 'networks/extract_lora_from_dylora.py',
        fields: [
          { key: 'model', label: 'DyLoRA 模型路径', type: 'text', placeholder: './output/dylora.safetensors' },
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/extracted.safetensors' },
        { key: 'unit', label: '提取维度 (unit)', type: 'number', placeholder: '4' },
        ],
      },
      {
        id: 'merge_lora',
        title: '合并 LoRA',
        desc: '将多个 LoRA 按指定权重合并为一个。',
        script: 'networks/merge_lora.py',
        fields: [
       { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged.safetensors' },
          { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
          { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
          { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'sdxl_merge_lora',
        title: 'SDXL 合并 LoRA',
        desc: 'SDXL 专用的 LoRA 合并工具。',
        script: 'networks/sdxl_merge_lora.py',
        fields: [
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged_sdxl.safetensors' },
          { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors ./output/b.safetensors' },
          { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
          { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'flux_merge_lora',
        title: 'FLUX 合并 LoRA',
        desc: 'FLUX 专用的 LoRA 合并工具。',
        script: 'networks/flux_merge_lora.py',
        fields: [
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/merged_flux.safetensors' },
          { key: 'models', label: 'LoRA 路径（空格分隔）', type: 'text', placeholder: './output/a.safetensors./output/b.safetensors' },
          { key: 'ratios', label: '合并权重（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
          { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
  id: 'flux_extract_lora',
        title: 'FLUX 提取 LoRA',
        desc: '从 FLUX 模型差异中提取 LoRA。',
        script: 'networks/flux_extract_lora.py',
        fields: [
          { key: 'model_org', label: '原始模型路径', type: 'text', placeholder: '' },
          { key: 'model_tuned', label: '微调模型路径', type: 'text', placeholder: '' },
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/flux_extracted.safetensors' },
          { key: 'dim', label: '网络维度', type: 'number', placeholder: '16' },
],
      },
      {
        id: 'resize_lora',
        title:'LoRA 缩放 (Resize)',
        desc: '将 LoRA权重缩放到不同的 dim / rank。',
        script: 'networks/resize_lora.py',
        fields: [
          { key: 'model', label: 'LoRA 模型路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/resized.safetensors' },
          { key: 'new_rank', label: '目标 Rank', type: 'number', placeholder: '16' },
          { key: 'save_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'check_lora_weights',
     title: '检查 LoRA 权重',
        desc: '查看 LoRA 文件的权重统计信息。',
        script: 'networks/check_lora_weights.py',
        fields: [
          { key: 'file', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
   ],
      },
      {
        id: 'convert_flux_lora',
        title: '转换 FLUX LoRA 格式',
        desc: '在 ai-toolkit 和 sd-scripts',
        script: 'networks/convert_flux_lora.py',
        fields: [
          { key: 'src_path', label: '源文件路径',type: 'text', placeholder: './output/source_lora.safetensors' },
          { key: 'dst_path', label: '输出路径', type: 'text', placeholder: './output/converted.safetensors' },
          {key: 'src', label: '源格式', type: 'text', placeholder: 'ai-toolkit' },
          { key: 'dst', label: '目标格式', type: 'text', placeholder: 'sd-scripts' },
   ],
      },

      {
        id: 'convert_hunyuan_lora',
        title: '转换混元图像 LoRA 到 ComfyUI',
        desc: '将混元图像 LoRA转换为 ComfyUI 可用格式。',
        script: 'networks/convert_hunyuan_image_lora_to_comfy.py',
        fields: [
          { key: 'src_path', label: '源文件路径', type: 'text', placeholder: './output/hunyuan_lora.safetensors' },
          { key: 'dst_path', label: '输出路径', type: 'text', placeholder: './output/hunyuan_comfy.safetensors' },
        ],
      },
    {
     id: 'convert_anima_lora',
        title: '转换 Anima LoRA 到 ComfyUI',
        desc: '将 Anima LoRA 转换为 ComfyUI 可用格式。',
        script: 'networks/convert_anima_lora_to_comfy.py',
        fields: [
          { key: 'src_path', label: '源文件路径', type: 'text', placeholder: '' },
          { key: 'dst_path', label: '输出路径', type: 'text', placeholder: '' },
        ],
      },
      {
        id: 'show_metadata',
        title: '查看模型元数据',
        desc: '显示 safetensors/ckpt 文件的元数据信息。',
        script: 'tools/show_metadata.py',
        fields: [
          { key: 'model', label: '模型文件路径', type: 'text', placeholder: './output/model.safetensors' },
        ],
      },
      {
        id: 'merge_models',
        title: '合并模型',
        desc: '按指定比例合并多个 Stable Diffusion',
        script: 'tools/merge_models.py',
        fields: [
          { key: 'models', label: '模型路径（空格分隔）', type: 'text', placeholder: './sd-models/a.safetensors ./sd-models/b.safetensors' },
          { key: 'output', label: '输出路径', type: 'text', placeholder: './output/merged_model.safetensors' },
          { key: 'ratios', label: '合并比例（空格分隔）', type: 'text', placeholder: '0.5 0.5' },
          { key: 'saving_precision', label: '保存精度', type: 'text', placeholder: 'fp16' },
        ],
      },
      {
        id: 'convert_diffusers_to_flux',
        title: 'Diffusers 转 FLUX',
        desc: '将 Diffusers 格式转换为 FLUX 格式。',
        script: 'tools/convert_diffusers_to_flux.py',
        fields: [
          { key: 'diffusers_path', label: 'Diffusers 模型文件夹路径', type: 'text', placeholder: '' },
          { key: 'save_to', label: '输出路径', type: 'text', placeholder: './output/flux_converted.safetensors' },
        ],
      },
      {
        id: 'lora_interrogator',
        title: 'LoRA 识别器',
        desc: '检测 LoRA 网络的训练信息',
        script: 'networks/lora_interrogator.py',
        fields: [
          { key: 'sd_model', label: '基础 SD 1.5模型路径', type: 'text', placeholder: './sd-models/sd15_model.safetensors' },
          { key: 'model', label: 'LoRA 文件路径', type: 'text', placeholder: './output/my_lora.safetensors' },
          { key: 'v2', label: 'SD 2.x 模型', type: 'checkbox' },
          { key: 'clip_skip', label: 'CLIP Skip', type: 'number', placeholder: '' },
        ],
      },

    ];


    const selectedId = state.selectedTool || '';
    const selectedTool = tools.find((t) => t.id === selectedId);
    const coreTools = tools.filter((t) => t.endpoint);
    const legacyTools = tools.filter((t) => !t.endpoint);
    const groups = Array.from(new Set(coreTools.map((t) => t.group || 'Tools')));

    container.innerHTML = `
      <div class="form-container toolbox-shell">
        <header class="toolbox-hero">
          <div>
            <span class="toolbox-kicker">Lulynx Toolbox</span>
            <h2>LoRA / 模型工具箱</h2>
            <p>从 REapp 工具台迁入的分析、剪枝、合并、转换和诊断工具。所有动作都需要手动运行，不会自动进入训练主链。</p>
          </div>
          <div class="toolbox-hero-stats">
            <div><strong>${coreTools.length}</strong><span>核心工具</span></div>
            <div><strong>${groups.length}</strong><span>工具分组</span></div>
          </div>
        </header>

        <div class="toolbox-layout">
          <aside class="toolbox-sidebar">
            ${groups.map((group) => `
              <section class="toolbox-group">
                <h3>${escapeHtml(group)}</h3>
                <div class="toolbox-card-grid">
                  ${coreTools.filter((t) => (t.group || 'Tools') === group).map((t) => renderToolCard(t, t.id === selectedId)).join('')}
                </div>
              </section>
            `).join('')}

            <details class="toolbox-legacy">
              <summary>旧脚本工具</summary>
              <select id="tool-selector">
                <option value="">选择旧脚本工具</option>
                ${legacyTools.map((t) => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
              </select>
            </details>
          </aside>

          <main id="tool-detail" class="toolbox-main">
            ${selectedTool ? renderToolDetail(selectedTool) : renderToolWelcome(coreTools)}
          </main>
        </div>
        ${renderSlot('tools.entry')}
      </div>
    `;

    $('#tool-selector')?.addEventListener('change', (e) => {
      state.selectedTool = e.target.value;
      const detail =$('#tool-detail');
      const tool = tools.find((t) => t.id === e.target.value);
      if (detail) {
        detail.innerHTML = tool ? renderToolDetail(tool) : renderToolWelcome(coreTools);
        if (tool) bindDetailInteractions(tool.id);
      }
    });

    document.querySelectorAll('.toolbox-card[data-tool-id], .toolbox-chip[data-tool-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const toolId = card.getAttribute('data-tool-id');
        state.selectedTool = toolId;
        document.querySelectorAll('.toolbox-card[data-tool-id]').forEach((el) => el.classList.toggle('active', el.getAttribute('data-tool-id') === toolId));
        const detail = $('#tool-detail');
        const tool = tools.find((t) => t.id === toolId);
        if (detail && tool) {
          detail.innerHTML = renderToolDetail(tool);
          bindDetailInteractions(toolId);
        }
      });
    });

    if (selectedTool) bindDetailInteractions(selectedTool.id);
  }

  function bindDetailInteractions(toolId) {
    if (toolId !== 'core_lora_prune') return;
    const keepEl = $(`#tool-${toolId}-keep_blocks`);
    const dropEl = $(`#tool-${toolId}-drop_blocks`);
    const hintEl = $(`#tool-${toolId}-pruner-hint`);
    if (!keepEl || !dropEl) return;

    const parseCsv = (text) => String(text || '').split(',').map((part) => part.trim()).filter(Boolean);
    const setHint = (text) => {
      if (hintEl) hintEl.textContent = text;
    };
    const complementBlocks = (blocks) => PRUNER_BLOCKS.filter((block) => !blocks.includes(block));
    const syncActive = () => {
      const keepSet = new Set(parseCsv(keepEl.value));
      const dropSet = new Set(parseCsv(dropEl.value));
      document.querySelectorAll('[data-pruner-block]').forEach((chip) => {
        const block = chip.getAttribute('data-pruner-block');
        chip.classList.toggle('active', keepSet.has(block));
        chip.classList.toggle('dropped', !keepSet.has(block) && dropSet.has(block));
      });
    };
    const setKeep = (blocks, syncDrop = true) => {
      keepEl.value = blocks.join(',');
      if (syncDrop) {
        dropEl.value = complementBlocks(blocks).join(',');
      } else {
        dropEl.value = '';
      }
      syncActive();
    };
    const getCachedResults = () => window.__lulynxToolboxStore?.results || {};
    const suggestFromAnalyzer = () => {
      const report = getCachedResults().core_lora_analyze;
      const items = Array.isArray(report?.position_analysis) ? report.position_analysis : [];
      if (!items.length) return [];
      const sorted = [...items].filter((item) => PRUNER_BLOCKS.includes(item.key)).sort((a, b) => Number(b.avg_rms || 0) - Number(a.avg_rms || 0));
      const max = Number(sorted[0]?.avg_rms || 0);
      let selected = sorted
        .filter((item) => String(item.status || 'good') !== 'critical' && Number(item.avg_rms || 0) >= max * 0.35)
        .map((item) => item.key);
      if (!selected.length) {
        selected = sorted
          .filter((item) => String(item.status || 'good') !== 'critical')
          .slice(0, 8)
          .map((item) => item.key);
      }
      return selected;
    };
    const suggestFromXray = () => {
      const report = getCachedResults().core_lora_block_analyze;
      const items = Array.isArray(report?.blocks) ? report.blocks : [];
      if (!items.length) return [];
      const sorted = [...items].filter((item) => PRUNER_BLOCKS.includes(item.id)).sort((a, b) => Number((b.normalized_magnitude ?? b.magnitude) || 0) - Number((a.normalized_magnitude ?? a.magnitude) || 0));
      let selected = sorted
        .filter((item) => Number(item.normalized_magnitude ?? 0) >= 35)
        .map((item) => item.id);
      if (!selected.length) {
        selected = sorted.slice(0, 8).map((item) => item.id);
      }
      return selected;
    };

    keepEl.addEventListener('input', syncActive);
    dropEl.addEventListener('input', syncActive);
    document.querySelectorAll('[data-pruner-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const keepBlocks = parseCsv(btn.getAttribute('data-keep') || '');
        const dropBlocks = parseCsv(btn.getAttribute('data-drop') || '');
        if (keepBlocks.length || (!keepBlocks.length && !dropBlocks.length)) {
          setKeep(keepBlocks, true);
        } else {
          keepEl.value = '';
          dropEl.value = dropBlocks.length ? dropBlocks.join(',') : '';
          syncActive();
        }
      });
    });
    document.querySelectorAll('[data-pruner-block]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const current = new Set(parseCsv(keepEl.value));
        const block = chip.getAttribute('data-pruner-block');
        if (current.has(block)) current.delete(block);
        else current.add(block);
        setKeep(Array.from(current), true);
      });
    });
    document.querySelectorAll('[data-pruner-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-pruner-select');
        if (mode === 'all') return setKeep(PRUNER_BLOCKS);
        if (mode === 'style') return setKeep(['M00', 'OUT03', 'OUT04', 'OUT05', 'OUT06', 'OUT07', 'OUT08']);
        if (mode === 'character') return setKeep(['TE1', 'TE2', 'IN00', 'IN01', 'IN02', 'IN03', 'IN04', 'IN05', 'IN06', 'IN07', 'IN08', 'M00', 'OUT00', 'OUT01', 'OUT02']);
        if (mode === 'clear') return setKeep([]);
      });
    });
    document.querySelectorAll('[data-pruner-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const source = btn.getAttribute('data-pruner-source');
        const selected = source === 'analyzer' ? suggestFromAnalyzer() : suggestFromXray();
        if (!selected.length) {
          setHint(source === 'analyzer' ? '未找到 Analyzer 缓存，请先运行 Analyzer。' : '未找到 Block XRay 缓存，请先运行 Block XRay。');
          return;
        }
        setKeep(selected);
        setHint(source === 'analyzer'
          ? `已载入 Analyzer 建议：${selected.length} 个 keep，${complementBlocks(selected).length} 个 drop`
          : `已载入 Block XRay 热区：${selected.length} 个 keep，${complementBlocks(selected).length} 个 drop`);
      });
    });
    setHint('可从最近一次 Analyzer / Block XRay 结果一键带入 block 建议。');
    syncActive();
  }

  return { renderTools, renderToolDetail };
}
