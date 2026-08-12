import assert from 'node:assert/strict';
import {
  TRAINING_TYPES,
  applyBackendConfigOptions,
  buildRunConfig,
  createDefaultConfig,
  getFieldDefinition,
} from '../src/schemaIndex.js';
import {
  getMiniMaxH3CheckpointOptions,
  getMiniMaxH3ConfigErrors,
} from '../src/features/minimaxH3Config.js';
import { createTrainingActions } from '../src/actions/trainingActions.js';

const typeId = 'minimax-h3-lora';
assert.equal(TRAINING_TYPES.some((type) => type.id === typeId), true, 'MiniMax H3 should be selectable');

const defaults = createDefaultConfig(typeId);
assert.equal(defaults.model_train_type, typeId);
assert.equal(defaults.h3_partition, 'fl2va_pruned');
assert.equal(defaults.h3_cfg_preservation_enabled, true);
assert.equal(defaults.h3_cfg_scale, 4);
assert.equal(defaults.h3_timestep_shift, 12);
assert.equal(defaults.h3_image_timestep_shift, 1);
assert.equal(defaults.h3_video_sigma_shift, 12);
assert.equal(defaults.h3_audio_sigma_shift, 3);
assert.equal(defaults.h3_audio_loss_weight, 1);
assert.equal(defaults.h3_frame_count, 39);
assert.equal(defaults.h3_cache_build_enabled, true);
assert.equal(defaults.h3_cache_rebuild, false);
assert.equal(defaults.h3_cache_include_audio, false);
assert.equal(defaults.h3_cache_max_pixels, 262144);
assert.equal(defaults.h3_cache_max_samples, 0);
assert.equal(defaults.h3_blocks_to_swap, 48);
assert.equal(defaults.h3_block_swap_strategy, 'async');
assert.equal(defaults.h3_int8_gemm_mode, 'oracle');
assert.equal(defaults.h3_preserve_lora_master_dtype, true);
assert.equal(defaults.h3_checkpoint_mode, 'unsloth');
assert.equal(defaults.h3_cache_latents, true);
assert.equal(defaults.h3_cache_text_encoder_outputs, true);
assert.equal(defaults.learning_rate, '1e-5');
assert.equal(defaults.unet_lr, '1e-5');

const checkpointOptionsWithSwap = getMiniMaxH3CheckpointOptions(defaults);
assert.equal(checkpointOptionsWithSwap.find((option) => option.value === 'unsloth')?.disabled, undefined);
assert.equal(checkpointOptionsWithSwap.find((option) => option.value === 'selective')?.disabled, true);
assert.equal(checkpointOptionsWithSwap.find((option) => option.value === 'full')?.disabled, true);
assert.equal(
  getMiniMaxH3CheckpointOptions({ ...defaults, h3_blocks_to_swap: 0 }).some((option) => option.disabled),
  false,
);
assert.equal(
  getMiniMaxH3ConfigErrors({ ...defaults, h3_checkpoint_mode: 'full' }, typeId).length,
  1,
);
assert.deepEqual(getMiniMaxH3ConfigErrors(defaults, typeId), []);
const trainingActions = createTrainingActions({
  state: {
    activeTrainingType: typeId,
    config: { ...defaults, h3_checkpoint_mode: 'selective' },
    runtime: null,
  },
});
const clientConflicts = trainingActions.validateConfigConflicts();
assert.equal(
  clientConflicts.errors.some((message) => message.includes('必须使用 Unsloth')),
  true,
);

assert.equal(applyBackendConfigOptions({ optimizers: ['H3AuditOptimizer'] }), true);
const optimizerField = getFieldDefinition('optimizer_type', typeId);
const optimizerOptions = typeof optimizerField?.options === 'function'
  ? optimizerField.options(defaults)
  : optimizerField?.options;
const optimizerValues = Array.from(optimizerOptions || []).map((option) => (
  option && typeof option === 'object' ? option.value : option
));
assert.equal(optimizerValues.includes('H3AuditOptimizer'), true);

for (const key of [
  'h3_transformer_path',
  'h3_text_encoder_path',
  'h3_video_vae_path',
  'h3_audio_vae_path',
]) {
  assert.equal(getFieldDefinition(key, typeId)?.type, 'file', `${key} should use a model-file picker`);
}
assert.equal(getFieldDefinition('h3_tokenizer_path', typeId)?.type, 'folder');
assert.equal(getFieldDefinition('h3_cache_dir', typeId)?.type, 'folder');

assert.equal(getFieldDefinition('h3_training_adapter_path', typeId), undefined, 'training adapter must stay out of H3 UI');
assert.equal(getFieldDefinition('distillation_enabled', typeId), undefined, 'generic distillation must stay out of H3 UI');
assert.equal(getFieldDefinition('blocks_to_swap', typeId), undefined, 'H3 must use its dedicated swap key');

const payload = buildRunConfig({
  ...defaults,
  h3_transformer_path: 'E:/dev_model/minimax-h3/transformer.safetensors',
  h3_text_encoder_path: 'E:/dev_model/minimax-h3/text_encoder.safetensors',
  h3_video_vae_path: 'E:/dev_model/minimax-h3/video_vae.safetensors',
  h3_audio_vae_path: 'E:/dev_model/minimax-h3/audio_vae.safetensors',
  h3_tokenizer_path: 'E:/dev_model/minimax-h3/processor',
  h3_cache_dir: 'E:/dev_model/minimax-h3/cache',
  h3_cache_include_audio: true,
  h3_cache_max_pixels: 131072,
  h3_cache_max_samples: 12,
  h3_audio_loss_weight: 0.75,
  h3_frame_count: 63,
  h3_checkpoint_mode: 'unsloth',
  h3_block_swap_strategy: 'pipeline',
  h3_int8_gemm_mode: 'w8a16',
  h3_training_adapter_path: 'must-not-leak.safetensors',
  distillation_enabled: true,
}, typeId);

assert.equal(payload.model_train_type, typeId);
assert.equal(payload.h3_cfg_preservation_enabled, true);
assert.equal(payload.h3_cfg_scale, 4);
assert.equal(payload.h3_video_sigma_shift, 12);
assert.equal(payload.h3_audio_sigma_shift, 3);
assert.equal(payload.h3_audio_loss_weight, 0.75);
assert.equal(payload.h3_frame_count, 63);
assert.equal(payload.h3_tokenizer_path, 'E:/dev_model/minimax-h3/processor');
assert.equal(payload.h3_cache_dir, 'E:/dev_model/minimax-h3/cache');
assert.equal(payload.h3_cache_include_audio, true);
assert.equal(payload.h3_cache_max_pixels, 131072);
assert.equal(payload.h3_cache_max_samples, 12);
assert.equal(payload.h3_blocks_to_swap, 48);
assert.equal(payload.h3_checkpoint_mode, 'unsloth');
assert.equal(payload.h3_block_swap_strategy, 'pipeline');
assert.equal(payload.h3_int8_gemm_mode, 'w8a16');
assert.equal(payload.learning_rate, 1e-5);
assert.equal(payload.unet_lr, 1e-5);
assert.equal(payload.h3_training_adapter_path, undefined);
assert.equal(payload.distillation_enabled, undefined);

const cfgDisabledPayload = buildRunConfig({
  ...defaults,
  h3_cfg_preservation_enabled: false,
}, typeId);
assert.equal(cfgDisabledPayload.h3_cfg_preservation_enabled, false);
assert.equal(cfgDisabledPayload.h3_cfg_scale, undefined, 'hidden CFG scale should not leak when preservation is disabled');

console.log('minimaxH3SchemaSmoke: ok');
