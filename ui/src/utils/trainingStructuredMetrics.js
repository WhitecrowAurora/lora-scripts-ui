import { request } from '../apiTransport.js';
import { createEmptyMetrics } from './trainingMetricParsing.js';

export function trainingRunId(task) {
  return String(task?.metadata?.run_id || task?.run_id || '');
}

export async function loadTrainingRunStatus(task, fetchStatus = request) {
  const runId = trainingRunId(task);
  if (!runId) return null;
  try {
    const status = await fetchStatus(`/train/status/${encodeURIComponent(runId)}`);
    return status?.run_id === runId ? status : null;
  } catch (_error) {
    // Older job-backed tasks can still use the existing log metrics.
    return null;
  }
}

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Merge authoritative run telemetry after parsing optional legacy log lines. */
export function applyTrainingRunMetrics(metrics, status, task = null) {
  if (!metrics) return;
  const runId = trainingRunId(task) || String(status?.run_id || '');
  if (status?.run_id && runId && status.run_id !== runId) return;
  const identity = runId ? `run:${runId}` : task ? `task:${task.id || task.task_id || ''}` : '';
  if (metrics.structuredIdentity && identity && metrics.structuredIdentity !== identity) {
    Object.assign(metrics, createEmptyMetrics());
    delete metrics.structuredElapsedMs;
    delete metrics.structuredLastStep;
  }
  if (identity) metrics.structuredIdentity = identity;
  const source = status || task?.metadata || {};
  const step = finite(source.current_step);
  const total = finite(source.total_steps);
  // A task-list snapshot can lag behind the run status already collected.
  const previousStep = metrics.structuredLastStep ?? -1;
  metrics.lastStep = Math.max(metrics.lastStep, previousStep, step ?? 0);
  if (step !== null && step < previousStep) return;
  if (step !== null && step >= 0) metrics.structuredLastStep = step;
  if (total !== null && total > 0) metrics.totalSteps = total;

  const series = source.enhanced_metrics_series?.loss;
  const points = new Map();
  if (Array.isArray(series)) {
    for (const point of series) {
      if (!Array.isArray(point)) continue;
      const index = finite(point[0]);
      const loss = finite(point[1]);
      if (index !== null && index >= 0 && loss !== null) points.set(index, loss);
    }
  }
  if (points.size) {
    metrics.losses = [...points].sort((a, b) => a[0] - b[0]).map(([index, loss]) => ({ step: index, loss }));
  } else {
    const loss = finite(source.last_loss);
    if (step !== null && step > 0 && loss !== null) {
      const index = metrics.losses.findIndex((point) => point.step === step);
      const point = { step, loss };
      if (index >= 0) metrics.losses[index] = point;
      else metrics.losses.push(point);
    }
  }
  const started = Date.parse(source.started_at || task?.started_at || '');
  const finished = Date.parse(source.finished_at || task?.finished_at || '');
  if (Number.isFinite(started)) metrics.startTime = started;
  if (Number.isFinite(started) && Number.isFinite(finished) && finished >= started) {
    metrics.structuredElapsedMs = finished - started;
  }
}
