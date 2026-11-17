// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
import { performanceMode, performanceModePatch } from '../utils/performanceMode.js';

let readDraft = () => ({});

export function setupPerfModeToggle(api, showToast, { getConfig, applyPatch }) {
  readDraft = getConfig;
  document.querySelectorAll('#topbar-perf-toggle .perf-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.perf;
      if (!['lulynx', 'classic'].includes(mode) || mode === getPerfMode()) return;
      applyPatch(performanceModePatch(mode));
      syncPerfModeToggle();
      showToast(mode === 'lulynx' ? '当前草稿已启用 LULYNX 优化；优化设置中可逐项选择，下次训练生效' : '当前草稿已关闭 LULYNX 优化，下次训练生效');
    });
  });
  syncPerfModeToggle();
}

export function syncPerfModeToggle() {
  const mode = getPerfMode();
  document.querySelectorAll('#topbar-perf-toggle .perf-btn').forEach((button) => {
    const active = button.dataset.perf === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

export function getPerfMode(config = readDraft()) {
  return performanceMode(config);
}
