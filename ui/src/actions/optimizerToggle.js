// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// The draft is authoritative; changing another page never changes a queued request.
let readDraft = () => ({});

export function syncOptimizerToggle() {
  const enabled = readDraft().turbocore_enabled !== false;
  document.querySelectorAll('#topbar-optimizer-toggle .optimizer-btn').forEach((button) => {
    const active = (button.dataset.optimizer === 'turbocore') === enabled;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const single = document.getElementById('turbocore-toggle-btn');
  if (single) {
    single.classList.toggle('active', enabled);
    single.setAttribute('aria-pressed', String(enabled));
    const label = single.querySelector('.turbocore-label');
    if (label) label.textContent = enabled ? 'TurboCore ON' : 'TurboCore OFF';
  }
}

export function setupOptimizerToggle(api, showToast, { getConfig, applyPatch }) {
  readDraft = getConfig;
  const setEnabled = (enabled) => {
    applyPatch({ turbocore_enabled: enabled });
    syncOptimizerToggle();
    showToast(enabled ? '当前草稿已启用 TurboCore；优化设置中可选择算法，下次训练生效' : '当前草稿已关闭 TurboCore，下次训练生效');
  };
  document.querySelectorAll('#topbar-optimizer-toggle .optimizer-btn').forEach((button) => {
    button.addEventListener('click', () => setEnabled(button.dataset.optimizer === 'turbocore'));
  });
  document.getElementById('turbocore-toggle-btn')?.addEventListener('click', () => setEnabled(!getTurbocoreEnabled()));
  syncOptimizerToggle();
}

export function getOptimizerMode() {
  return getTurbocoreEnabled() ? 'turbocore' : 'pytorch';
}

export function getTurbocoreEnabled() {
  return readDraft().turbocore_enabled !== false;
}
