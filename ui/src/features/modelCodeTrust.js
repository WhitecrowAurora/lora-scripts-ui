// Per-run consent is deliberately outside state.config and all saved drafts.
const controllers = new WeakMap();
const AUTH_FIELDS = new Set(['allow_model_code', 'model_code_sources']);
const SOURCE_FIELDS = [
  'extractor_type', 'include_waifu_score', 'jtp3_model_path', 'jtp3_model_id',
  'jtp3_fallback_model_id', 'waifu_model_path', 'waifu_model_id',
  'waifu_clip_model_name', 'waifu_clip_pretrained', 'waifu_v3_head_path',
  'jtp3_extractor_path', 'waifu_extractor_path', 'wv3_head_path',
];
const INVALIDATION_FIELDS = new Set([...SOURCE_FIELDS, 'resume_from', 'checkpoint_path', 'model_train_type']);

export function withoutModelCodeTrust(config = {}) {
  const clean = Object.fromEntries(Object.entries(config).filter(([key]) => !AUTH_FIELDS.has(key)));
  if (clean.scorer_config && typeof clean.scorer_config === 'object') {
    clean.scorer_config = withoutModelCodeTrust(clean.scorer_config);
  }
  return clean;
}

export function modelCodeSourceQuery(config = {}) {
  const sources = Object.fromEntries(SOURCE_FIELDS
    .filter((key) => config[key] !== undefined && config[key] !== '')
    .map((key) => [key, config[key]]));
  // Never put hf_token or any other credentials into a URL.
  return new URLSearchParams({ scorer_config: JSON.stringify(sources) }).toString();
}

function fingerprint(config, typeId) {
  return JSON.stringify([typeId, ...[...INVALIDATION_FIELDS].map((key) => config?.[key] ?? null)]);
}

export function getModelCodeTrust(state) {
  if (controllers.has(state)) return controllers.get(state);
  let generation = 0;
  let approvedFingerprint = '';
  let approvedSourceQuery = '';
  let sources = [];
  let pending = false;
  let message = '默认关闭；仅本次运行有效，不保存到配置。';

  function refreshControls() {
    const root = globalThis.document;
    root?.querySelectorAll('[data-model-code-trust]').forEach((control) => {
      control.checked = sources.length > 0;
      control.disabled = pending;
    });
    root?.querySelectorAll('[data-model-code-trust-status]').forEach((control) => {
      control.textContent = message;
    });
  }

  function reset(reason = '默认关闭；仅本次运行有效，不保存到配置。') {
    generation += 1;
    sources = [];
    approvedFingerprint = '';
    approvedSourceQuery = '';
    pending = false;
    message = reason;
    refreshControls();
  }

  function isEnabled(config = state.config, typeId = state.activeTrainingType) {
    if (sources.length && approvedFingerprint !== fingerprint(config, typeId)) {
      reset('模型来源已变化，请重新确认。');
    }
    return sources.length > 0;
  }

  async function toggle(enabled, lookup, confirm = (text) => globalThis.window.confirm(text), buildPayload = (config) => config) {
    reset();
    if (!enabled || state.activeTrainingType !== 'aesthetic-scorer') return false;
    const started = generation;
    const configFingerprint = fingerprint(state.config, state.activeTrainingType);
    pending = true;
    message = '正在安全读取模型来源（不会加载或执行模型）…';
    refreshControls();
    try {
      const sourceQuery = modelCodeSourceQuery(buildPayload(state.config, state.activeTrainingType));
      const response = await lookup(sourceQuery);
      if (started !== generation) return false;
      if (configFingerprint !== fingerprint(state.config, state.activeTrainingType)
        || sourceQuery !== modelCodeSourceQuery(buildPayload(state.config, state.activeTrainingType))) {
        reset('模型来源已变化，请重新确认。');
        return false;
      }
      const found = response?.data?.model_code?.sources ?? response?.model_code?.sources;
      if (!Array.isArray(found) || found.some((item) => !item || typeof item.source !== 'string'
        || !item.source || typeof item.location !== 'string' || typeof item.kind !== 'string')) {
        throw new Error('后端未返回有效的模型来源，未开启授权。');
      }
      if (!found.length) {
        message = '当前配置没有需要授权的模型来源，保持关闭。';
        return false;
      }
      const locations = found.map((item) => `• [${item.kind}] ${item.location}`).join('\n');
      const accepted = await confirm(`允许加载模型自定义代码（高风险）\n\n实际来源：\n${locations}\n\n`
        + '这些模型可能执行 Python 或 TorchScript 代码，拥有当前训练进程的文件、网络及系统访问权限。'
        + '仅在信任以上所有来源时继续。\n\n仅本次运行有效；更换来源需重新确认。不会允许任意 pickle 加载。\n\n是否确认授权？');
      if (started !== generation) return false;
      if (configFingerprint !== fingerprint(state.config, state.activeTrainingType)
        || sourceQuery !== modelCodeSourceQuery(buildPayload(state.config, state.activeTrainingType))) {
        reset('模型来源已变化，请重新确认。');
        return false;
      }
      if (!accepted) return false;
      sources = [...new Set(found.map((item) => item.source))];
      approvedFingerprint = configFingerprint;
      approvedSourceQuery = sourceQuery;
      message = `已确认 ${sources.length} 个来源；提交本次运行后自动关闭。`;
      return true;
    } catch (error) {
      if (started === generation) message = error.message || '读取模型来源失败，未开启授权。';
      return false;
    } finally {
      if (started === generation) {
        pending = false;
        if (!sources.length && message.startsWith('正在')) message = '未授权；默认安全加载仍可使用。';
        refreshControls();
      }
    }
  }

  function consume(config, typeId, effectivePayload = config) {
    const allowed = typeId === 'aesthetic-scorer' && isEnabled(config, typeId)
      && isEnabled(state.config, state.activeTrainingType)
      && approvedSourceQuery === modelCodeSourceQuery(effectivePayload);
    const payload = { allow_model_code: allowed, model_code_sources: allowed ? [...sources] : [] };
    reset('本次提交的授权已消耗，下次运行需重新确认。');
    return payload;
  }

  const controller = { reset, isEnabled, toggle, consume, get pending() { return pending; }, get message() { return message; } };
  controllers.set(state, controller);
  return controller;
}

export function invalidateModelCodeTrust(state, key = '') {
  // Imported or manually edited authorization values never become consent.
  for (const field of AUTH_FIELDS) delete state.config?.[field];
  if (state.config?.scorer_config) state.config.scorer_config = withoutModelCodeTrust(state.config.scorer_config);
  if (!key || INVALIDATION_FIELDS.has(key) || AUTH_FIELDS.has(key)) getModelCodeTrust(state).reset();
}

export function renderModelCodeTrust(state) {
  if (state.activeTrainingType !== 'aesthetic-scorer') return '';
  const trust = getModelCodeTrust(state);
  const checked = trust.isEnabled() ? 'checked' : '';
  // Status is set with textContent, so remote error/source strings cannot become HTML.
  return `<div class="config-group">
    <label><input type="checkbox" data-model-code-trust ${checked} ${trust.pending ? 'disabled' : ''}
      onchange="toggleModelCodeTrust(this.checked)"> 允许加载模型自定义代码（高风险）</label>
    <p class="field-desc">默认关闭。开启需确认实际仓库来源及权限，仅本次运行生效；配置文件不能携带授权。</p>
    <p class="field-desc" data-model-code-trust-status>${checked ? '已确认来源，仅本次运行有效。' : '未授权；标准模型仍使用默认安全加载。'}</p>
  </div>`;
}
