// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Browser defaults seed new drafts; imported/saved requests keep their own snapshot.
const KEY = 'lulynx-optimization-preferences-v1';
const FIELDS = ['lulynx_optimization_features', 'turbocore_optimizer_algorithms'];

export function optimizationDefaults() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.fromEntries(FIELDS.filter((key) => typeof stored?.[key] === 'string').map((key) => [key, stored[key]]));
  } catch {
    return {};
  }
}

export function rememberOptimizationChoice(key, value) {
  if (!FIELDS.includes(key)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...optimizationDefaults(), [key]: Array.isArray(value) ? value.join(',') : String(value ?? '') }));
  } catch {
    // Draft/request persistence still owns the actual training configuration.
  }
}
