// renderers/preflight.js — 训练预检相关渲染
// 7 个函数：renderPreflightDetail, renderPreflightOverviewPanel, renderPreflightActionPanel,
//          renderPreflightReport, _pfTag, renderPreflightPanel (数据集预览), _pfMetric
//
// 依赖（工厂注入）：state, escapeHtml, _ico, deps.renderStatusDeck（通过 deps 对象延迟解析，
// 解决与 statusDeck 的循环依赖）

import { escapeHtml, _ico } from '../utils/dom.js';
import { renderPcieTransferBenchmarkCard, renderUnifiedRecommendationCard } from '../utils/trainingMetrics.js';
import {
  collectAdvisorRecommendedConfigPatch,
  collectBackendRecommendedConfigPatch,
  recommendedConfigPatchKeys,
} from '../utils/preflightRecommendedPatch.js';

export function createPreflightRenderer({ state, deps }) {
  function _renderStatusDeck() { return deps.renderStatusDeck ? deps.renderStatusDeck() : ''; }
  function renderPreflightDetail() {
    if (!state.preflight) return '在训练前建议运行一遍训练预检';
    if (state.preflight.can_start) {
      const w = state.preflight.warnings || [];
      return w.length ? `${w.length} 个警告（点击"训练预检"查看详情）` : '全部通过，可以启动训练';
    }
    const errors = state.preflight.errors || [];
    if (!errors.length) return '训练预检未通过';
    return `${errors.length} 个错误（点击"训练预检"查看详情）`;
  }

  function renderPreflightActionPanel() {
    const isRunning = state.loading.preflight;
    const isBenchmarkRunning = state.loading.pcieTransferBenchmark;
    const benchmarkCard = renderPcieTransferBenchmarkCard(state.pcieTransferBenchmark, {
      loading: isBenchmarkRunning,
      error: state.pcieTransferBenchmarkError,
      title: 'PCIe 传输格式 Benchmark',
    });
    const recommendationCard = renderUnifiedRecommendationCard(
      { pcieTransferBenchmark: state.pcieTransferBenchmark },
      { title: '预检总推荐' },
    );
    return `
      <div class="section-toolbar preflight-action-panel">
        <div class="toolbar-actions toolbar-check-actions">
          <button class="btn btn-outline btn-check" type="button" onclick="runPreflight()" style="width:100%;" ${isRunning ? 'disabled' : ''}>
            <span class="btn-check-label">${isRunning ? '正在预检...' : '运行训练预检'}</span>
            <span class="btn-check-desc">检测运行环境 + 检查数据集路径、底模路径等参数</span>
          </button>
          <button class="btn btn-outline btn-check" type="button" onclick="runPcieTransferBenchmark()" style="width:100%;margin-top:8px;" ${isBenchmarkRunning ? 'disabled' : ''}>
            <span class="btn-check-label">${isBenchmarkRunning ? '正在测试...' : '运行 PCIe 传输格式 Benchmark'}</span>
            <span class="btn-check-desc">手动测试本机 CPU→GPU 传输格式，给出推荐格式，不会自动改训练配置</span>
          </button>
          <button class="btn btn-outline btn-check" type="button" onclick="runPcieTransferBenchmark({ include_tensorcore_decode: true, tensorcore_decode_shape_preset: 'real_linear_short', tensorcore_decode_iters: 3, tensorcore_decode_warmup: 1, tensorcore_decode_pack_iters: 1 })" style="width:100%;margin-top:8px;" ${isBenchmarkRunning ? 'disabled' : ''}>
            <span class="btn-check-label">${isBenchmarkRunning ? '正在测试...' : '运行 TC FP8 Decode 短测'}</span>
            <span class="btn-check-desc">按真实 Linear 短形状测试 tc_fp8_tile_v1 原型，只显示研究结果，不参与推荐排序</span>
          </button>
        </div>
        ${benchmarkCard || recommendationCard ? `<div style="margin-top:8px;">${benchmarkCard}${recommendationCard}</div>` : ''}
      </div>
    `;
  }

  function renderPreflightOverviewPanel() {
    return `
      <details class="form-section collapsible-panel preflight-overview-panel">
        <summary class="section-header collapsible-summary preflight-overview-summary">
          <span class="collapsible-summary-main">
            <span class="collapsible-title">训练预检</span>
            <span class="collapsible-desc">运行环境、注意力后端、预检状态、任务状态和预检操作</span>
          </span>
          <span class="collapsible-caret" aria-hidden="true">⌄</span>
        </summary>
        <div class="preflight-overview-body">
          <div class="status-deck" id="status-deck">${_renderStatusDeck()}</div>
          ${renderPreflightActionPanel()}
        </div>
      </details>
    `;
  }

  function _pfTag(label, value, type) {
    var color = type === 'err' ? 'var(--danger)' : (type === 'warn' ? 'var(--warning)' : 'var(--text-main)');
    return '<div class="preflight-tag"><span class="preflight-tag-label">' + label + '</span><span class="preflight-tag-value" style="color:' + color + ';">' + value + '</span></div>';
  }

  function _formatPreflightIssue(issue) {
    if (issue == null) return '';
    if (typeof issue === 'string') return issue;
    if (typeof issue !== 'object') return String(issue);
    if (Array.isArray(issue)) {
      return issue.map(_formatPreflightIssue).filter(Boolean).join('; ');
    }
    var msg = '';
    ['message', 'detail', 'reason', 'error'].some(function(key) {
      if (issue[key] == null) return false;
      msg = _formatPreflightIssue(issue[key]).trim();
      return !!msg;
    });
    var code = String(issue.code || '').trim();
    if (msg && code) return msg + ' [' + code + ']';
    if (msg) return msg;
    if (Array.isArray(issue.errors) && issue.errors.length) {
      var errors = issue.errors.map(_formatPreflightIssue).filter(Boolean).join('; ');
      if (errors) return errors;
    }
    if (Array.isArray(issue.issues) && issue.issues.length) {
      var issues = issue.issues.map(_formatPreflightIssue).filter(Boolean).join('; ');
      if (issues) return issues;
    }
    try {
      return JSON.stringify(issue);
    } catch (_e) {
      return String(issue);
    }
  }


  function _advisorModuleTag(label, moduleState) {
    var enabled = !!(moduleState && (moduleState.enabled || moduleState.status === 'covered_by_module_offload'));
    return _pfTag(label, enabled ? '已配置' : '未启用', enabled ? 'ok' : '');
  }

  function _advisorResearchTag(label, moduleState) {
    if (!moduleState) return _pfTag(label, '未知', 'warn');
    var requested = !!(moduleState.requested || moduleState.enabled);
    var status = String(moduleState.status || '');
    var value = '未启用';
    var tone = '';
    if (requested && status === 'requested_unwired') {
      value = '已请求·未接线';
      tone = 'warn';
    } else if (requested && status === 'manual_experimental') {
      value = '已启用';
      tone = 'warn';
    } else if (requested && status === 'partial_experimental') {
      value = '请求已发出';
      tone = 'warn';
    } else if (requested) {
      value = '研究请求';
      tone = 'warn';
    } else if (status === 'available_unwired') {
      value = '未接线';
      tone = 'warn';
    } else if (status === 'available_manual') {
      value = '可手动启用';
    } else if (status === 'partial_experimental') {
      value = '部分接线';
      tone = 'warn';
    }
    return _pfTag(label, value, tone);
  }

  function _wan22A14bVramEvidence(vram) {
    var config = state.config || {};
    var isA14b = state.activeTrainingType === 'wan22-t2v-a14b-lora'
      || String(config.wan22_model_variant || '').toLowerCase() === 't2v-a14b';
    if (!isA14b) return { applies: false, verified: true };
    var status = String(vram.evidence_status || vram.verification_status || '').trim().toLowerCase();
    var source = String(vram.evidence_source || '').trim().toLowerCase();
    var verified = ['verified', 'measured'].includes(status) && source.includes('real_trainer');
    return { applies: true, verified };
  }

  function _renderAdvisorSummary(advisor) {
    if (!advisor || !advisor.available) return '';
    var summary = advisor.summary || {};
    var aTier = advisor.a_tier || {};
    var bTier = advisor.b_tier || {};
    var modules = aTier.modules || {};
    var bModules = bTier.modules || {};
    var findings = advisor.findings || [];
    var vram = advisor.vram || {};
    var ditRuntime = (vram.dit_runtime && typeof vram.dit_runtime === 'object') ? vram.dit_runtime : null;
    var compileToken = (advisor.compile_token && typeof advisor.compile_token === 'object') ? advisor.compile_token : null;
    var dataset = advisor.dataset || {};
    var patch = collectAdvisorRecommendedConfigPatch({ training_advisor: advisor });
    var patchKeys = recommendedConfigPatchKeys(patch);
    var a14bEvidence = _wan22A14bVramEvidence(vram);
    var summaryStatus = String(summary.status || 'ok');
    if (a14bEvidence.applies && !a14bEvidence.verified && summaryStatus !== 'error') summaryStatus = 'warning';
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
    html += '<summary class="preflight-group-title">' + _ico('activity', 14) + ' 训练 Advisor（S/A/B 级）<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('状态', summaryStatus, summaryStatus === 'error' ? 'err' : (summaryStatus === 'warning' ? 'warn' : 'ok'));
    html += _pfTag('发现项', findings.length || summary.finding_count || 0);
    if (a14bEvidence.applies) {
      html += _pfTag('A14B显存证据', a14bEvidence.verified ? '已实测' : '未验证', a14bEvidence.verified ? 'ok' : 'warn');
      html += _pfTag('估算性质', a14bEvidence.verified ? '实测校准' : '启发式', a14bEvidence.verified ? 'ok' : 'warn');
    }
    if (vram.estimated_gb != null) {
      var estimateTone = vram.safety === 'danger' ? 'err' : ((vram.safety === 'tight' || (a14bEvidence.applies && !a14bEvidence.verified)) ? 'warn' : '');
      html += _pfTag(a14bEvidence.applies && !a14bEvidence.verified ? '公式估算' : '估算显存', vram.estimated_gb + ' GB', estimateTone);
    }
    if (ditRuntime && ditRuntime.available) {
      var ditMode = String(ditRuntime.mode || 'resident');
      var ditRecommendation = String(ditRuntime.recommendation || ditMode);
      html += _pfTag('DiT驻留', ditMode, ditRuntime.risk ? 'warn' : '');
      if (ditRuntime.strategy) html += _pfTag('驻留策略', String(ditRuntime.strategy), ditRuntime.risk ? 'warn' : '');
      if (ditRuntime.full_token_resident_pressure) html += _pfTag('Resident压力', '高', 'warn');
      if (ditRuntime.auto_min_parameter_count) html += _pfTag('Offload阈值', '自动', '');
      if (ditRuntime.prefetch_available) {
        var prefetchEnabled = !!ditRuntime.prefetch_enabled;
        html += _pfTag('Prefetch', prefetchEnabled ? 'on' : 'off', prefetchEnabled ? 'ok' : '');
        if (prefetchEnabled) html += _pfTag('Prefetch深度', ditRuntime.prefetch_depth == null ? 1 : ditRuntime.prefetch_depth, '');
      }
      if (ditRecommendation !== ditMode) html += _pfTag('DiT建议', ditRecommendation, 'warn');
    }
    if (compileToken && compileToken.available) {
      var compileStatus = String(compileToken.status || 'off');
      var compileTone = compileStatus === 'warning' || compileStatus === 'disabled' ? 'warn' : (compileStatus === 'ready' ? 'ok' : '');
      html += _pfTag('Compile', String(compileToken.resolved || compileToken.requested || 'off'), compileTone);
      if (compileToken.compile_active) {
        html += _pfTag('Token形状', compileToken.token_shape_safe ? '稳定' : '需检查', compileToken.token_shape_safe ? 'ok' : 'warn');
      }
      if (compileToken.no_pad_visual_bucket) html += _pfTag('视觉Bucket', 'no-pad', 'ok');
    }
    if (dataset.image_count != null) html += _pfTag('Advisor图片', dataset.image_count || 0);
    html += _advisorModuleTag('Vortex融合', modules.memory_vortex_fusion);
    html += _advisorModuleTag('Block Weight', modules.block_weight);
    html += _advisorModuleTag('Smart Rank', modules.smart_rank);
    html += _advisorModuleTag('Auto Controller', modules.auto_controller);
    html += _advisorModuleTag('EMA', modules.ema);
    html += _advisorModuleTag('Masked Loss', modules.masked_loss);
    html += _advisorModuleTag('Smart Caption', modules.smart_caption);
    html += _advisorModuleTag('Bucket', modules.dataset_bucket);
    html += _advisorResearchTag('Hutchinson', bModules.hutchinson_scan);
    html += _advisorResearchTag('PCGrad', bModules.pcgrad);
    html += _advisorResearchTag('Ghost Replay', bModules.ghost_replay);
    html += _advisorResearchTag('Geometric Lock', bModules.manifold_constraint);
    html += '</div>';
    if (a14bEvidence.applies && !a14bEvidence.verified) {
      html += '<div class="preflight-item preflight-warning">Wan2.2 A14B 的当前显存数字仅为启发式公式，不能据此承诺 16GB/24GB 可训练；需 high/low 单塔真实训练步完成后再升级为实测结论。</div>';
    }
    if (patchKeys.length) {
      html += '<div class="preflight-item preflight-note">建议修改: ' + escapeHtml(patchKeys.slice(0, 8).join(', ') + (patchKeys.length > 8 ? '...' : '')) + '</div>';
      html += '<button class="btn btn-outline btn-sm" type="button" onclick="applyTrainingAdvisorPatch()" style="margin-top:8px;">' + _ico('check-circle', 14) + ' 手动应用预检/Advisor 建议</button>';
    }
    if (findings.length) {
      findings.slice(0, 5).forEach(function(f) {
        var severity = String((f && f.severity) || 'info');
        var cls = severity === 'error' ? 'preflight-error' : (severity === 'warning' ? 'preflight-warning' : 'preflight-note');
        var message = String((f && (f.message || f.code)) || '');
        var suggestion = String((f && f.suggestion) || '');
        html += '<div class="preflight-item ' + cls + '">' + escapeHtml(message + (suggestion ? ' - ' + suggestion : '')) + '</div>';
      });
    }
    if (ditRuntime && ditRuntime.available) {
      var ditNotes = Array.isArray(ditRuntime.notes) ? ditRuntime.notes : [];
      ditNotes.slice(0, 2).forEach(function(n) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(n) + '</div>';
      });
      if (ditRuntime.benchmark_basis) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(String(ditRuntime.benchmark_basis)) + '</div>';
      }
      if (ditRuntime.prefetch_note) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(String(ditRuntime.prefetch_note)) + '</div>';
      }
    }
    if (compileToken && compileToken.available) {
      var compileNotes = [];
      if (Array.isArray(compileToken.notes)) compileNotes = compileNotes.concat(compileToken.notes);
      if (Array.isArray(compileToken.reasons)) compileNotes = compileNotes.concat(compileToken.reasons);
      if (Array.isArray(compileToken.warnings)) compileNotes = compileNotes.concat(compileToken.warnings);
      compileNotes.slice(0, 3).forEach(function(n) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(n) + '</div>';
      });
    }
    if (aTier.notes && aTier.notes.length) {
      aTier.notes.slice(0, 4).forEach(function(n) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(n) + '</div>';
      });
    }
    if (bTier.notes && bTier.notes.length) {
      bTier.notes.slice(0, 4).forEach(function(n) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(n) + '</div>';
      });
    }
    html += '<div class="preflight-item preflight-note">预检/Advisor 只生成报告；只有点击上方按钮才会写入当前配置草稿，不会自动开始训练。</div>';
    html += '</details>';
    return html;
  }

  function _renderBackendRecommendedPatch(preflight) {
    var patch = collectBackendRecommendedConfigPatch(preflight);
    var patchKeys = recommendedConfigPatchKeys(patch);
    if (!patchKeys.length) return '';

    var actions = [];
    if (Array.isArray(preflight.repair_actions)) actions = actions.concat(preflight.repair_actions);
    if (Array.isArray(preflight.repair_plan && preflight.repair_plan.repair_actions)) {
      actions = actions.concat(preflight.repair_plan.repair_actions);
    }
    var action = actions.find(function(item) { return item && item.code === 'preflight.apply_recommended_config_patch'; });
    var risk = action && action.estimated_risk ? String(action.estimated_risk) : 'medium';
    var title = action && (action.title_zh || action.title_en) ? String(action.title_zh || action.title_en) : '应用推荐训练配置';
    var message = action && action.message ? String(action.message) : '后端预检根据当前配置生成了推荐 patch。';
    var preview = patchKeys.slice(0, 10).join(', ') + (patchKeys.length > 10 ? '...' : '');

    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('check-circle', 14) + ' 预检推荐配置<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('建议项', patchKeys.length, 'warn');
    html += _pfTag('风险', risk, risk === 'high' ? 'err' : (risk === 'medium' ? 'warn' : 'ok'));
    html += '</div>';
    html += '<div class="preflight-item preflight-warning">' + escapeHtml(title + ': ' + message) + '</div>';
    html += '<div class="preflight-item preflight-note">将修改: ' + escapeHtml(preview) + '</div>';
    html += '<button class="btn btn-outline btn-sm" type="button" onclick="applyTrainingAdvisorPatch()" style="margin-top:8px;">' + _ico('check-circle', 14) + ' 应用预检推荐配置</button>';
    html += '<div class="preflight-item preflight-note">这是 report-only 建议；点击按钮只写入当前配置草稿，不会自动开始训练。</div>';
    html += '</details>';
    return html;
  }

  function _renderModelAcceleration(profile) {
    if (!profile || typeof profile !== 'object' || !profile.available) return '';
    var patch = profile.recommended_config_patch || {};
    var patchKeys = recommendedConfigPatchKeys(patch);
    var tracks = Array.isArray(profile.tracks) ? profile.tracks : [];
    var skipped = Array.isArray(profile.skipped) ? profile.skipped : [];
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('zap', 14) + ' 模型加速策略<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('模型', profile.model_family || 'unknown');
    html += _pfTag('档位', profile.effective_profile || profile.requested_profile || 'off', profile.effective_profile === 'aggressive' ? 'warn' : '');
    html += _pfTag('推荐项', patchKeys.length, patchKeys.length ? 'warn' : 'ok');
    html += _pfTag('保留显式项', skipped.length, skipped.length ? 'ok' : '');
    html += '</div>';
    if (patchKeys.length) html += '<div class="preflight-item preflight-note">将建议: ' + escapeHtml(patchKeys.slice(0, 10).join(', ') + (patchKeys.length > 10 ? '...' : '')) + '</div>';
    tracks.slice(0, 8).forEach(function(track) {
      var status = String((track && track.status) || 'recommended');
      var cls = status === 'preserved' ? 'preflight-note' : 'preflight-warning';
      var name = String((track && track.name) || 'track');
      var msg = String((track && track.message) || status);
      html += '<div class="preflight-item ' + cls + '">' + escapeHtml(name + ': ' + msg) + '</div>';
    });
    html += '<div class="preflight-item preflight-note">该策略只接管档位允许的字段；训练启动后仍会经过 compile、attention、optimizer 的运行时安全门。</div>';
    html += '</details>';
    return html;
  }

  function _renderPrecisionSwapProfile(profile) {
    if (!profile || typeof profile !== 'object') return '';
    var selected = Array.isArray(profile.selected_names) ? profile.selected_names : [];
    var selectedText = selected.length ? selected.join(', ') : '未选择';
    var source = profile.profile_source || 'static';
    var resolution = Array.isArray(profile.resolution) ? profile.resolution.join('x') : '—';
    var hint = Number(profile.selected_activation_hint_mb || 0);
    var params = Number(profile.selected_parameter_mb || 0);
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('activity', 14) + ' Lulynx Precision Swap<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('策略', profile.strategy || 'balanced');
    html += _pfTag('后端', profile.backend || 'suffix_block_swap');
    html += _pfTag('分辨率', resolution);
    html += _pfTag('Profile', source);
    html += _pfTag('选中单元', String(profile.selected_count || selected.length || 0) + ' / ' + String(profile.units_total || 0));
    html += _pfTag('BlockSwap 数量', profile.compatible_blocks_to_swap || 0);
    html += _pfTag('参数量', params > 0 ? params.toFixed(1) + ' MB' : '运行时统计');
    html += _pfTag('激活 Hint', hint > 0 ? hint.toFixed(1) + ' MB' : '—');
    html += '</div>';
    html += '<div class="preflight-item preflight-note">选中: ' + escapeHtml(selectedText) + '</div>';
    if (source === 'preflight_static') {
      html += '<div class="preflight-item preflight-note">预检阶段不会加载模型；参数量会在训练启动后由运行时 profile 补齐。</div>';
    }
    html += '</details>';
    return html;
  }

  function _renderNativeUnetProfile(profile) {
    if (!profile || typeof profile !== 'object') return '';
    var coverage = (profile.native_coverage && typeof profile.native_coverage === 'object') ? profile.native_coverage : {};
    var probe = (profile.native_forward_probe && typeof profile.native_forward_probe === 'object')
      ? profile.native_forward_probe
      : ((coverage.native_forward_probe && typeof coverage.native_forward_probe === 'object') ? coverage.native_forward_probe : {});
    var probeOk = !!(profile.native_forward_probe_ok || coverage.native_forward_probe_ok || probe.ok);
    var available = !!profile.available;
    var mode = profile.mode || 'shadow';
    var blocks = profile.blocks_total || coverage.implemented_top_blocks || 0;
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('cpu', 14) + ' Native SDXL U-Net<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('后端', profile.backend || 'diffusers');
    html += _pfTag('模式', mode);
    html += _pfTag('Skeleton', available ? '可用' : '不可用', available ? 'ok' : 'warn');
    html += _pfTag('Forward Probe', probeOk ? '通过' : '未通过', probeOk ? 'ok' : 'warn');
    html += _pfTag('Top Blocks', blocks || '—');
    html += _pfTag('训练接管', profile.native_forward_integrated ? '已接管' : '未接管');
    html += '</div>';
    if (probe.output_shape) {
      html += '<div class="preflight-item preflight-note">Probe 输出: ' + escapeHtml(String(probe.output_shape.join ? probe.output_shape.join('x') : probe.output_shape)) + '</div>';
    }
    if (profile.message) {
      html += '<div class="preflight-item preflight-warning">' + escapeHtml(profile.message) + '</div>';
    } else {
      html += '<div class="preflight-item preflight-note">当前为诊断/对照入口；除 native_proxy 外不会替换训练 U-Net。</div>';
    }
    html += '</details>';
    return html;
  }

  function _renderStepBreakdown(report) {
    if (!report || typeof report !== 'object' || !report.available) return '';
    var images = report.images || {};
    var repeats = report.repeats || {};
    var regularization = report.regularization || {};
    var buckets = report.buckets || {};
    var batch = report.batch || {};
    var epochs = report.epochs || {};
    var assumptions = Array.isArray(report.assumptions) ? report.assumptions : [];
    var unknowns = Array.isArray(report.unknowns) ? report.unknowns : [];
    var entries = Array.isArray(buckets.entries) ? buckets.entries : [];
    var dropLastLabel = report.drop_last_confidence === 'range'
      ? '待运行时决议'
      : (buckets.drop_last ? '丢弃尾批' : '保留尾批');
    var stepLabel = epochs.estimated_optimizer_steps == null
      ? String(epochs.optimizer_steps_min == null ? '?' : epochs.optimizer_steps_min) + '-' + String(epochs.optimizer_steps_max == null ? '?' : epochs.optimizer_steps_max)
      : epochs.estimated_optimizer_steps;
    var epochStepLabel = epochs.steps_per_epoch == null
      ? String(epochs.steps_per_epoch_min == null ? '?' : epochs.steps_per_epoch_min) + '-' + String(epochs.steps_per_epoch_max == null ? '?' : epochs.steps_per_epoch_max)
      : epochs.steps_per_epoch;
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('activity', 14) + ' 训练步数拆解<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('模型族', report.family || 'unknown');
    html += _pfTag('原始图片', images.discovered == null ? '未知' : images.discovered);
    html += _pfTag('运行时样本', images.runtime_samples == null ? '未知' : images.runtime_samples);
    html += _pfTag('训练/验证', String(images.train_samples || 0) + ' / ' + String(images.validation_samples || 0));
    html += _pfTag('声明重复后', repeats.declared_effective_samples == null ? '未知' : repeats.declared_effective_samples, repeats.runtime_consumed ? 'ok' : 'warn');
    html += _pfTag('正则图片', regularization.images == null ? '未知' : regularization.images, regularization.requested ? 'warn' : '');
    html += _pfTag('Bucket', String(buckets.count || 0) + ' 个');
    html += _pfTag('尾批', String(buckets.tail_bucket_count || 0) + ' 个 / ' + String(buckets.tail_samples || 0) + ' 样本');
    html += _pfTag('每卡 Batch', batch.per_device || 1);
    html += _pfTag('World Size', batch.world_size || 1);
    html += _pfTag('GPU 选择', batch.selected_gpu_count == null ? '自动/未知' : String(batch.selected_gpu_count) + ' 张');
    html += _pfTag('梯度累积', batch.gradient_accumulation || 1);
    html += _pfTag('全局有效 Batch', batch.global_effective_batch || 1);
    html += _pfTag('Epoch', epochs.requested || 0);
    html += _pfTag('尾批策略', dropLastLabel, report.drop_last_confidence === 'range' ? 'warn' : '');
    html += _pfTag('每 Epoch 步数', epochStepLabel, epochs.steps_per_epoch == null ? 'warn' : '');
    html += _pfTag('预计优化器步数', stepLabel, epochs.estimated_optimizer_steps == null ? 'warn' : 'accent');
    html += '</div>';
    if (!repeats.runtime_consumed && Number(repeats.declared_extra_samples || 0) > 0) {
      html += '<div class="preflight-item preflight-warning">检测到目录 repeats 声明，但当前运行时 Dataset 未展开；预计步数按实际运行时样本计算。</div>';
    }
    if (regularization.requested && regularization.runtime_consumption !== 'auxiliary_per_microbatch') {
      html += '<div class="preflight-item preflight-warning">' + escapeHtml(String(regularization.note || '正则数据未进入当前运行时。')) + '</div>';
    }
    if (entries.length) {
      var bucketText = entries.slice(0, 12).map(function(entry) {
        var keepBatches = entry.microbatches_keep;
        var dropBatches = entry.microbatches_drop;
        var microbatches = entry.microbatches == null
          ? (keepBatches == null || dropBatches == null
            ? '?'
            : String(Math.min(keepBatches, dropBatches)) + '-' + String(Math.max(keepBatches, dropBatches)))
          : String(entry.microbatches || 0);
        var tail = Number(entry.tail_samples || 0) > 0 ? '，尾批 ' + entry.tail_samples : '';
        return String(entry.resolution || '?') + ': ' + String(entry.samples || 0) + ' 样本 / ' + microbatches + ' 批次' + tail;
      }).join('; ');
      html += '<div class="preflight-item preflight-note">Bucket: ' + escapeHtml(bucketText + (entries.length > 12 ? '; ...' : '')) + '</div>';
    }
    assumptions.concat(unknowns).slice(0, 6).forEach(function(note) {
      html += '<div class="preflight-item preflight-note">' + escapeHtml(String(note)) + '</div>';
    });
    html += '</details>';
    return html;
  }

  // ---------------------------------------------------------------------
  // 预检附加报告段（display-only）
  //
  // 这些段来自后端 training_preflight_adapter_reports.py，属于"看到就好"的观察项：
  // 它们只报告，永远不参与 can_start 判定。家族兼容段尤其如此——注册表里 58 个 schema
  // 有 8 个过不了那道门（sdxl-ileco / anima-ileco / sd-ileco / 三个 addift / yolo /
  // aesthetic-scorer），今天全都能跑，所以后端把它的判定降级成 warning 后才放进 issues。
  // ---------------------------------------------------------------------

  function _pfObject(value) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : null;
  }

  function _pfText(value) {
    return escapeHtml(String(value == null ? '' : value));
  }

  function _renderDatasetAuditSection(pf) {
    var health = _pfObject(pf.dataset_health);
    var audit = _pfObject(pf.dataset_audit);
    var auditFindings = audit
      ? [].concat(
        Array.isArray(audit.blocking_issues) ? audit.blocking_issues : [],
        Array.isArray(audit.non_blocking_issues) ? audit.non_blocking_issues : [],
      )
      : [];
    // An empty section is what a degraded build returns; keep the panel clean.
    if (!(health && (health.health_score != null || health.readiness)) && !auditFindings.length) return '';

    var readiness = health ? String(health.readiness || '') : '';
    var readinessTone = readiness === 'ready' ? 'ok' : (readiness === 'blocked' ? 'err' : (readiness ? 'warn' : ''));
    var readinessLabel = { ready: '就绪', warning: '可用（有警告）', blocked: '存在阻塞项' }[readiness] || readiness || '未知';
    var counts = (health && _pfObject(health.finding_counts)) || {};

    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('shield', 14) + ' 数据集审计<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    if (health && health.health_score != null) {
      html += _pfTag('健康分', health.health_score, Number(health.health_score) >= 80 ? 'ok' : 'warn');
    }
    html += _pfTag('就绪度', _pfText(readinessLabel), readinessTone);
    if (counts.blocking != null) html += _pfTag('阻塞项', counts.blocking, Number(counts.blocking) > 0 ? 'err' : 'ok');
    if (counts.non_blocking != null) html += _pfTag('非阻塞项', counts.non_blocking, Number(counts.non_blocking) > 0 ? 'warn' : '');
    if (counts.warnings != null) html += _pfTag('检查警告', counts.warnings, Number(counts.warnings) > 0 ? 'warn' : '');
    if (counts.recommended_actions != null) html += _pfTag('建议动作', counts.recommended_actions, Number(counts.recommended_actions) > 0 ? 'warn' : '');
    html += '</div>';

    var blocking = audit && Array.isArray(audit.blocking_issues) ? audit.blocking_issues : [];
    var nonBlocking = audit && Array.isArray(audit.non_blocking_issues) ? audit.non_blocking_issues : [];
    var actions = (audit && Array.isArray(audit.recommended_actions) ? audit.recommended_actions : [])
      .concat(health && Array.isArray(health.recommended_actions) ? health.recommended_actions : []);

    blocking.slice(0, 4).forEach(function(issue) {
      html += '<div class="preflight-item preflight-warning">' + _pfText(_formatPreflightIssue(issue)) + '</div>';
    });
    nonBlocking.slice(0, 4).forEach(function(issue) {
      html += '<div class="preflight-item preflight-note">' + _pfText(_formatPreflightIssue(issue)) + '</div>';
    });
    var seenActions = {};
    actions.slice(0, 4).forEach(function(action) {
      var code = String((action && action.code) || '');
      var message = String((action && action.message) || '');
      var key = code + '|' + message;
      if (!message || seenActions[key]) return;
      seenActions[key] = true;
      html += '<div class="preflight-item preflight-note">建议: ' + _pfText(message + (code ? ' [' + code + ']' : '')) + '</div>';
    });
    if (blocking.length > 4 || nonBlocking.length > 4) {
      html += '<div class="preflight-item preflight-note">另有 ' + (blocking.length - 4 > 0 ? blocking.length - 4 : 0) + ' 条阻塞项、' + (nonBlocking.length - 4 > 0 ? nonBlocking.length - 4 : 0) + ' 条非阻塞项未展开。</div>';
    }
    html += '<div class="preflight-item preflight-note">数据集审计只报告，不阻止启动训练。</div>';
    html += '</details>';
    return html;
  }

  function _renderStagePlan(report) {
    if (!_pfObject(report)) return '';
    var stages = Array.isArray(report.stages) ? report.stages : [];
    if (!stages.length && !(Array.isArray(report.blockers) && report.blockers.length)) return '';
    var blockers = Array.isArray(report.blockers) ? report.blockers : [];
    var skipped = Array.isArray(report.skipped) ? report.skipped : [];
    var gpuStages = Array.isArray(report.gpu_stages) ? report.gpu_stages : [];

    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
    html += '<summary class="preflight-group-title">' + _ico('layout', 14) + ' 训练阶段计划<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('阶段', stages.length);
    html += _pfTag('需要 GPU', gpuStages.length, gpuStages.length ? 'accent' : '');
    html += _pfTag('跳过', skipped.length, skipped.length ? 'warn' : '');
    if (report.dataset_images != null) html += _pfTag('数据集图片', report.dataset_images);
    html += _pfTag('时长估计', _pfText(report.duration_estimate || 'unknown'), 'warn');
    html += '</div>';

    if (blockers.length) {
      blockers.forEach(function(blocker) {
        html += '<div class="preflight-item preflight-warning">' + _pfText(blocker) + '</div>';
      });
    }
    stages.forEach(function(stage) {
      var runs = stage && stage.runs !== false;
      var label = String((stage && stage.label) || (stage && stage.key) || 'stage');
      var reason = String((stage && stage.reason) || '');
      var writes = String((stage && stage.writes) || '');
      var source = String((stage && stage.source) || '');
      var head = (stage && stage.order ? stage.order + '. ' : '') + label;
      var meta = [];
      if (!runs && reason) meta.push('跳过：' + reason);
      if (writes) meta.push('写入 ' + writes);
      if (source) meta.push(source);
      html += '<div class="preflight-item ' + (runs ? 'preflight-note' : 'preflight-warning') + '">'
        + _pfText(head) + (meta.length ? ' — ' + _pfText(meta.join('；')) : '') + '</div>';
    });
    if (report.duration_note) {
      html += '<div class="preflight-item preflight-note">' + _pfText(report.duration_note) + '</div>';
    }
    html += '</details>';
    return html;
  }

  function _renderFamilyCompatibilityReport(report) {
    var fc = _pfObject(report);
    if (!fc || !fc.schema_id) return '';
    var family = _pfObject(fc.family) || {};
    var findings = []
      .concat(Array.isArray(fc.errors) ? fc.errors : [])
      .concat(Array.isArray(fc.warnings) ? fc.warnings : []);
    var ok = fc.ok !== false;

    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;" open>';
    html += '<summary class="preflight-group-title">' + _ico('package', 14) + ' 模型族兼容<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('判定', ok ? '一致' : '有差异', ok ? 'ok' : 'warn');
    if (fc.schema_id) html += _pfTag('Schema', _pfText(fc.schema_id));
    if (family.family_id) html += _pfTag('模型族', _pfText(family.family_id));
    if (family.training_type) html += _pfTag('训练类型', _pfText(family.training_type));
    if (Array.isArray(family.supported_training_types) && family.supported_training_types.length) {
      html += _pfTag('族声明支持', _pfText(family.supported_training_types.join(' / ')), ok ? '' : 'warn');
    }
    html += '</div>';
    findings.slice(0, 6).forEach(function(item) {
      html += '<div class="preflight-item ' + (ok ? 'preflight-note' : 'preflight-warning') + '">' + _pfText(_formatPreflightIssue(item)) + '</div>';
    });
    if (!ok) {
      html += '<div class="preflight-item preflight-note">这条判定不阻止启动：族注册表的声明可能与实际训练路径不一致，以运行时结果为准。</div>';
    }
    html += '</details>';
    return html;
  }

  function _renderResumeAndLockReport(pf) {
    var resume = _pfObject(pf.resume);
    var checkpoints = _pfObject(pf.checkpoint_info);
    var lock = _pfObject(pf.lock_check);
    if (!resume && !checkpoints && !lock) return '';

    var count = resume && resume.checkpoint_count != null
      ? resume.checkpoint_count
      : (checkpoints && checkpoints.checkpoint_count != null ? checkpoints.checkpoint_count : null);
    var suggested = (resume && resume.suggested_resume) || (checkpoints && checkpoints.suggested_resume) || '';
    var hasSomething = Number(count || 0) > 0 || suggested || (resume && (resume.output_collision || resume.valid === false)) || lock;
    if (!hasSomething) return '';

    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
    html += '<summary class="preflight-group-title">' + _ico('refresh-cw', 14) + ' 续训检查点<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    if (count != null) html += _pfTag('检查点', count, Number(count) > 0 ? 'ok' : '');
    if (resume && resume.resume_field_type) html += _pfTag('续训字段', _pfText(resume.resume_field_type));
    if (resume && resume.resume_path) html += _pfTag('续训路径', _pfText(resume.resume_path));
    if (resume && resume.output_collision) html += _pfTag('输出目录', '已有产物', 'warn');
    if (resume && resume.valid === false) html += _pfTag('续训校验', _pfText(resume.message || '未通过'), 'err');
    html += '</div>';
    if (suggested) {
      html += '<div class="preflight-item preflight-note">建议续训候选: ' + _pfText(suggested) + '</div>';
    }
    if (lock) {
      var status = String(lock.status || '');
      var lockLabel = {
        matched: '一致', missing: '未发现锁文件', invalid: '报文无效', unsupported: '暂不支持校验',
      }[status] || status || '未知';
      var lockTone = status === 'matched' ? 'ok' : (status === 'missing' ? '' : 'warn');
      html += '<div class="preflight-dataset-grid" style="margin-top:8px;">';
      html += _pfTag('配置锁', _pfText(lockLabel), lockTone);
      if (Array.isArray(lock.mismatches) && lock.mismatches.length) {
        html += _pfTag('不一致字段', lock.mismatches.length, 'warn');
      }
      html += '</div>';
      var lockMessages = []
        .concat(Array.isArray(lock.errors) ? lock.errors : [])
        .concat(Array.isArray(lock.warnings) ? lock.warnings : []);
      lockMessages.slice(0, 4).forEach(function(message) {
        html += '<div class="preflight-item ' + (status === 'matched' ? 'preflight-note' : 'preflight-warning') + '">' + _pfText(_formatPreflightIssue(message)) + '</div>';
      });
    }
    html += '</details>';
    return html;
  }

  function _renderFixedPreviewReport(report) {
    var preview = _pfObject(report);
    if (!preview) return '';
    var values = _pfObject(preview.values) || {};
    var validationSet = _pfObject(preview.fixed_prompt_validation_set) || {};
    var prompts = Array.isArray(validationSet.prompts) ? validationSet.prompts : [];
    var keys = Object.keys(values);
    if (!keys.length && !prompts.length) return '';

    var sourceLabels = {
      explicit_sample_prompt: '配置里显式指定的采样提示词',
      dataset_audit: '由数据集审计推导',
      route_family_fallback: '按模型族回退默认',
      normalized_config: '归一化后的配置',
    };
    var source = String(preview.source || validationSet.source || '');
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
    html += '<summary class="preflight-group-title">' + _ico('image', 14) + ' 本次运行的验证提示词<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += '<div class="preflight-dataset-grid">';
    html += _pfTag('来源', _pfText(sourceLabels[source] || source || '未知'), source === 'route_family_fallback' ? 'warn' : '');
    html += _pfTag('固定提示词', prompts.length);
    if (values.sample_sampler || values.sample_scheduler) html += _pfTag('采样器', _pfText(values.sample_sampler || values.sample_scheduler));
    if (values.sample_steps != null) html += _pfTag('采样步数', values.sample_steps);
    if (values.sample_cfg != null) html += _pfTag('CFG', values.sample_cfg);
    if (values.sample_seed != null) html += _pfTag('种子', values.sample_seed);
    html += '</div>';
    prompts.slice(0, 3).forEach(function(entry) {
      var prompt = String((entry && entry.prompt) || '');
      var reason = String((entry && entry.reason_selected) || '');
      html += '<div class="preflight-item preflight-note">' + _pfText(prompt + (reason ? '（' + reason + '）' : '')) + '</div>';
    });
    if (prompts.length > 3) {
      html += '<div class="preflight-item preflight-note">另有 ' + (prompts.length - 3) + ' 条未展开。</div>';
    }
    html += '<div class="preflight-item preflight-note">这些提示词在模型加载前就固定下来，训练与预览会用同一组，便于跨 epoch 比较。</div>';
    html += '</details>';
    return html;
  }

  function _renderRuntimeReports(pf) {
    var cost = _pfObject(pf.resource_cost);
    var geometry = _pfObject(pf.concept_geometry);
    var tensorboard = _pfObject(pf.tensorboard);
    var blocks = '';

    if (cost && cost.status) {
      var costStatus = String(cost.status);
      var costTone = costStatus === 'unsupported' || costStatus === 'insufficient_evidence' ? '' : 'warn';
      var costLabel = {
        unsupported: '本配置不适用', insufficient_evidence: '证据不足', unknown: '无法判定',
      }[costStatus] || costStatus;
      blocks += '<div class="preflight-dataset-grid">';
      blocks += _pfTag('驻留成本对照', _pfText(costLabel), costTone);
      if (cost.family) blocks += _pfTag('模型族', _pfText(cost.family));
      blocks += '</div>';
      if (cost.recommendation_reason) {
        blocks += '<div class="preflight-item preflight-note">' + _pfText(cost.recommendation_reason) + '</div>';
      }
    }

    if (geometry && geometry.enabled) {
      var inner = _pfObject(geometry.concept_geometry) || {};
      var risk = String(inner.risk || geometry.risk || 'unknown');
      blocks += '<div class="preflight-dataset-grid" style="margin-top:8px;">';
      blocks += _pfTag('Concept Geometry', risk === 'unknown' ? _pfText(risk) : _pfText(risk), risk === 'high' || risk === 'unavailable' ? 'warn' : 'ok');
      if (inner.geometry_attach_rate != null) blocks += _pfTag('附着率', Number(inner.geometry_attach_rate).toFixed(2), Number(inner.geometry_attach_rate) < 0.5 ? 'warn' : '');
      if (inner.concept_group_count != null) blocks += _pfTag('概念组', inner.concept_group_count);
      blocks += '</div>';
    }

    if (tensorboard && tensorboard.enabled) {
      blocks += '<div class="preflight-dataset-grid" style="margin-top:8px;">';
      blocks += _pfTag('TensorBoard', '已开启', 'ok');
      if (tensorboard.log_dir) blocks += _pfTag('日志目录', _pfText(tensorboard.log_dir));
      blocks += '</div>';
    }

    if (!blocks) return '';
    var html = '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
    html += '<summary class="preflight-group-title">' + _ico('cpu', 14) + ' 运行时附加报告<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
    html += blocks;
    html += '</details>';
    return html;
  }

  function renderPreflightReport() {
    const pf = state.preflight;
    if (!pf) return '';

    const errors = pf.errors || [];
    const warnings = pf.warnings || [];
    const notes = pf.notes || [];
    const ds = pf.dataset;
    const deps = pf.dependencies;
    const advisor = pf.training_advisor;
    const modelAcceleration = pf.model_acceleration;
    const precisionSwapProfile = pf.precision_swap_profile;
    const nativeUnetProfile = pf.native_unet_profile;
    const stepBreakdown = pf.step_breakdown;

    if (
      errors.length === 0
      && warnings.length === 0
      && notes.length === 0
      && !ds
      && !advisor
      && !modelAcceleration
      && !precisionSwapProfile
      && !nativeUnetProfile
      && !(stepBreakdown && stepBreakdown.available)
      && !pf.dataset_health
      && !pf.dataset_audit
      && !(pf.stage_plan && pf.stage_plan.stages && pf.stage_plan.stages.length)
      && !pf.family_compatibility
      && !pf.fixed_preview
      && !(pf.repair_actions && pf.repair_actions.length)
    ) {
      return '';
    }

    const canStart = pf.can_start;
    const borderColor = canStart ? (warnings.length > 0 ? 'var(--warning)' : 'var(--success)') : 'var(--danger)';
    const statusIcon = canStart ? (warnings.length > 0 ? _ico('alert-tri') : _ico('check-circle')) : _ico('x-circle');
    const statusText = canStart ? (warnings.length > 0 ? '预检通过（有警告）' : '预检通过') : '预检未通过';
    const statusColor = canStart ? (warnings.length > 0 ? 'var(--warning)' : 'var(--success)') : 'var(--danger)';

    let html = '<section class="form-section preflight-report-section" id="preflight-report" style="border-left:3px solid ' + borderColor + ';">';
    html += '<header class="section-header preflight-report-summary">';
   html += '<span class="collapsible-summary-main"><span class="collapsible-title">' + statusIcon + ' 训练预检报告</span>';
    html += '<span class="collapsible-desc" style="color:' + statusColor + ';">' + statusText + '</span></span>';
    html += '<span class="collapsible-actions"><button type="button" onclick="dismissPreflightReport()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:2px 6px;" title="关闭">×</button></span>';
    html += '</header>';
    html += '<div class="section-content" style="display:block;">';

    // 状态概览
    html += '<div style="font-weight:700;color:' + statusColor + ';margin-bottom:12px;">' + statusText + '</div>';

    if (errors.length > 0) {
      html += '<div class="preflight-group">';
      html += '<div class="preflight-group-title" style="color:var(--danger);">' + _ico('x-circle', 14) + ' 错误 (' + errors.length + ')</div>';
      errors.forEach(function(e) {
        html += '<div class="preflight-item preflight-error">' + escapeHtml(_formatPreflightIssue(e)) + '</div>';
      });
      html += '</div>';
    }

    // 警告列表
    if (warnings.length > 0) {
      html += '<div class="preflight-group">';
      html += '<div class="preflight-group-title" style="color:var(--warning);">' + _ico('alert-tri', 14) + ' 警告 (' + warnings.length + ')</div>';
      warnings.forEach(function(w) {
        html += '<div class="preflight-item preflight-warning">' + escapeHtml(_formatPreflightIssue(w)) + '</div>';
      });
      html += '</div>';
    }

    // 数据集摘要
    if (ds) {
      html += '<div class="preflight-group">';
      html += '<div class="preflight-group-title">' + _ico('folder', 14) + ' 数据集</div>';
      html += '<div class="preflight-dataset-grid">';
      html += _pfTag('图片数', ds.image_count|| 0);
      html += _pfTag('有效图片', ds.effective_image_count || 0);
      html += _pfTag('标注覆盖', ((ds.caption_coverage || 0) * 100).toFixed(0) + '%');
      if (ds.alpha_capable_image_count > 0) html += _pfTag('含透明通道', ds.alpha_capable_image_count);
      if (ds.broken_image_count > 0) html += _pfTag('损坏图片', ds.broken_image_count, 'err');
      if (ds.images_without_caption_count > 0) html +=_pfTag('缺少标注', ds.images_without_caption_count, 'warn');
      html += '</div></div>';
    }

    html += _renderStepBreakdown(stepBreakdown);

    // 后端报告段（display-only，永不参与 can_start）
    html += _renderDatasetAuditSection(pf);
    html += _renderStagePlan(pf.stage_plan);
    html += _renderFamilyCompatibilityReport(pf.family_compatibility);
    html += _renderResumeAndLockReport(pf);
    html += _renderFixedPreviewReport(pf.fixed_preview);
    html += _renderRuntimeReports(pf);

    // 依赖检测
    if (deps) {
      var missing = deps.missing || [];
      var required = deps.required || [];
      if (missing.length > 0 || required.length > 0) {
        html += '<div class="preflight-group">';
        html += '<div class="preflight-group-title">' + _ico('activity', 14) + ' 运行时依赖</div>';
        missing.forEach(function(d) {
          html += '<div class="preflight-item preflight-error">' + escapeHtml(d.display_name) + ' - ' + escapeHtml(d.reason || '缺失') + '</div>';
        });
        required.filter(function(d) { return d.importable; }).forEach(function(d) {
          html += '<div class="preflight-item preflight-ok">' + escapeHtml(d.display_name) + ' ' + escapeHtml(d.version || '') + ' ✓</div>';
        });
        html += '</div>';
      }
    }

    html += _renderAdvisorSummary(advisor);
    html += _renderModelAcceleration(modelAcceleration);
    html += _renderBackendRecommendedPatch(pf);
    html += _renderNativeUnetProfile(nativeUnetProfile);
    html += _renderPrecisionSwapProfile(precisionSwapProfile);

    // 提示信息（保留可折叠）
    if (notes.length > 0) {
      html += '<details class="preflight-group collapsible-subgroup" style="margin-top:8px;">';
      html += '<summary class="preflight-group-title">' + _ico('check-circle', 14) + ' 提示 (' + notes.length + ')<span class="collapsible-caret" aria-hidden="true">⌄</span></summary>';
      notes.forEach(function(n) {
        html += '<div class="preflight-item preflight-note">' + escapeHtml(_formatPreflightIssue(n)) + '</div>';
      });
      html += '</details>';
    }


    html += '</div></section>';
    return html;
  }

  function _pfMetric(label, value, type) {
    var color = type === 'accent' ? 'var(--accent)' : (type === 'ok' ? 'var(--success)' : (type === 'warn' ? 'var(--warning)' : (type === 'err' ? 'var(--danger)' : 'var(--text-main)')));
    return '<div class="train-pf-metric"><div class="train-pf-metric-label">' + label + '</div>'
      + '<div class="train-pf-metric-val" style="color:' + color + ';">' + value + '</div></div>';
  }

  /** Render dataset visualization sub-tab */
  function renderPreflightPanel() {
    var da = state.datasetAnalysis;
    var loading = state.loading.preflight;
    var dataDir = state.config.train_data_dir || '';

    if (!da && !loading) {
      return '<div class="train-pf-empty"><div style="text-align:center;padding:48px 20px;">'
        + _ico('folder', 40) + '<br><br>'
        + '<div style="font-size:0.88rem;color:var(--text-main);font-weight:600;margin-bottom:6px;">\u6570\u636e\u96c6\u9884\u89c8</div>'
        + '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:16px;max-width:360px;">'
        + (dataDir ? escapeHtml(dataDir) : '\u8bf7\u5148\u5728\u914d\u7f6e\u9875\u8bbe\u7f6e train_data_dir') + '</div>'
        + '<button class="btn btn-primary btn-sm" type="button" onclick="scanDataset()" style="padding:8px 24px;"'
        + (dataDir ? '' : ' disabled') + '>\u626b\u63cf\u6570\u636e\u96c6</button></div></div>';
    }
    if (loading) {
      return '<div class="train-pf-empty"><div style="text-align:center;padding:48px 20px;">'
        + _ico('loader', 24) + '<br><br><div style="font-size:0.82rem;color:var(--text-muted);">\u6b63\u5728\u626b\u63cf\u6570\u636e\u96c6...</div></div></div>';
    }

    var s = da.summary || {};
    var folders = da.folders || [];
    var topReso = da.top_resolutions || [];
    var batchSize = Number(state.config.train_batch_size) || 1;
    var trainLengthMode = state.config.train_length_mode || '最大轮数';
    var epochs = Number(state.config.max_train_epochs) || 1;
    var maxTrainSteps = Number(state.config.max_train_steps) || 0;
    var estSteps = trainLengthMode === '最大步数'
      ? maxTrainSteps
      : Math.ceil((s.effective_image_count || 0) / batchSize) * epochs;

    var metricsHtml = '<div class="train-pf-card">'
      + '<div class="train-pf-card-hdr"><span>\u6570\u636e\u6982\u89c8</span></div>'
      + '<div class="train-pf-metrics">'
      + _pfMetric('\u56fe\u7247\u603b\u6570', s.image_count || 0, '')
      + _pfMetric('\u6709\u6548\u56fe\u7247 (\u00d7Repeats)', s.effective_image_count || 0, '')
      + _pfMetric('\u9884\u4f30\u6b65\u6570', estSteps.toLocaleString(), 'accent')
      + '</div></div>';

    // Resolution bar chart
    var resoHtml = '';
    if (topReso.length > 0) {
      var maxCount = Math.max.apply(null, topReso.map(function(r) { return r.count || 0; }));
      var bars = topReso.slice(0, 6).map(function(r) {
        var cnt = r.count || 0;
        var pct = maxCount > 0 ? Math.round(cnt / maxCount * 100) : 0;
        return '<div class="train-reso-bar-col"><div class="train-reso-count">' + cnt
          + '</div><div class="train-reso-bar" style="height:' + pct + '%"></div>'
          + '<div class="train-reso-label">' + escapeHtml(r.name || '') + '</div></div>';
      }).join('');
      resoHtml = '<div class="train-pf-card">'
        + '<div class="train-pf-card-hdr"><span>\u5206\u8fa8\u7387\u5206\u5e03</span>'
        + '<span class="train-tag">' + topReso.length + ' \u4e2a\u6876</span></div>'
        + '<div class="train-reso-chart">' + bars + '</div></div>';
    }

    // Diagnostics
    var diags = [];
    var alphaCount = s.alpha_capable_image_count || 0;
    if (s.caption_count > 0) diags.push({ok: true, text: '\u6807\u6ce8\u6587\u4ef6\u5df2\u627e\u5230 (' + (s.caption_coverage * 100).toFixed(0) + '% \u8986\u76d6\u7387)'});
    else diags.push({ok: false,warn: true, text: '\u672a\u627e\u5230\u6807\u6ce8\u6587\u4ef6'});
    if (s.broken_image_count === 0) diags.push({ok: true, text: '\u65e0\u635f\u574f\u56fe\u7247'});
    else diags.push({ok: false, text: s.broken_image_count + ' \u5f20\u635f\u574f\u56fe\u7247'});
    if (alphaCount > 0) diags.push({ok: false, warn: true, text: alphaCount + ' \u5f20\u56fe\u7247\u542b\u900f\u660e\u901a\u9053 (PNG/WebP)\uff0c\u53ef\u80fd\u5f71\u54cd\u8bad\u7ec3\u7ed3\u679c'});
    else diags.push({ok: true, text: '\u65e0\u900f\u660e\u901a\u9053\u56fe\u7247'});
    if (s.images_without_caption_count > 0) diags.push({ok: false, warn: true, text: s.images_without_caption_count + '\u5f20\u56fe\u7247\u7f3a\u5c11\u6807\u6ce8'});
    if (s.empty_caption_count > 0) diags.push({ok: false, warn: true, text:s.empty_caption_count + ' \u4e2a\u7a7a\u6807\u6ce8\u6587\u4ef6'});
    if (diags.length === 0) diags.push({ok: true, text: '\u5168\u90e8\u68c0\u67e5\u901a\u8fc7'});

    var diagHtml = '<div class="train-pf-card">'
      + '<div class="train-pf-card-hdr"><span>\u8bca\u65ad</span></div>'
      + '<ul class="train-diag-list">' + diags.map(function(d) {
          var icon = d.ok ? _ico('check-circle', 15) : (d.warn ? _ico('alert-tri', 15) : _ico('x-circle', 15));
          var color = d.ok ? 'var(--success)' : (d.warn ? 'var(--warning)' : 'var(--danger)');
          return '<li style="color:' + color + ';">' + icon + ' <span style="color:var(--text-main);">' + escapeHtml(d.text) + '</span></li>';
        }).join('') + '</ul></div>';

    //Folder table with expandable image preview
    var tableHtml = '<div class="train-pf-table-wrap">'
      + '<div class="train-pf-table-hdr"><span class="train-pf-card-hdr"><span>\u6587\u4ef6\u5939\u7ed3\u6784</span></span></div>'
      + '<div class="train-pf-table-head"><div>\u8def\u5f84</div><div>\u6982\u5ff5\u6807\u7b7e</div><div style="text-align:right;">Repeats</div><div style="text-align:right;">\u56fe\u7247\u6570</div></div>';
    tableHtml += folders.map(function(f, idx) {
      var rawTag = f.first_tag || f.caption_preview || f.name.replace(/^\d+_/, '');
      var tag = String(rawTag || '').split(',')[0].split('\n')[0].trim();
      var repeats = f.repeats || 0;
      var fPath = f.path || '';
      return '<div class="train-pf-table-row" style="cursor:pointer;" onclick="toggleFolderPreview(' + idx + ',this)">'
        + '<div class="train-pf-folder-name">' + _ico('folder', 14) + ' ' + escapeHtml(f.name) + '</div>'
        + '<div class="train-pf-tag" id="pf-tag-' + idx + '">' + escapeHtml(tag) + '</div>'
        + '<div style="text-align:right;font-variant-numeric:tabular-nums;">' + repeats + '</div>'
        + '<div style="text-align:right;font-variant-numeric:tabular-nums;">' + f.image_count + '</div>'
        + '</div>'
        + '<div class="train-pf-thumbs" id="pf-thumbs-' + idx + '" data-folder="' + escapeHtml(fPath) + '" style="display:none;"></div>';
    }).join('');
    tableHtml += '</div>';


    return '<div class="train-pf-scroll">'
      + '<div class="train-pf-header"><div style="display:flex;align-items:center;gap:10px;">'
      + _ico('bar-chart', 16) + ' <span style="font-size:0.9rem;font-weight:700;">\u6570\u636e\u96c6\u9884\u89c8</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span style="font-size:0.68rem;color:var(--text-muted);">' + escapeHtml(dataDir) + '</span>'
      + '<button class="btn btn-outline btn-sm" type="button" onclick="scanDataset()" style="font-size:0.68rem;">\u91cd\u65b0\u626b\u63cf</button>'
      + '</div></div>'
      + metricsHtml
      + '<div class="train-pf-row2">' + resoHtml + diagHtml + '</div>'
      + tableHtml
      + '</div>';
  }

  return {
    renderPreflightDetail,
    renderPreflightOverviewPanel,
    renderPreflightActionPanel,
    renderPreflightReport,
    renderPreflightPanel,
    _pfTag,
    _pfMetric,
  };
}
