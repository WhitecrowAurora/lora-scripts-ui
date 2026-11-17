import { escapeHtml } from '../utils/dom.js';

const number = (value) => value == null ? '—' : Number(value).toPrecision(4);

export function renderBaseSource(source) {
  if (!source) return '';
  const format = source.format === 'indexed_safetensors' ? `索引 · ${source.shard_count} 个分片` : '单文件';
  return `<p>底模来源（${format}）：${escapeHtml(source.path)}。模块名悬停可查看对应权重与行切片，完整来源见导出 JSON。</p>`;
}

function trendChart(points, label, valueOf) {
  const values = points.map(valueOf);
  const finite = values.filter((value) => value != null && Number.isFinite(value));
  if (!finite.length) return '';
  const maximum = Math.max(...finite);
  let connected = false;
  let path = '';
  const dots = values.map((value, i) => {
    if (value == null || !Number.isFinite(value)) { connected = false; return ''; }
    const x = 20 + 460 * i / Math.max(1, points.length - 1);
    const y = 92 - 72 * value / Math.max(maximum, 1e-12);
    path += `${connected ? 'L' : 'M'}${x},${y} `;
    connected = true;
    return `<circle cx="${x}" cy="${y}" r="3" fill="currentColor"><title>${escapeHtml(`${i + 1}. ${points[i].name}: ${number(value)}`)}</title></circle>`;
  }).join('');
  return `<figure style="margin:12px 0"><figcaption>${escapeHtml(label)} · 最大值 ${number(maximum)}</figcaption>`
    + `<svg viewBox="0 0 500 116" role="img" aria-label="${escapeHtml(label)}" style="width:100%;max-width:720px;color:var(--accent)">`
    + '<path d="M20,12V92H480" fill="none" stroke="currentColor" opacity=".3"/>'
    + `<path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/>${dots}`
    + `<text x="20" y="110" fill="currentColor" font-size="11">1</text><text x="465" y="110" fill="currentColor" font-size="11">${points.length}</text></svg></figure>`;
}

export function renderLoraCheckpointTrend(trend) {
  const points = trend.checkpoints;
  return '<div class="xray-section-head"><strong>跨保存点诊断趋势</strong></div>'
    + renderBaseSource(trend.base_model_source)
    + '<p>按输入顺序比较，首点为上方 LoRA 文件。范数与角度均使用实际 alpha/rank 缩放的有效增量；相邻对照只统计两边都可分析的同形模块。缺失模块不会视为零，零增量的角度显示为 —。</p>'
    + trendChart(points, '有效增量范数（全部可分析模块）', (point) => point.summary.delta_fro_norm)
    + trendChart(points, '相邻保存点的增量方向角度（共同模块，度）', (point) => point.summary.from_previous.angle_degrees)
    + '<div class="xray-table-wrap"><table class="xray-table"><thead><tr><th>保存点</th><th>有效范数</th><th>共同模块</th><th>相邻变化范数</th><th>相邻角度 °</th><th>相对首点角度 °</th></tr></thead><tbody>'
    + points.map((point, i) => {
      const summary = point.summary;
      return `<tr><td title="${escapeHtml(point.path)}">${i + 1}. ${escapeHtml(point.name)}</td>`
        + `<td>${number(summary.delta_fro_norm)}</td><td>${summary.from_previous.compared_modules}/${summary.module_count}</td>`
        + `<td>${number(summary.from_previous.change_fro_norm)}</td><td>${number(summary.from_previous.angle_degrees)}</td>`
        + `<td>${number(summary.from_first.angle_degrees)}</td></tr>`;
    }).join('') + '</tbody></table></div>'
    + points.map((point, i) => {
      const rows = Object.entries(point.modules).sort((a, b) => (b[1].from_previous?.change_fro_norm ?? 0) - (a[1].from_previous?.change_fro_norm ?? 0));
      const notes = [...point.skipped.map((row) => `${row.module}: ${row.reason}`)];
      for (const [name, row] of rows) {
        if (row.base_error) notes.push(`${name}: ${row.base_error}`);
        if (row.from_previous?.reason) notes.push(`${name}: ${row.from_previous.reason}`);
        if (row.spectral) notes.push(...row.spectral.warnings.map((note) => `${name}: ${note}`));
        if (row.spectral?.left_subspace.spans_entire_ambient_space || row.spectral?.right_subspace.spans_entire_ambient_space) {
          notes.push(`${name}: 所选子空间覆盖整侧空间，该侧重叠/角度不具有区分力。`);
        }
      }
      return `<details><summary>${i + 1}. ${escapeHtml(point.name)} · 模块明细与底模对照</summary>`
        + '<div class="xray-table-wrap"><table class="xray-table"><thead><tr><th>模块（变化前 24 项）</th><th>相邻变化</th><th>相对底模范数</th><th>有效秩</th><th>Stable rank</th><th>归一化熵</th><th>入侵方向</th><th>入侵能量占比</th><th>左子空间重叠</th></tr></thead><tbody>'
        + rows.slice(0, 24).map(([name, row]) => `<tr><td title="${escapeHtml(row.base_key || '')}">${escapeHtml(name)}</td><td>${number(row.from_previous?.change_fro_norm)}</td>`
          + `<td>${number(row.relative_update_norm)}</td><td>${number(row.effective_rank)}</td><td>${number(row.stable_rank)}</td>`
          + `<td>${number(row.normalized_entropy)}</td><td>${row.spectral?.intruder_count ?? '—'}</td>`
          + `<td>${number(row.spectral?.intruder_energy_share)}</td><td>${number(row.spectral?.left_subspace.overlap)}</td></tr>`).join('')
        + '</tbody></table></div>'
        + (notes.length ? `<pre>${escapeHtml(notes.join('\n'))}</pre>` : '') + '</details>';
    }).join('')
    + '<p>入侵指标仅在提供底模并指定模块时计算；完整方向、子空间指标与 block 汇总可导出 JSON。这些趋势不直接判定画质，也不会触发早停。</p>';
}
