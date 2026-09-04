import assert from 'node:assert/strict';
import {
  ALL_TRAINING_TYPES,
  buildRunConfig,
  createDefaultConfig,
  getFieldDefinition,
  isFieldVisible,
} from '../src/schemaIndex.js';

const typeId = 'universal-dit-lora';
const trainingTypeIds = ALL_TRAINING_TYPES.map((item) => item.id);
assert.equal(trainingTypeIds.includes(typeId), true, 'Universal DiT must remain an explicit training type');
assert.equal(ALL_TRAINING_TYPES.find((item) => item.id === typeId)?.experimental, true);

const defaults = createDefaultConfig(typeId);
assert.equal(defaults.model_train_type, typeId);
assert.equal(defaults.universal_dit_enabled, true, 'selecting the experimental route is the explicit opt-in');
assert.equal(defaults.universal_dit_probe_mode, 'auto');
assert.equal(defaults.universal_dit_objective_template, 'auto');
assert.equal(defaults.universal_dit_target_policy, 'attention_mlp');
assert.equal(defaults.universal_dit_allow_fused_qkv, false);
assert.equal(defaults.universal_dit_allow_remote_download, false);
assert.equal(defaults.universal_dit_trust_remote_code, false);

const contractKeys = [
  'universal_dit_probe_mode',
  'universal_dit_objective_template',
  'universal_dit_target_policy',
  'universal_dit_allow_fused_qkv',
  'universal_dit_allow_remote_download',
  'universal_dit_trust_remote_code',
];
for (const key of contractKeys) {
  const field = getFieldDefinition(key, typeId);
  assert.ok(field, key + ' should remain in the Universal DiT schema');
}

const targetModulesField = getFieldDefinition('universal_dit_target_modules_json', typeId);
const probeInputsField = getFieldDefinition('universal_dit_probe_inputs_json', typeId);
assert.equal(isFieldVisible(targetModulesField, defaults), false);
assert.equal(isFieldVisible(targetModulesField, {
  ...defaults,
  universal_dit_target_policy: 'explicit',
}), true);
assert.equal(isFieldVisible(probeInputsField, {
  ...defaults,
  universal_dit_probe_mode: 'static',
}), false);
assert.equal(isFieldVisible(probeInputsField, {
  ...defaults,
  universal_dit_probe_mode: 'forward',
}), true);

const defaultPayload = buildRunConfig(defaults, typeId);
assert.equal(defaultPayload.model_train_type, typeId);
assert.equal(defaultPayload.universal_dit_enabled, true);
assert.equal(defaultPayload.universal_dit_probe_mode, 'auto');
assert.equal(defaultPayload.universal_dit_objective_template, 'auto');
assert.equal(defaultPayload.universal_dit_target_policy, 'attention_mlp');
assert.equal(defaultPayload.universal_dit_target_modules_json, undefined);
assert.equal(defaultPayload.universal_dit_probe_inputs_json, undefined);

const explicitTargets = '["blocks.0.attn.to_q","blocks.0.mlp.fc1"]';
const probeInputs = '{"kwargs":{"hidden_states":{"shape":[1,4,8]}}}';
const enabledPayload = buildRunConfig({
  ...defaults,
  universal_dit_probe_mode: 'train_smoke',
  universal_dit_objective_template: 'flow_matching',
  universal_dit_target_policy: 'explicit',
  universal_dit_allow_fused_qkv: true,
  universal_dit_allow_remote_download: true,
  universal_dit_trust_remote_code: true,
  universal_dit_target_modules_json: explicitTargets,
  universal_dit_probe_inputs_json: probeInputs,
}, typeId);
assert.equal(enabledPayload.model_train_type, typeId);
assert.equal(enabledPayload.universal_dit_enabled, true);
assert.equal(enabledPayload.universal_dit_probe_mode, 'train_smoke');
assert.equal(enabledPayload.universal_dit_objective_template, 'flow_matching');
assert.equal(enabledPayload.universal_dit_target_policy, 'explicit');
assert.equal(enabledPayload.universal_dit_allow_fused_qkv, true);
assert.equal(enabledPayload.universal_dit_allow_remote_download, true);
assert.equal(enabledPayload.universal_dit_trust_remote_code, true);
assert.equal(enabledPayload.universal_dit_target_modules_json, explicitTargets);
assert.equal(enabledPayload.universal_dit_probe_inputs_json, probeInputs);

const staleHiddenPayload = buildRunConfig({
  ...defaults,
  universal_dit_probe_mode: 'static',
  universal_dit_target_policy: 'attention_mlp',
  universal_dit_target_modules_json: explicitTargets,
  universal_dit_probe_inputs_json: probeInputs,
}, typeId);
assert.equal(staleHiddenPayload.universal_dit_target_modules_json, undefined);
assert.equal(staleHiddenPayload.universal_dit_probe_inputs_json, undefined);

const sdxlDefaults = createDefaultConfig('sdxl-lora');
const sdxlPayload = buildRunConfig(sdxlDefaults, 'sdxl-lora');
assert.equal(sdxlDefaults.universal_dit_enabled, undefined, 'known model pages must not expose the Universal DiT switch');
assert.equal(sdxlPayload.universal_dit_enabled, undefined, 'known model payloads must not enter Universal DiT implicitly');

console.log('universalDitP8Smoke: ok');
