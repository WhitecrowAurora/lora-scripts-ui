// renderers/dataset/advancedTagToolsPanel.js — 高级标签工具（P1/P2/P3 统一单 Tab）
//
// 内部二级分段：集成打标 / 结构化 / 近重复 / 频率批量 / 审查队列 / 版本历史 /
//               策略包 / 重标队列 / 一键管线 / 跨数据集情报
// 所有写操作均遵循 preview→apply 两段式，后端按 advanced_enabled 门控。
//
// 依赖（工厂注入）：api、$、escapeHtml、showToast

import { createAdvancedTagBatchTools } from './advancedTagToolsBatch.js';
import { createAdvancedTagToolsContext } from './advancedTagToolsContext.js';
import { createAdvancedTagWorkflowTools } from './advancedTagToolsWorkflow.js';

const SEGMENTS = [
  { id: 'pipeline', label: '一键管线' },
  { id: 'ensemble', label: '集成打标' },
  { id: 'structure', label: '结构化' },
  { id: 'dedupe', label: '近重复' },
  { id: 'contentscan', label: '内容扫描' },
  { id: 'cachehealth', label: '缓存健康' },
  { id: 'frequency', label: '频率批量' },
  { id: 'review', label: '审查队列' },
  { id: 'policy', label: '策略包' },
  { id: 'retag', label: '重标队列' },
  { id: 'version', label: '版本历史' },
  { id: 'cross', label: '跨数据集情报' },
];

export function createAdvancedTagToolsPanel({ api, $, escapeHtml, showToast }) {
  let activeSegment = 'pipeline';
  let advancedEnabled = null;

  const context = createAdvancedTagToolsContext({ $, escapeHtml });
  const batchTools = createAdvancedTagBatchTools({ api, $, showToast, context });
  const workflowTools = createAdvancedTagWorkflowTools({ api, $, showToast, context });

  async function renderAdvancedTagTools() {
    const content = $('#dataset-content');
    if (!content) return;
    if (advancedEnabled === null) {
      try {
        const status = await api.getTagEditorStatus();
        advancedEnabled = Boolean(status?.data?.advanced_enabled ?? status?.advanced_enabled);
      } catch (_e) {
        advancedEnabled = false;
      }
    }
    const nav = SEGMENTS.map((s) => (
      `<button class="dataset-tab ${activeSegment === s.id ? 'active' : ''}" type="button" onclick="switchAdvancedTagSegment('${s.id}')">${s.label}</button>`
    )).join('');
    content.innerHTML = `
      <section class="form-section">
        <header class="section-header"><h3>高级标签工具</h3></header>
        <div class="section-summary">集成打标、结构化、近重复、频率批量、审查/重标队列、版本历史、策略包、闭环管线与跨数据集情报。写操作均为预览→应用两段式。</div>
        ${advancedEnabled ? '' : '<div class="builtin-picker-empty" style="margin:8px 0;"><span>高级标签功能未启用：请在 tag_editor_config 中开启 advanced 能力后再使用。</span></div>'}
        <nav class="dataset-tabs" aria-label="高级标签工具分段" style="margin-bottom:12px;">${nav}</nav>
        <div id="adv-segment-body"></div>
      </section>`;
    renderSegment();
  }

  function switchAdvancedTagSegment(segment) {
    activeSegment = segment;
    renderSegment();
  }

  function renderSegment() {
    const body = $('#adv-segment-body');
    if (!body) return;
    const segment = batchTools.segments[activeSegment]
      || workflowTools.segments[activeSegment]
      || batchTools.segments.pipeline;
    body.innerHTML = segment();
    if (activeSegment === 'policy') workflowTools.refreshAdvPolicyPacks();
  }

  return {
    renderAdvancedTagTools,
    // window actions
    switchAdvancedTagSegment,
    runAdvPipelinePlan: batchTools.runAdvPipelinePlan,
    runAdvPipelineRun: batchTools.runAdvPipelineRun,
    runAdvEnsemblePreview: batchTools.runAdvEnsemblePreview,
    runAdvEnsembleApply: batchTools.runAdvEnsembleApply,
    runAdvStructurePreview: batchTools.runAdvStructurePreview,
    runAdvStructureApply: batchTools.runAdvStructureApply,
    runAdvDedupe: batchTools.runAdvDedupe,
    runAdvDedupePlan: batchTools.runAdvDedupePlan,
    runAdvDedupeQuarantine: batchTools.runAdvDedupeQuarantine,
    runAdvContentScan: batchTools.runAdvContentScan,
    runAdvContentQuarantine: batchTools.runAdvContentQuarantine,
    runAdvCacheHealthReport: batchTools.runAdvCacheHealthReport,
    runAdvCacheHealthPlan: batchTools.runAdvCacheHealthPlan,
    runAdvCacheHealthQuarantine: batchTools.runAdvCacheHealthQuarantine,
    runAdvFrequencyPreview: batchTools.runAdvFrequencyPreview,
    runAdvFrequencyApply: batchTools.runAdvFrequencyApply,
    runAdvReviewQueue: workflowTools.runAdvReviewQueue,
    refreshAdvPolicyPacks: workflowTools.refreshAdvPolicyPacks,
    runAdvPolicyPreview: workflowTools.runAdvPolicyPreview,
    runAdvPolicyApply: workflowTools.runAdvPolicyApply,
    runAdvRetagBuild: workflowTools.runAdvRetagBuild,
    runAdvRetagNext: workflowTools.runAdvRetagNext,
    markAdvRetag: workflowTools.markAdvRetag,
    runAdvVersionHistory: workflowTools.runAdvVersionHistory,
    runAdvVersionRevert: workflowTools.runAdvVersionRevert,
    runAdvCrossAggregate: workflowTools.runAdvCrossAggregate,
    runAdvCrossResult: workflowTools.runAdvCrossResult,
  };
}
