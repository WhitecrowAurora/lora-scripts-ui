import { escapeHtml } from './utils/dom.js';

const SECRET_KEY = /(api[_-]?key|token|secret|password|credential)/i;
const PATH_KEY = /(^|_)(path|dir|folder|file)$|model_name_or_path$/i;

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function displayValue(key, value) {
  if (value === '' || value == null) return '(空)';
  if (SECRET_KEY.test(key)) return '[已设置]';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!PATH_KEY.test(key)) return text.length > 96 ? `${text.slice(0, 96)}...` : text;
  const normalized = text.replaceAll('\\', '/');
  const tail = normalized.split('/').filter(Boolean).pop() || normalized;
  return `.../${tail}`;
}

export function buildTrainingTypeTransition(
  currentConfig,
  targetType,
  targetDefaults,
  { preserveShared = true } = {},
) {
  const current = currentConfig && typeof currentConfig === 'object' ? currentConfig : {};
  const nextConfig = { ...(targetDefaults || {}) };
  if (preserveShared) {
    for (const key of Object.keys(nextConfig)) {
      if (key !== 'model_train_type' && current[key] !== undefined && current[key] !== '') {
        nextConfig[key] = current[key];
      }
    }
  }
  nextConfig.model_train_type = targetType;
  const changed = [];
  const removed = [];
  const defaulted = [];
  for (const key of Object.keys(current)) {
    if (!(key in nextConfig)) removed.push({ key, before: current[key] });
    else if (!sameValue(current[key], nextConfig[key])) {
      changed.push({ key, before: current[key], after: nextConfig[key] });
    }
  }
  for (const key of Object.keys(nextConfig)) {
    if (!(key in current)) defaulted.push({ key, after: nextConfig[key] });
  }
  return { targetType, nextConfig, changed, removed, defaulted };
}

function renderRows(kind, rows) {
  if (rows.length === 0) return '<div class="training-option-help-note">无</div>';
  return rows.map((row) => {
    const before = row.before !== undefined
      ? `<span>${escapeHtml(displayValue(row.key, row.before))}</span>`
      : '';
    const after = row.after !== undefined
      ? `<span>${escapeHtml(displayValue(row.key, row.after))}</span>`
      : '';
    const value = kind === 'removed' ? before : kind === 'defaulted' ? after : `${before} -&gt; ${after}`;
    return `<div class="training-option-help-row"><strong>${escapeHtml(row.key)}</strong><p>${value}</p></div>`;
  }).join('');
}

export function confirmTrainingTypeTransition(transition, labels = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'training-option-help-modal training-type-switch-modal open';
    const groups = [
      ['changed', '变更', transition.changed],
      ['removed', '移除', transition.removed],
      ['defaulted', '采用新默认值', transition.defaulted],
    ];
    overlay.innerHTML = `<div class="training-option-help-dialog" role="dialog" aria-modal="true" aria-label="模型族切换确认"><div class="training-option-help-head"><div><span class="training-option-help-category">模型族切换</span><h3>${escapeHtml(labels.from || '')} -&gt; ${escapeHtml(labels.to || transition.targetType)}</h3></div><button class="modal-close" type="button" data-switch-cancel title="取消">x</button></div><div class="training-option-help-body">${groups.map(([kind, title, rows]) => `<details open><summary><strong>${title} (${rows.length})</strong></summary>${renderRows(kind, rows)}</details>`).join('')}</div><div class="training-option-help-foot"><button class="btn btn-outline" type="button" data-switch-cancel>取消</button><button class="btn btn-primary" type="button" data-switch-apply>确认切换</button></div></div>`;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(result);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    overlay.querySelectorAll('[data-switch-cancel]').forEach((button) => {
      button.addEventListener('click', () => finish(false));
    });
    overlay.querySelector('[data-switch-apply]')?.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-switch-apply]')?.focus();
  });
}
