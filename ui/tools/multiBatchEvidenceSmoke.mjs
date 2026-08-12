import assert from 'node:assert/strict';
import {
  getMultiBatchEvidenceFromTask,
  normalizeMultiBatchEvidence,
  renderMultiBatchEvidenceBadge,
  renderMultiBatchEvidenceCard,
} from '../src/utils/multiBatchEvidence.js';
import { renderSummaryCard } from '../src/utils/trainingMetrics.js';

const evidence = {
  multi_batch_promotion_gate: {
    gate: 'lulynx_multi_batch_promotion_gate_v0',
    status: 'ready_for_long_window_probe',
    ready_for_long_window_probe: true,
    candidate_physical_batch_size: 2,
    release_claim_allowed: false,
    blockers: [],
  },
  multi_batch_dataloader: {
    contract: 'lulynx_multi_batch_dataloader_contract_v0',
    ok: true,
    physical_batch_size: 2,
    effective_batch_size: 2,
    drop_last: true,
    release_claim_allowed: false,
  },
  multi_batch_stability_candidate_evidence: {
    report: 'lulynx_multi_batch_stability_candidate_evidence_v0',
    release_claim_allowed: false,
    evidence_complete_for_review: true,
    fresh_promotion_gate_status: 'ready_for_long_window_probe',
    steps_completed: 80,
    steady_samples_per_second: 0.75,
    active_gpu_util_pct_mean: 42,
    peak_vram_mb: 12345,
    final_loss: 0.1234,
  },
};

const normalized = normalizeMultiBatchEvidence(evidence);
assert.equal(normalized.label, '长窗证据完整');
// multi_batch_promotion_gate / release_claim_allowed 是已退役的开发期闸门
// (backend 侧 lulynx_trainer/multi_batch_promotion_gate.py 已在
// smoke/audit/misc/release_dev_gate_residue_smoke.py 的 RETIRED_RELEASE_PATHS 里)。
// 这套东西是我们的开发债,不该出现在用户界面上。旧 task metadata 里可能还带着这个键,
// 所以 fixture 保留它 —— 断言的是"即便输入带,也不得回流到 normalize 结果和渲染"。
assert.equal(normalized.releaseClaimAllowed, undefined, 'retired release-claim gate must not resurface');
assert.equal(normalized.gate, undefined, 'retired promotion gate must not resurface');

const taskEvidence = getMultiBatchEvidenceFromTask({ id: 'task-1', metadata: evidence }, {});
assert.equal(taskEvidence.multi_batch_promotion_gate, undefined, 'retired gate must not be re-read from task metadata');

const badge = renderMultiBatchEvidenceBadge(evidence);
assert.match(badge, /Multi-batch/);
assert.doesNotMatch(badge, /不可发布|发布可用|发布 claim/, 'badge must not surface retired release-claim wording');

const card = renderMultiBatchEvidenceCard(evidence);
assert.match(card, /Multi-batch 证据/);
assert.doesNotMatch(card, /发布 claim|只读 evidence|不可发布|发布可用/, 'card must not surface retired release-claim wording');
assert.doesNotMatch(card, /Gate |推广阻断/, 'card must not surface the retired promotion gate line');

const summaryHtml = renderSummaryCard({
  _v: 2,
  avgSpeed: 1.2,
  speedColor: 'var(--success)',
  speedRating: '正常',
  firstLoss: 0.5,
  lastLoss: 0.4,
  minLoss: 0.4,
  lossColor: 'var(--success)',
  lossTrend: '下降',
  lossDetail: 'ok',
  lossLevelColor: 'var(--success)',
  lossLevelTag: '正常',
  epochDone: 1,
  epochTotal: 1,
  lastStep: 16,
  totalSteps: 16,
  elapsedStr: '—',
  sampleCount: 4,
  overallColor: 'var(--success)',
  overallRating: 'ok',
}, { multiBatchEvidence: evidence });

assert.match(summaryHtml, /Multi-batch 证据/);
assert.doesNotMatch(summaryHtml, /不可发布|发布 claim/, 'summary card must not surface retired release-claim wording');

console.log('multiBatchEvidenceSmoke: ok');
