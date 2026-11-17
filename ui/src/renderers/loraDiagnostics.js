import { escapeHtml } from '../utils/dom.js';
import { renderBaseSource, renderLoraCheckpointTrend } from './loraCheckpointTrend.js';

const number = (value) => value == null ? '—' : Number(value).toPrecision(4);
const exportButton = '<div class="xray-summary-actions"><button class="toolbox-mini-btn" type="button"'
  + ' data-export-tool="core_lora_block_energy" data-export-format="json">导出完整诊断 JSON</button></div>';

export function renderLoraDiagnostics(body) {
  if (body.checkpoint_trend) return renderLoraCheckpointTrend(body.checkpoint_trend) + exportButton;
  const diagnostics = body.base_diagnostics;
  const modules = Object.entries(body.modules || {});
  const rows = modules.map(([name, row]) => ({ name, ...row, ...diagnostics?.modules?.[name] }))
    .sort((a, b) => (b.relative_update_norm ?? b.fro_norm) - (a.relative_update_norm ?? a.fro_norm));
  const spectralRows = Object.entries(diagnostics?.modules || {}).filter(([, row]) => row.spectral);
  const skipped = diagnostics?.skipped || body.skipped || [];
  return '<div class="xray-section-head"><strong>模块诊断</strong><span>'
    + (diagnostics ? '已对照底模 ' + diagnostics.compared_count + '/' + diagnostics.selected_count + ' 个模块' : '未提供底模，显示增量自身的谱指标')
    + '</span></div>'
    + renderBaseSource(diagnostics?.base_model_source)
    + '<div class="xray-table-wrap"><table class="xray-table"><thead><tr>'
    + '<th>模块（前 24 项）</th><th>相对底模更新范数</th><th>Stable rank</th><th>归一化谱熵</th>'
    + '</tr></thead><tbody>'
    + rows.slice(0, 24).map((row) => '<tr><td title="' + escapeHtml(row.base_key || '') + '">' + escapeHtml(row.name) + '</td>'
      + '<td>' + number(row.relative_update_norm) + '</td><td>' + number(row.stable_rank) + '</td>'
      + '<td>' + number(row.normalized_entropy) + '</td></tr>').join('')
    + '</tbody></table></div>'
    + '<p>相对更新范数计入 alpha/rank，强度为 1；上方 Block 能量保持未缩放口径。谱熵按能量分布计算。缺失 alpha 按 rank 处理。指标用于层间比较，不直接判定画质。</p>'
    + spectralRows.map(([name, row]) => {
      const s = row.spectral;
      const left = s.left_subspace;
      const right = s.right_subspace;
      const notes = [...s.warnings];
      if (left.spans_entire_ambient_space || right.spans_entire_ambient_space) {
        notes.push('所选子空间覆盖整侧空间，该侧重叠/角度不具有区分力；可减小 top-k。');
      }
      return '<div class="xray-section-head"><strong>底模谱方向对照</strong></div>'
        + '<div class="xray-summary-box"><pre>' + escapeHtml([
          name + ' → ' + row.base_key,
          '检查 top-k：' + s.top_k_checked + ' / 请求 ' + s.top_k_requested + '；参考左奇异向量：' + s.reference_vectors,
          '最大绝对余弦低于 ' + s.similarity_threshold + ' 的方向：' + (s.intruder_count ?? '未定义'),
          '入侵方向占比：' + number(s.intruder_fraction) + '；占合并权重总谱能量：' + number(s.intruder_energy_share),
          'top-k 谱能量覆盖：' + number(s.topk_energy_coverage),
          '左主子空间重叠：' + number(left.overlap) + '；最大主角度：' + number(left.max_angle_degrees) + '°',
          '右主子空间重叠：' + number(right.overlap) + '；最大主角度：' + number(right.max_angle_degrees) + '°',
          ...notes,
        ].join('\n')) + '</pre></div>';
    }).join('')
    + (skipped.length ? '<details><summary>未完成分析的模块（' + skipped.length + '）</summary><pre>'
      + escapeHtml(skipped.map((row) => row.module + ': ' + row.reason).join('\n')) + '</pre></details>' : '')
    + exportButton;
}
