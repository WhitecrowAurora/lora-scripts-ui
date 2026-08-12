// Advanced tag tools: review, policy, retag, version and cross-dataset workflows.

export function createAdvancedTagWorkflowTools({ api, $, showToast, context }) {
  const {
    esc,
    pathPicker,
    boolCard,
    setResult,
    busy,
    errorBox,
    unwrap,
    samplesList,
  } = context;

  // ---------------------------------------------------------------- P1.5 review

  function segReview() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-rev-path')}
        <div class="config-group"><label>路线（可空）</label><input class="text-input" type="text" id="adv-rev-route" placeholder="sdxl / anima / newbie"></div>
      </div>
      <div class="tool-actions"><button class="btn btn-outline btn-sm" type="button" onclick="runAdvReviewQueue()">构建审查队列</button></div>
      <div id="adv-rev-result" style="margin-top:16px;"></div>`;
  }

  async function runAdvReviewQueue() {
    const params = {
      dir: $('#adv-rev-path')?.value?.trim() || '',
      route_family: $('#adv-rev-route')?.value?.trim() || '',
    };
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-rev-result', '构建中...');
    try {
      const data = unwrap(await api.reviewQueue(params));
      const queues = data.queues || {};
      const keys = Object.keys(queues);
      setResult('adv-rev-result', `<div class="module-list">
        ${keys.length ? keys.map((k) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>${esc(k)}</strong><span class="module-list-meta">${(queues[k] || []).length} 项</span></div></div>`).join('')
          : '<div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>队列为空</strong></div></div>'}</div>`);
    } catch (error) { errorBox('adv-rev-result', error); }
  }

  // ---------------------------------------------------------------- P2.2 policy

  function segPolicy() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-pol-path')}
        <div class="config-group"><label>策略包</label><select id="adv-pol-pack" class="text-input"><option value="">加载中...</option></select></div>
        ${boolCard('adv-pol-backup', '应用前自动备份', true)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="refreshAdvPolicyPacks()">刷新策略包</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvPolicyPreview()">预览</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvPolicyApply()">应用（写）</button>
      </div>
      <div id="adv-pol-result" style="margin-top:16px;"></div>`;
  }

  async function refreshPolicyPacks() {
    const select = $('#adv-pol-pack');
    if (!select) return;
    try {
      const data = unwrap(await api.policyPackList({}));
      const packs = data.packs || [];
      select.innerHTML = packs.length
        ? packs.map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}${p.builtin ? '（内置）' : ''}</option>`).join('')
        : '<option value="">（无策略包）</option>';
    } catch (_e) {
      select.innerHTML = '<option value="">加载失败</option>';
    }
  }

  function policyParams() {
    return {
      dir: $('#adv-pol-path')?.value?.trim() || '',
      pack_id: $('#adv-pol-pack')?.value || '',
      create_backup: $('#adv-pol-backup')?.checked ?? true,
    };
  }

  async function runAdvPolicyPreview() {
    const params = policyParams();
    if (!params.dir || !params.pack_id) { showToast('请填写路径并选择策略包。'); return; }
    busy('adv-pol-result', '预览中...');
    try {
      const data = unwrap(await api.policyPackPreview(params));
      const s = data.summary || {};
      setResult('adv-pol-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>策略包预览: ${esc(data.pack_id)}</strong>
        <span class="module-list-meta">将改: ${s.changed_count ?? '-'} / 扫描 ${s.scanned_caption_count ?? '-'}</span></div></div>
        ${samplesList(data.samples)}</div>`);
    } catch (error) { errorBox('adv-pol-result', error); }
  }

  async function runAdvPolicyApply() {
    const params = policyParams();
    if (!params.dir || !params.pack_id) { showToast('请填写路径并选择策略包。'); return; }
    busy('adv-pol-result', '应用中...');
    try {
      const data = unwrap(await api.policyPackApply(params));
      setResult('adv-pol-result', `<div class="builtin-picker-empty"><span>策略包已应用，改写 ${data.modified_count ?? 0} 个文件。备份: ${esc(data.backup_name || '（无）')}</span></div>`);
      showToast('策略包已应用。');
    } catch (error) { errorBox('adv-pol-result', error); }
  }

  // ---------------------------------------------------------------- P2.3 retag

  function segRetag() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-retag-path')}
        <div class="config-group"><label>路线（可空）</label><input class="text-input" type="text" id="adv-retag-route" placeholder="sdxl / anima / newbie"></div>
        <div class="config-group"><label>批量大小</label><input class="text-input" type="number" id="adv-retag-batch" value="10" min="1"></div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvRetagBuild()">构建队列</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvRetagNext()">下一批</button>
      </div>
      <div id="adv-retag-result" style="margin-top:16px;"></div>`;
  }

  function retagPath() { return $('#adv-retag-path')?.value?.trim() || ''; }

  async function runAdvRetagBuild() {
    const dir = retagPath();
    if (!dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-retag-result', '构建中...');
    try {
      const data = unwrap(await api.retagQueueBuild({ dir, route_family: $('#adv-retag-route')?.value?.trim() || '' }));
      renderRetagPriority(data);
    } catch (error) { errorBox('adv-retag-result', error); }
  }

  async function runAdvRetagNext() {
    const dir = retagPath();
    if (!dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-retag-result', '读取中...');
    try {
      const data = unwrap(await api.retagQueueNext({ dir, batch_size: Number($('#adv-retag-batch')?.value || 10) || 10 }));
      const batch = data.batch || [];
      setResult('adv-retag-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>本批 ${batch.length} 项 | 剩余待处理 ${data.remaining_pending ?? 0}</strong></div></div>
        ${batch.map((e) => retagRow(dir, e)).join('')}</div>`);
    } catch (error) { errorBox('adv-retag-result', error); }
  }

  function renderRetagPriority(data) {
    const dir = retagPath();
    const priority = (data.priority || []).slice(0, 50);
    const sum = data.summary || {};
    setResult('adv-retag-result', `<div class="module-list">
      <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>队列已构建</strong>
      <span class="module-list-meta">标记: ${sum.flagged_count ?? 0} / ${sum.image_count ?? 0} 图</span></div></div>
      ${priority.map((e) => retagRow(dir, e)).join('')}</div>`);
  }

  function retagRow(dir, entry) {
    const path = entry.image_path || '';
    const enc = encodeURIComponent(path);
    return `<div class="module-list-item module-list-item-static"><div class="module-list-main">
      <strong>${esc(path)}</strong>
      <span class="module-list-meta">分数 ${entry.score ?? '-'} | 状态 ${esc(entry.status || 'pending')}</span>
      <span style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="markAdvRetag('${esc(dir)}','${enc}','done')">完成</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="markAdvRetag('${esc(dir)}','${enc}','skipped')">跳过</button>
      </span></div></div>`;
  }

  async function markAdvRetag(dir, encodedPath, status) {
    try {
      await api.retagQueueMark({ dir, image_path: decodeURIComponent(encodedPath), status });
      showToast(`已标记为 ${status}。`);
    } catch (error) { showToast(error.message || '标记失败。'); }
  }

  // ---------------------------------------------------------------- P2.1 version

  function segVersion() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-ver-path')}
        <div class="config-group"><label>图片相对/绝对路径</label><input class="text-input" type="text" id="adv-ver-image" placeholder="a.png"></div>
        <div class="config-group"><label>回退到版本号</label><input class="text-input" type="number" id="adv-ver-target" value="1" min="0"></div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvVersionHistory()">历史</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvVersionRevert()">回退（写）</button>
      </div>
      <div id="adv-ver-result" style="margin-top:16px;"></div>`;
  }

  function versionParams() {
    return {
      dir: $('#adv-ver-path')?.value?.trim() || '',
      image_path: $('#adv-ver-image')?.value?.trim() || '',
    };
  }

  async function runAdvVersionHistory() {
    const params = versionParams();
    if (!params.dir || !params.image_path) { showToast('请填写数据集路径与图片路径。'); return; }
    busy('adv-ver-result', '读取中...');
    try {
      const data = unwrap(await api.versionHistory(params));
      const versions = data.versions || [];
      setResult('adv-ver-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>版本数: ${data.version_count ?? versions.length}</strong></div></div>
        ${versions.map((v) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>v${esc(v.v)} · ${esc(v.operation || '')}</strong>
          <span class="module-list-meta">${esc(v.timestamp || '')}</span>
          <span class="module-list-meta" style="color:var(--accent);">${esc((v.new || '').slice(0, 160))}</span></div></div>`).join('')}</div>`);
    } catch (error) { errorBox('adv-ver-result', error); }
  }

  async function runAdvVersionRevert() {
    const params = { ...versionParams(), to_version: Number($('#adv-ver-target')?.value || 1) || 1 };
    if (!params.dir || !params.image_path) { showToast('请填写数据集路径与图片路径。'); return; }
    busy('adv-ver-result', '回退中...');
    try {
      const data = unwrap(await api.versionRevert(params));
      setResult('adv-ver-result', `<div class="builtin-picker-empty"><span>已回退到 v${esc(params.to_version)}：${esc((data.caption || '').slice(0, 200))}</span></div>`);
      showToast('已回退。');
    } catch (error) { errorBox('adv-ver-result', error); }
  }

  // ---------------------------------------------------------------- P3.2 cross

  function segCross() {
    return `
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>多数据集路径（一行一个，或逗号分隔）</label>
          <textarea class="text-input" id="adv-cross-paths" style="min-height:120px;width:100%;" placeholder="./train/ds_a&#10;./train/ds_b"></textarea>
        </div>
        <div class="config-group"><label>稀有 DF 阈值</label><input class="text-input" type="number" id="adv-cross-rare" value="1" min="1"></div>
        <div class="config-group"><label>别名相似度</label><input class="text-input" type="number" id="adv-cross-alias" value="0.82" min="0" max="1" step="0.01"></div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvCrossAggregate()">聚合分析</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvCrossResult()">读取缓存</button>
      </div>
      <div id="adv-cross-result" style="margin-top:16px;"></div>`;
  }

  function crossPaths() {
    return ($('#adv-cross-paths')?.value || '')
      .replace(/\r/g, '\n').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }

  function renderCross(data) {
    const freq = (data.global_tag_frequency || []).slice(0, 20);
    const rare = (data.rare_tag_library || []).slice(0, 20);
    const alias = (data.alias_evolution || []).slice(0, 20);
    const pairs = (data.style_similarity?.pairs || []).slice(0, 20);
    setResult('adv-cross-result', `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
        <div class="module-list-item module-list-item-static" style="align-items:flex-start;"><div class="module-list-main">
          <strong>全局高频（${data.dataset_count ?? '-'} 集 / 唯一 ${data.global_unique_tags ?? '-'}）</strong>
          ${freq.map((e) => `<span class="module-list-meta">${esc(e.tag)} x ${e.count}</span>`).join('') || '<span class="module-list-meta">—</span>'}</div></div>
        <div class="module-list-item module-list-item-static" style="align-items:flex-start;"><div class="module-list-main">
          <strong>稀有标签库</strong>
          ${rare.map((e) => `<span class="module-list-meta">${esc(e.tag)} · DF ${e.dataset_frequency} · ${e.global_count}</span>`).join('') || '<span class="module-list-meta">—</span>'}</div></div>
        <div class="module-list-item module-list-item-static" style="align-items:flex-start;"><div class="module-list-main">
          <strong>别名演化建议</strong>
          ${alias.map((e) => `<span class="module-list-meta">${esc(e.variant)} → ${esc(e.canonical)}（${esc(e.reason)} ${e.confidence}）</span>`).join('') || '<span class="module-list-meta">—</span>'}</div></div>
        <div class="module-list-item module-list-item-static" style="align-items:flex-start;"><div class="module-list-main">
          <strong>风格指纹相似度</strong>
          ${pairs.map((p) => `<span class="module-list-meta">${esc(p.a.slice(0, 8))}↔${esc(p.b.slice(0, 8))}: ${p.cosine}</span>`).join('') || '<span class="module-list-meta">—</span>'}</div></div>
      </div>`);
  }

  async function runAdvCrossAggregate() {
    const paths = crossPaths();
    if (paths.length < 1) { showToast('请至少填写一个数据集路径。'); return; }
    busy('adv-cross-result', '聚合分析中...');
    try {
      const data = unwrap(await api.crossDatasetAggregate({
        dataset_paths: paths,
        rare_df_threshold: Number($('#adv-cross-rare')?.value || 1) || 1,
        alias_min_similarity: Number($('#adv-cross-alias')?.value || 0.82) || 0.82,
      }));
      renderCross(data);
      showToast('跨数据集聚合完成。');
    } catch (error) { errorBox('adv-cross-result', error); }
  }

  async function runAdvCrossResult() {
    const paths = crossPaths();
    if (paths.length < 1) { showToast('请至少填写一个数据集路径。'); return; }
    busy('adv-cross-result', '读取缓存中...');
    try {
      const data = unwrap(await api.crossDatasetResult({ dataset_paths: paths }));
      if (data.status === 'missing') { setResult('adv-cross-result', '<div class="builtin-picker-empty"><span>无缓存，请先聚合分析。</span></div>'); return; }
      renderCross(data);
    } catch (error) { errorBox('adv-cross-result', error); }
  }


  return {
    segments: {
      review: segReview,
      policy: segPolicy,
      retag: segRetag,
      version: segVersion,
      cross: segCross,
    },
    runAdvReviewQueue,
    refreshAdvPolicyPacks: refreshPolicyPacks,
    runAdvPolicyPreview,
    runAdvPolicyApply,
    runAdvRetagBuild,
    runAdvRetagNext,
    markAdvRetag,
    runAdvVersionHistory,
    runAdvVersionRevert,
    runAdvCrossAggregate,
    runAdvCrossResult,
  };
}
