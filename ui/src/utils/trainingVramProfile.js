const PROFILE_OFF = 'off';
const UNSUPPORTED_EVIDENCE = new Set(['disabled', 'unsupported']);

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function unwrapEnvelope(payload) {
  let current = objectValue(payload);
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current.data || typeof current.data !== 'object' || Array.isArray(current.data)) break;
    current = current.data;
  }
  return current;
}

export function normalizeTrainingVramProfile(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || PROFILE_OFF;
}

export function trainingVramProfileSignature(config = {}, typeId = '') {
  return JSON.stringify([
    String(typeId || config.model_train_type || '').trim(),
    normalizeTrainingVramProfile(config.training_vram_profile),
    String(config.wan22_model_variant || config.model_variant || config.checkpoint_variant || '').trim(),
  ]);
}

export function createTrainingVramProfileUiState() {
  return {
    signature: '',
    requestId: 0,
    typeId: '',
    profile: PROFILE_OFF,
    status: 'idle',
    managedValues: {},
    managedKeys: [],
    detectedVramGb: 0,
    evidenceStatus: 'disabled',
    warning: '',
  };
}

export function extractTrainingVramProfileDecision(payload) {
  const body = unwrapEnvelope(payload);
  const rawDecision = objectValue(
    body.training_vram_profile_decision
      || body.vram_profile_decision
      || body.decision,
  );
  const managedValues = objectValue(rawDecision.managed_values || rawDecision.changes);
  const requestedKeys = Array.isArray(rawDecision.managed_keys)
    ? rawDecision.managed_keys.map((key) => String(key || '').trim()).filter(Boolean)
    : Object.keys(managedValues);
  const managedKeys = requestedKeys.filter((key) => Object.hasOwn(managedValues, key));
  const evidenceStatus = String(rawDecision.evidence_status || '').trim().toLowerCase();
  const enabled = rawDecision.enabled === true
    && !UNSUPPORTED_EVIDENCE.has(evidenceStatus)
    && managedKeys.length > 0;
  const detectedRaw = rawDecision.detected_vram_gb ?? body.detected_vram_gb ?? 0;
  const detectedVramGb = Number(detectedRaw);
  return {
    enabled,
    managedValues: enabled ? Object.fromEntries(managedKeys.map((key) => [key, managedValues[key]])) : {},
    managedKeys: enabled ? managedKeys : [],
    detectedVramGb: Number.isFinite(detectedVramGb) && detectedVramGb > 0 ? detectedVramGb : 0,
    evidenceStatus: evidenceStatus || (enabled ? 'resolved' : 'unsupported'),
    warning: Array.isArray(rawDecision.warnings)
      ? rawDecision.warnings.map(String).filter(Boolean).join('；')
      : String(rawDecision.warning || ''),
  };
}

export function applyTrainingVramProfileOverlay(config = {}, uiState = {}, typeId = '') {
  const raw = objectValue(config);
  const profile = normalizeTrainingVramProfile(raw.training_vram_profile);
  const matches = profile !== PROFILE_OFF
    && uiState.status === 'resolved'
    && uiState.typeId === String(typeId || raw.model_train_type || '').trim()
    && uiState.profile === profile
    && uiState.signature === trainingVramProfileSignature(raw, typeId);
  const effective = matches ? { ...raw, ...objectValue(uiState.managedValues) } : { ...raw };
  if (profile !== PROFILE_OFF) {
    effective.training_vram_profile_control = 'managed';
  }
  if (matches && Number(uiState.detectedVramGb) > 0) {
    effective.detected_vram_gb = Number(uiState.detectedVramGb);
  }
  return effective;
}

export function isTrainingVramManagedField(config = {}, uiState = {}, typeId = '', key = '') {
  if (!key || key === 'training_vram_profile') return false;
  const effective = applyTrainingVramProfileOverlay(config, uiState, typeId);
  const profile = normalizeTrainingVramProfile(config.training_vram_profile);
  return profile !== PROFILE_OFF
    && uiState.status === 'resolved'
    && uiState.signature === trainingVramProfileSignature(config, typeId)
    && uiState.managedKeys?.includes(key)
    && Object.hasOwn(effective, key);
}

export function createTrainingVramProfileController({ state, api, onResolved }) {
  function publish() {
    if (typeof onResolved === 'function') onResolved();
  }

  function clearFor(signature, typeId, profile, status = 'idle', warning = '') {
    const nextId = Number(state.trainingVramProfileUi?.requestId || 0) + 1;
    state.trainingVramProfileUi = {
      ...createTrainingVramProfileUiState(),
      signature,
      requestId: nextId,
      typeId,
      profile,
      status,
      warning,
    };
    return nextId;
  }

  async function refresh({ force = false } = {}) {
    const config = state.config || {};
    const typeId = String(state.activeTrainingType || config.model_train_type || '').trim();
    const profile = normalizeTrainingVramProfile(config.training_vram_profile);
    const signature = trainingVramProfileSignature(config, typeId);
    const previous = state.trainingVramProfileUi || createTrainingVramProfileUiState();
    if (profile === PROFILE_OFF) {
      if (previous.status !== 'idle' || previous.signature !== signature) {
        clearFor(signature, typeId, profile);
      }
      return null;
    }
    if (!force && previous.signature === signature && ['loading', 'resolved', 'unsupported'].includes(previous.status)) {
      return null;
    }

    const requestId = clearFor(signature, typeId, profile, 'loading');
    try {
      const response = await api.resolveTrainingConfig({
        schema_id: typeId,
        config: {
          ...config,
          schema_id: typeId,
          model_train_type: typeId,
          training_vram_profile_control: 'managed',
        },
        include_trainer_config_preview: false,
      });
      const currentSignature = trainingVramProfileSignature(state.config || {}, state.activeTrainingType || '');
      if (state.trainingVramProfileUi?.requestId !== requestId || currentSignature !== signature) return null;
      const decision = extractTrainingVramProfileDecision(response);
      state.trainingVramProfileUi = {
        ...state.trainingVramProfileUi,
        status: decision.enabled ? 'resolved' : 'unsupported',
        managedValues: decision.managedValues,
        managedKeys: decision.managedKeys,
        detectedVramGb: decision.detectedVramGb,
        evidenceStatus: decision.evidenceStatus,
        warning: decision.warning,
      };
      publish();
      return decision;
    } catch (error) {
      if (state.trainingVramProfileUi?.requestId !== requestId) return null;
      state.trainingVramProfileUi = {
        ...state.trainingVramProfileUi,
        status: 'error',
        managedValues: {},
        managedKeys: [],
        detectedVramGb: 0,
        warning: error?.message || '训练显存档位解析失败',
      };
      publish();
      return null;
    }
  }

  return { refresh };
}
