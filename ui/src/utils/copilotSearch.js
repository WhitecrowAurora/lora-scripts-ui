export const COPILOT_SEARCH_STRATEGIES = Object.freeze([
  { value: 'adaptive', label: '自适应爬山（默认）' },
  { value: 'grid', label: '局部网格' },
  { value: 'random', label: '局部随机' },
  { value: 'tpe', label: 'TPE（完成试验反馈后建议）' },
]);

export function normalizeCopilotSearchStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return COPILOT_SEARCH_STRATEGIES.some((item) => item.value === normalized)
    ? normalized
    : 'adaptive';
}

export function buildCopilotSearchParam(tunable, config, rawStep, strategy) {
  const normalized = normalizeCopilotSearchStrategy(strategy);
  const step = positiveNumber(rawStep, tunable.step);
  const base = clamp(
    finiteNumber(config?.[tunable.name], tunable.fallback),
    tunable.min,
    tunable.max,
  );
  const param = {
    name: tunable.name,
    enabled: true,
    step,
  };
  if (normalized === 'adaptive') return param;

  const bounds = localBounds(tunable, base, step);
  if (normalized === 'grid') {
    return {
      ...param,
      values: dedupe([bounds.low, base, bounds.high].map((value) => coerce(tunable, value))),
    };
  }
  return {
    ...param,
    low: coerce(tunable, bounds.low),
    high: coerce(tunable, bounds.high),
    log: tunable.kind === 'mul',
  };
}

function localBounds(tunable, base, step) {
  if (tunable.kind === 'mul') {
    const factor = Math.max(step, 1.01);
    return {
      low: clamp(base / factor, tunable.min, tunable.max),
      high: clamp(base * factor, tunable.min, tunable.max),
    };
  }
  return {
    low: clamp(base - step, tunable.min, tunable.max),
    high: clamp(base + step, tunable.min, tunable.max),
  };
}

function coerce(tunable, value) {
  return tunable.integer ? Math.round(value) : Number(value);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number(fallback);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : Number(fallback);
}

function dedupe(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}
