// Performance settings belong to the draft captured for each training request.
export const PERFORMANCE_FIELDS = [
  'lulynx_optimization_enabled',
];

export function performanceModePatch(mode) {
  if (!['lulynx', 'classic'].includes(mode)) throw new Error('无效的性能模式');
  return Object.fromEntries(PERFORMANCE_FIELDS.map(key => [key, mode === 'lulynx']));
}

export function performanceModeConfig(config = {}) {
  const enabled = config.lulynx_optimization_enabled === true;
  return Object.fromEntries(PERFORMANCE_FIELDS.map(key => [
    key, typeof config[key] === 'boolean' ? config[key] : enabled,
  ]));
}

export function performanceMode(config = {}) {
  return config.lulynx_optimization_enabled === true ? 'lulynx' : 'classic';
}
