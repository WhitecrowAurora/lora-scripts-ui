// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
import { all, when } from '../schemaCommon.js';

const enabled = all(when('enable_preview', true), when('sample_cns_enabled', true));
const stochastic = (c) => c.enable_preview === true && c.sample_cns_enabled === true
  && c.sample_algorithm === 'sde' && Number(c.sample_sde_eta) > 0;
stochastic.deps = new Set(['enable_preview', 'sample_cns_enabled', 'sample_algorithm', 'sample_sde_eta']);

export const FLUX_CNS_PREVIEW_FIELDS = [
  { key: 'sample_cns_enabled', type: 'boolean', label: 'Flux ER-SDE / CNS', title: 'sample_cns_enabled', desc: '显式开启随机预览。关闭保留原 Euler；开启后无标定时使用白噪声 ER-SDE。画质收益尚未校准。', defaultValue: false, visibleWhen: when('enable_preview', true) },
  { key: 'sample_algorithm', type: 'select', label: '预览求解器', title: 'sample_algorithm', desc: 'sde 使用 ER-SDE；ode 保留确定性 Euler。', defaultValue: 'sde', options: [{ value: 'sde', label: 'ER-SDE（随机）' }, { value: 'ode', label: 'Euler ODE（确定性）' }], visibleWhen: enabled },
  { key: 'sample_sde_eta', type: 'number', label: 'ER-SDE 随机强度 eta', title: 'sample_sde_eta', desc: '0 保留原 Euler；大于 0 才注入随机噪声。', defaultValue: 1, min: 0, max: 1, step: 0.05, visibleWhen: all(enabled, when('sample_algorithm', 'sde')) },
  { key: 'sample_cns_gamma_path', type: 'string', label: 'Flux CNS 标定文件', title: 'sample_cns_gamma_path', desc: '需提供匹配当前 Flux、CFG、sigma 和 latent 尺寸的 .npz；不支持 auto 或其他模型族标定。缺失或不匹配时使用白噪声 ER-SDE。', defaultValue: '', visibleWhen: stochastic },
  { key: 'sample_cns_strength', type: 'number', label: 'CNS 强度', title: 'sample_cns_strength', desc: '0 = 白噪声 ER-SDE；1 = 完整应用提供的频谱标定。', defaultValue: 1, min: 0, max: 1, step: 0.05, visibleWhen: stochastic },
];
