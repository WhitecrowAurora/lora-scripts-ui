// Advanced tag tools: pipeline, tagging, structure, scan, cache and frequency workflows.

export function createAdvancedTagBatchTools({ api, $, showToast, context }) {
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

  // ---------------------------------------------------------------- P3.3 pipeline

  function segPipeline() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-pipe-path')}
        <div class="config-group"><label>策略包 ID</label><input class="text-input" type="text" id="adv-pipe-pack" placeholder="sdxl_general_lora"></div>
        <div class="config-group"><label>路线（可空）</label><input class="text-input" type="text" id="adv-pipe-route" placeholder="sdxl / anima / newbie"></div>
        <div class="config-group"><label>批量大小</label><input class="text-input" type="number" id="adv-pipe-batch" value="10" min="1"></div>
        ${boolCard('adv-pipe-backup', '应用前自动备份', true)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvPipelinePlan()">计划（只读）</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvPipelineRun()">运行闭环（写）</button>
      </div>
      <div id="adv-pipe-result" style="margin-top:16px;"></div>`;
  }

  function pipelineParams() {
    return {
      path: $('#adv-pipe-path')?.value?.trim() || '',
      policy_pack: $('#adv-pipe-pack')?.value?.trim() || '',
      route_family: $('#adv-pipe-route')?.value?.trim() || '',
      batch_size: Number($('#adv-pipe-batch')?.value || 10) || 10,
      create_backup: $('#adv-pipe-backup')?.checked ?? true,
    };
  }

  async function runAdvPipelinePlan() {
    const params = pipelineParams();
    if (!params.path || !params.policy_pack) { showToast('请填写数据集路径与策略包 ID。'); return; }
    busy('adv-pipe-result', '生成计划中...');
    try {
      const data = unwrap(await api.pipelinePlan(params));
      const q = data.queue_summary || {};
      const p = data.policy_summary || {};
      setResult('adv-pipe-result', `
        <div class="module-list">
          <div class="module-list-item module-list-item-static"><div class="module-list-main">
            <strong>计划（不写盘）</strong>
            <span class="module-list-meta">队列标记: ${q.flagged_count ?? '-'} / ${q.image_count ?? '-'} 图</span>
            <span class="module-list-meta">策略包将改: ${p.changed_count ?? '-'} / 扫描 ${p.scanned_caption_count ?? '-'}</span>
            <span class="module-list-meta">本批待处理: ${data.batch_size ?? 0}</span>
          </div></div>
          ${samplesList(data.policy_samples)}
        </div>`);
    } catch (error) { errorBox('adv-pipe-result', error); }
  }

  async function runAdvPipelineRun() {
    const params = pipelineParams();
    if (!params.path || !params.policy_pack) { showToast('请填写数据集路径与策略包 ID。'); return; }
    busy('adv-pipe-result', '运行闭环中...');
    try {
      const data = unwrap(await api.pipelineRun(params));
      const r = data.recheck || {};
      setResult('adv-pipe-result', `
        <div class="module-list">
          <div class="module-list-item module-list-item-static"><div class="module-list-main">
            <strong>闭环完成</strong>
            <span class="module-list-meta">改写文件: ${data.modified_count ?? 0} | 标记完成: ${data.marked_done_count ?? 0}</span>
            <span class="module-list-meta">备份: ${esc(data.backup_name || '（无）')}</span>
            <span class="module-list-meta" style="color:var(--accent);">问题数 ${r.findings_before ?? '-'} → ${r.findings_after ?? '-'}（解决 ${r.findings_resolved ?? 0}）</span>
          </div></div>
        </div>`);
      showToast('闭环清洗完成。');
    } catch (error) { errorBox('adv-pipe-result', error); }
  }

  // ---------------------------------------------------------------- P1.1 ensemble

  function segEnsemble() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-ens-path')}
        <div class="config-group"><label>路线（可空）</label><input class="text-input" type="text" id="adv-ens-route" placeholder="sdxl / anima / newbie"></div>
        ${boolCard('adv-ens-backup', '应用前自动备份', true)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvEnsemblePreview()">预览</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvEnsembleApply()">应用（写）</button>
      </div>
      <div id="adv-ens-result" style="margin-top:16px;"></div>`;
  }

  function ensembleParams() {
    return {
      dir: $('#adv-ens-path')?.value?.trim() || '',
      route_family: $('#adv-ens-route')?.value?.trim() || '',
      create_backup: $('#adv-ens-backup')?.checked ?? true,
    };
  }

  async function runAdvEnsemblePreview() {
    const params = ensembleParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-ens-result', '预览中...');
    try {
      const data = unwrap(await api.ensembleTagPreview(params));
      const s = data.summary || {};
      setResult('adv-ens-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>集成打标预览</strong>
        <span class="module-list-meta">将改: ${s.changed_count ?? '-'} / 扫描 ${s.scanned_caption_count ?? '-'}</span></div></div>
        ${samplesList(data.samples)}</div>`);
    } catch (error) { errorBox('adv-ens-result', error); }
  }

  async function runAdvEnsembleApply() {
    const params = ensembleParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-ens-result', '应用中...');
    try {
      const data = unwrap(await api.ensembleTagApply(params));
      setResult('adv-ens-result', `<div class="builtin-picker-empty"><span>集成打标已应用，改写 ${data.modified_count ?? 0} 个文件。</span></div>`);
      showToast('集成打标已应用。');
    } catch (error) { errorBox('adv-ens-result', error); }
  }

  // ---------------------------------------------------------------- P1.2 structure

  function segStructure() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-str-path')}
        <div class="config-group"><label>操作</label><input class="text-input" type="text" id="adv-str-op" placeholder="flat_to_structured"></div>
        ${boolCard('adv-str-backup', '应用前自动备份', true)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvStructurePreview()">预览</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvStructureApply()">应用（写）</button>
      </div>
      <div id="adv-str-result" style="margin-top:16px;"></div>`;
  }

  function structureParams() {
    return {
      dir: $('#adv-str-path')?.value?.trim() || '',
      operation: $('#adv-str-op')?.value?.trim() || 'flat_to_structured',
      create_backup: $('#adv-str-backup')?.checked ?? true,
    };
  }

  async function runAdvStructurePreview() {
    const params = structureParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-str-result', '预览中...');
    try {
      const data = unwrap(await api.structurePreview(params));
      const s = data.summary || {};
      setResult('adv-str-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>结构化预览</strong>
        <span class="module-list-meta">将改: ${s.changed_count ?? '-'} / 扫描 ${s.scanned_caption_count ?? '-'}</span></div></div>
        ${samplesList(data.samples)}</div>`);
    } catch (error) { errorBox('adv-str-result', error); }
  }

  async function runAdvStructureApply() {
    const params = structureParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-str-result', '应用中...');
    try {
      const data = unwrap(await api.structureApply(params));
      setResult('adv-str-result', `<div class="builtin-picker-empty"><span>结构化已应用，改写 ${data.modified_count ?? 0} 个文件。</span></div>`);
      showToast('结构化已应用。');
    } catch (error) { errorBox('adv-str-result', error); }
  }

  // ---------------------------------------------------------------- P1.3 / P5 dedupe + cull

  function segDedupe() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-dup-path')}
        <div class="config-group"><label>宽高比容差</label><input class="text-input" type="number" id="adv-dup-aspect" value="0.02" min="0" max="1" step="0.01"></div>
        <div class="config-group"><label>最小簇大小</label><input class="text-input" type="number" id="adv-dup-minsize" value="2" min="2" step="1"></div>
        <div class="config-group"><label>保留策略</label>
          <select class="text-input" id="adv-dup-strategy">
            <option value="keep_first" selected>保留首张 (keep_first)</option>
            <option value="keep_best_caption">保留 caption 最长</option>
          </select>
        </div>
        ${boolCard('adv-dup-embed', '可选：CLIP 语义簇（更慢，大库慎用）', false)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvDedupe()">扫描近重复</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvDedupePlan()">预览隔离计划</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvDedupeQuarantine()">隔离多余</button>
      </div>
      <div class="module-list-item module-list-item-static" style="margin-top:8px;"><div class="module-list-main">
        <span class="module-list-meta">默认隔离到 output/.quarantine/near_dup/，不直接删除；可手动挪回。</span>
      </div></div>
      <div id="adv-dup-result" style="margin-top:16px;"></div>`;
  }

  function dedupeParams(extra = {}) {
    return {
      dir: $('#adv-dup-path')?.value?.trim() || '',
      aspect_tolerance: Number($('#adv-dup-aspect')?.value || 0.02) || 0.02,
      min_cluster_size: Number($('#adv-dup-minsize')?.value || 2) || 2,
      strategy: $('#adv-dup-strategy')?.value || 'keep_first',
      use_embedding_clusters: $('#adv-dup-embed')?.checked ?? false,
      ...extra,
    };
  }

  function flattenClusters(clusters) {
    if (Array.isArray(clusters)) return clusters;
    if (!clusters || typeof clusters !== 'object') return [];
    const out = [];
    for (const key of ['by_filename', 'by_dimension', 'by_hash', 'by_embedding', 'all']) {
      if (Array.isArray(clusters[key])) out.push(...clusters[key]);
    }
    if (!out.length) {
      for (const value of Object.values(clusters)) {
        if (Array.isArray(value)) out.push(...value);
      }
    }
    return out;
  }

  async function runAdvDedupe() {
    const params = dedupeParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-dup-result', '扫描中...');
    try {
      const data = unwrap(await api.nearDuplicatesReview(params));
      const clusters = flattenClusters(data.clusters);
      const flagged = data.summary?.flagged_image_count ?? '-';
      setResult('adv-dup-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>近重复簇: ${clusters.length}</strong>
        <span class="module-list-meta">涉及图片: ${esc(flagged)}</span></div></div>
        ${clusters.slice(0, 30).map((c) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>${esc(c.kind || 'cluster')}:${esc(c.key ?? c.cluster_id ?? '-')}（${(c.members || []).length} 张）</strong>
          <span class="module-list-meta">caption 一致: ${esc(c.caption_consistent ?? c.caption_consistency ?? '-')}</span></div></div>`).join('')}</div>`);
    } catch (error) { errorBox('adv-dup-result', error); }
  }

  async function runAdvDedupePlan() {
    const params = dedupeParams({ action: 'plan' });
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-dup-result', '生成隔离计划...');
    try {
      const data = unwrap(await api.nearDuplicatesCull(params));
      setResult('adv-dup-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>计划：保留 ${data.kept_count ?? 0} / 将隔离 ${data.culled_count ?? 0}</strong>
          <span class="module-list-meta">簇数 ${esc(data.plan?.cluster_count ?? data.review_summary?.filename_cluster_count ?? '-')}</span>
        </div></div>
        ${(data.culled || []).slice(0, 40).map((c) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>${esc(c.image_path)}</strong>
          <span class="module-list-meta">${esc(c.cluster_kind)} / ${esc(c.reason)}</span>
        </div></div>`).join('')}</div>`);
    } catch (error) { errorBox('adv-dup-result', error); }
  }

  async function runAdvDedupeQuarantine() {
    const params = dedupeParams({ action: 'quarantine' });
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    if (!window.confirm('将按「每簇保留一张」把多余图片隔离到 quarantine，是否继续？')) return;
    busy('adv-dup-result', '隔离中...');
    try {
      const data = unwrap(await api.nearDuplicatesCull(params));
      setResult('adv-dup-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>隔离完成：moved ${data.moved ?? 0}，跳过 ${data.skipped ?? 0}，失败 ${(data.failed || []).length}</strong>
          <span class="module-list-meta">目录: ${esc(data.quarantine_root || '-')}</span>
        </div></div></div>`);
      showToast(`已隔离 ${data.moved ?? 0} 张近重复。`);
    } catch (error) { errorBox('adv-dup-result', error); }
  }

  // ---------------------------------------------------------------- P5 content scan

  function segContentScan() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-cs-path')}
        <div class="config-group" style="grid-column:1/-1;">
          <label>分类器模型（本地 HF，可 CSV model:threshold=0.5）</label>
          <input class="text-input" type="text" id="adv-cs-models" value="Falconsai/nsfw_image_detection:threshold=0.5">
        </div>
        <div class="config-group"><label>最少票数</label><input class="text-input" type="number" id="adv-cs-votes" value="1" min="1" step="1"></div>
        <div class="config-group"><label>设备</label>
          <select class="text-input" id="adv-cs-device">
            <option value="cpu" selected>cpu</option>
            <option value="cuda">cuda</option>
          </select>
        </div>
      </div>
      <div class="module-list-item module-list-item-static"><div class="module-list-main">
        <span class="module-list-meta">本地过滤工具，非法律/合规结论；样本不上传，仅可能首次下载权重。默认只出报告。</span>
      </div></div>
      <div class="tool-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvContentScan()">扫描报告</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvContentQuarantine()">隔离 flagged</button>
      </div>
      <div id="adv-cs-result" style="margin-top:16px;"></div>`;
  }

  function contentScanParams(extra = {}) {
    return {
      directory: $('#adv-cs-path')?.value?.trim() || '',
      recursive: true,
      models: $('#adv-cs-models')?.value?.trim() || 'Falconsai/nsfw_image_detection:threshold=0.5',
      min_votes: Number($('#adv-cs-votes')?.value || 1) || 1,
      device: $('#adv-cs-device')?.value || 'cpu',
      ...extra,
    };
  }

  async function runAdvContentScan() {
    const params = contentScanParams({ action: 'report' });
    if (!params.directory) { showToast('请先填写数据集路径。'); return; }
    busy('adv-cs-result', '本地扫描中（首次可能下载模型）...');
    try {
      const data = await api.contentScan(params);
      const scan = data?.scan || data?.data?.scan || data || {};
      setResult('adv-cs-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>扫描 ${esc(scan.scanned_count ?? 0)} / flagged ${esc(scan.flagged_count ?? 0)}</strong>
          <span class="module-list-meta">报告: ${esc(scan.report_path || '-')}</span>
        </div></div>
        <div class="module-list-item module-list-item-static"><div class="module-list-main">
          <span class="module-list-meta">${esc(scan.disclaimer || '')}</span>
        </div></div>
        ${(scan.flagged_paths || []).slice(0, 40).map((p) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>${esc(p)}</strong>
        </div></div>`).join('')}</div>`);
    } catch (error) { errorBox('adv-cs-result', error); }
  }

  async function runAdvContentQuarantine() {
    const params = contentScanParams({ action: 'quarantine' });
    if (!params.directory) { showToast('请先填写数据集路径。'); return; }
    if (!window.confirm('将隔离扫描 flagged 的图片到 quarantine，是否继续？')) return;
    busy('adv-cs-result', '扫描并隔离中...');
    try {
      const data = await api.contentScan(params);
      const scan = data?.scan || data?.data?.scan || {};
      const apply = data?.apply || data?.data?.apply || {};
      setResult('adv-cs-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main">
          <strong>flagged ${esc(scan.flagged_count ?? 0)} / moved ${esc(apply.moved ?? 0)}</strong>
          <span class="module-list-meta">${esc(apply.quarantine_root || scan.report_path || '-')}</span>
        </div></div></div>`);
      showToast(`内容扫描隔离 ${apply.moved ?? 0} 张。`);
    } catch (error) { errorBox('adv-cs-result', error); }
  }

  // ---------------------------------------------------------------- cache health (manifest)

  function segCacheHealth() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-ch-root', '缓存根目录（含 lulynx_cache_manifest_*.json）')}
        <div class="config-group"><label>族 family</label>
          <select class="text-input" id="adv-ch-family">
            <option value="anima" selected>anima</option>
            <option value="newbie">newbie</option>
            <option value="zimage">zimage</option>
          </select>
        </div>
        <div class="config-group"><label>校验模式</label>
          <select class="text-input" id="adv-ch-trust">
            <option value="strict" selected>strict（含 sha256）</option>
            <option value="trusted">trusted（跳过 hash，本地快迭代）</option>
          </select>
        </div>
      </div>
      <div class="module-list-item module-list-item-static"><div class="module-list-main">
        <span class="module-list-meta">只检查/隔离坏 cache 产物，不动源图。完整重建请用训练 native_cache_mode=rebuild_cache；本工具不做按 stem 半套 rebuild。</span>
      </div></div>
      <div class="tool-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvCacheHealthReport()">扫描报告</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvCacheHealthPlan()">预览修复计划</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvCacheHealthQuarantine()">隔离坏缓存</button>
      </div>
      <div id="adv-ch-result" style="margin-top:16px;"></div>`;
  }

  function cacheHealthParams(extra = {}) {
    return {
      root: $('#adv-ch-root')?.value?.trim() || '',
      family: $('#adv-ch-family')?.value || 'anima',
      trust_mode: $('#adv-ch-trust')?.value || 'strict',
      ...extra,
    };
  }

  function renderCacheHealthResult(data) {
    const q = data?.quarantine || {};
    const plan = data?.repair_plan || {};
    const stems = (data?.bad_stems || plan?.stems || []).slice(0, 40);
    const files = (data?.changed_files || data?.missing_files || plan?.files || []).slice(0, 40);
    return `<div class="module-list">
      <div class="module-list-item module-list-item-static"><div class="module-list-main">
        <strong>ok=${esc(String(data?.ok))} / bad_files=${esc(data?.bad_file_count ?? 0)} / action=${esc(data?.action || '-')}</strong>
        <span class="module-list-meta">manifest: ${esc(data?.manifest_path || '-')}</span>
      </div></div>
      <div class="module-list-item module-list-item-static"><div class="module-list-main">
        <span class="module-list-meta">missing ${esc((data?.missing_files || []).length)} · changed ${esc((data?.changed_files || []).length)} · stems ${esc((data?.bad_stems || []).length)}</span>
      </div></div>
      ${q.root ? `<div class="module-list-item module-list-item-static"><div class="module-list-main">
        <strong>quarantine moved ${esc(q.moved_count ?? 0)}</strong>
        <span class="module-list-meta">${esc(q.root)}</span>
      </div></div>` : ''}
      ${stems.length ? `<div class="module-list-item module-list-item-static"><div class="module-list-main">
        <span class="module-list-meta">bad stems: ${esc(stems.join(', '))}</span>
      </div></div>` : ''}
      ${files.slice(0, 20).map((p) => `<div class="module-list-item module-list-item-static"><div class="module-list-main">
        <strong>${esc(p)}</strong>
      </div></div>`).join('')}
      <div class="module-list-item module-list-item-static"><div class="module-list-main">
        <span class="module-list-meta">${esc(data?.rebuild_hint || data?.partial_rebuild_note || '')}</span>
      </div></div>
    </div>`;
  }

  async function runAdvCacheHealthReport() {
    const params = cacheHealthParams({ action: 'report' });
    if (!params.root) { showToast('请先填写缓存根目录。'); return; }
    busy('adv-ch-result', '校验 cache manifest...');
    try {
      const data = await api.cacheHealth(params);
      setResult('adv-ch-result', renderCacheHealthResult(data?.data || data));
    } catch (error) { errorBox('adv-ch-result', error); }
  }

  async function runAdvCacheHealthPlan() {
    const params = cacheHealthParams({ action: 'repair_plan' });
    if (!params.root) { showToast('请先填写缓存根目录。'); return; }
    busy('adv-ch-result', '生成修复计划（不改盘）...');
    try {
      const data = await api.cacheHealth(params);
      setResult('adv-ch-result', renderCacheHealthResult(data?.data || data));
    } catch (error) { errorBox('adv-ch-result', error); }
  }

  async function runAdvCacheHealthQuarantine() {
    const params = cacheHealthParams({ action: 'quarantine_bad' });
    if (!params.root) { showToast('请先填写缓存根目录。'); return; }
    if (!window.confirm('将隔离校验失败的 cache 文件到 quarantine（源图不动）。是否继续？')) return;
    busy('adv-ch-result', '隔离坏 cache...');
    try {
      const data = await api.cacheHealth(params);
      const body = data?.data || data;
      setResult('adv-ch-result', renderCacheHealthResult(body));
      showToast(`坏缓存隔离 ${body?.quarantine?.moved_count ?? body?.moved?.length ?? 0} 个文件。`);
    } catch (error) { errorBox('adv-ch-result', error); }
  }

  // ---------------------------------------------------------------- P1.4 frequency

  function segFrequency() {
    return `
      <div class="section-content tool-fields">
        ${pathPicker('adv-freq-path')}
        <div class="config-group"><label>操作</label><input class="text-input" type="text" id="adv-freq-op" placeholder="prune_rare / promote_frequent"></div>
        <div class="config-group"><label>阈值</label><input class="text-input" type="number" id="adv-freq-threshold" value="3" min="0"></div>
        ${boolCard('adv-freq-backup', '应用前自动备份', true)}
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" onclick="runAdvFrequencyPreview()">预览</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="runAdvFrequencyApply()">应用（写）</button>
      </div>
      <div id="adv-freq-result" style="margin-top:16px;"></div>`;
  }

  function frequencyParams() {
    return {
      dir: $('#adv-freq-path')?.value?.trim() || '',
      operation: $('#adv-freq-op')?.value?.trim() || '',
      threshold: Number($('#adv-freq-threshold')?.value || 3) || 3,
      create_backup: $('#adv-freq-backup')?.checked ?? true,
    };
  }

  async function runAdvFrequencyPreview() {
    const params = frequencyParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-freq-result', '预览中...');
    try {
      const data = unwrap(await api.frequencyBatchPreview(params));
      const s = data.summary || {};
      setResult('adv-freq-result', `<div class="module-list">
        <div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>频率批量预览</strong>
        <span class="module-list-meta">将改: ${s.changed_count ?? '-'} / 扫描 ${s.scanned_caption_count ?? '-'}</span></div></div>
        ${samplesList(data.samples)}</div>`);
    } catch (error) { errorBox('adv-freq-result', error); }
  }

  async function runAdvFrequencyApply() {
    const params = frequencyParams();
    if (!params.dir) { showToast('请先填写数据集路径。'); return; }
    busy('adv-freq-result', '应用中...');
    try {
      const data = unwrap(await api.frequencyBatchApply(params));
      setResult('adv-freq-result', `<div class="builtin-picker-empty"><span>频率批量已应用，改写 ${data.modified_count ?? 0} 个文件。</span></div>`);
      showToast('频率批量已应用。');
    } catch (error) { errorBox('adv-freq-result', error); }
  }


  return {
    segments: {
      pipeline: segPipeline,
      ensemble: segEnsemble,
      structure: segStructure,
      dedupe: segDedupe,
      contentscan: segContentScan,
      cachehealth: segCacheHealth,
      frequency: segFrequency,
    },
    runAdvPipelinePlan,
    runAdvPipelineRun,
    runAdvEnsemblePreview,
    runAdvEnsembleApply,
    runAdvStructurePreview,
    runAdvStructureApply,
    runAdvDedupe,
    runAdvDedupePlan,
    runAdvDedupeQuarantine,
    runAdvContentScan,
    runAdvContentQuarantine,
    runAdvCacheHealthReport,
    runAdvCacheHealthPlan,
    runAdvCacheHealthQuarantine,
    runAdvFrequencyPreview,
    runAdvFrequencyApply,
  };
}

