import assert from 'node:assert/strict';
import { isAttentionBackendAvailable, makeAttentionOptions } from '../src/features/attentionCapabilities.js';

const profiles = [
  {
    id: 'standard',
    supported_attention_backends: ['sdpa', 'xformers', 'torch'],
    available_attention_backends: ['sdpa', 'torch'],
  },
  {
    id: 'flash2',
    default_attention_backend: 'flash2',
    supported_attention_backends: ['flash2', 'sdpa', 'xformers', 'torch'],
    available_attention_backends: ['flash2', 'sdpa', 'torch'],
    module_attention_capabilities: [
      {
        family: 'ltx23',
        status: 'implemented_validation',
        runtime_requestable: true,
        module_wired: true,
        real_model_signed: true,
      },
    ],
    attention_backends: [
      {
        id: 'flash2',
        supported_model_families: [],
        explicit_model_families: ['ltx23'],
        supported_trainer_paths: ['lora', 'full_finetune'],
      },
    ],
  },
];

const values = [
  { value: '', label: '自动' },
  { value: 'sdpa', label: 'SDPA' },
  { value: 'xformers', label: 'xFormers' },
  { value: 'flash', label: 'FlashAttention 2' },
];

assert.equal(isAttentionBackendAvailable('sdpa', profiles, { runtime: { runtime: { environment: 'standard' } } }), true);
assert.equal(isAttentionBackendAvailable('xformers', profiles, { runtime: { runtime: { environment: 'standard' } } }), false);
assert.equal(isAttentionBackendAvailable('flash2', profiles, { runtime: { runtime: { environment: 'standard' } } }), false);
assert.equal(isAttentionBackendAvailable('flash2', profiles, {
  activeTrainingType: 'ltx25-lora', runtime: { runtime: { environment: 'flash2' } },
}), true);
assert.equal(
  isAttentionBackendAvailable('flash2', [], { activeTrainingType: 'lumina-lora' }),
  false,
  'missing profile API must fail closed in direct availability queries',
);
assert.equal(isAttentionBackendAvailable('sdpa', [], { activeTrainingType: 'lumina-lora' }), true);

const standardOptions = makeAttentionOptions(values, profiles, { runtime: { runtime: { environment: 'standard' } } });
assert.equal(standardOptions.find((option) => option.value === 'sdpa')?.disabled, false);
assert.equal(standardOptions.find((option) => option.value === 'xformers')?.disabled, true);
assert.equal(standardOptions.find((option) => option.value === 'flash')?.disabled, true);

const flashOptions = makeAttentionOptions(values, profiles, {
  activeTrainingType: 'ltx25-lora', runtime: { runtime: { runtime_id: 'flash2' } },
});
assert.equal(flashOptions.find((option) => option.value === 'flash')?.disabled, false);
assert.equal(
  makeAttentionOptions(values, [], { activeTrainingType: 'lumina-lora' })
    .find((option) => option.value === 'flash')?.disabled,
  true,
  'missing profile API must fail closed for external attention backends',
);

console.log('attentionCapabilitiesSmoke: ok');
