// Canonical theory-name migration for legacy saved WebUI configs.
// Legacy keys are accepted on read only; every returned object uses lulynx keys.

export const THEORY_NAME_ALIASES = Object.freeze({
  prefix_tuning_length: 'lulynx_hidden_state_prelude_length',
  postfix_tuning_length: 'lulynx_hidden_state_epilogue_length',
  prefix_tuning_init: 'lulynx_hidden_state_prompt_init',
  svd_grad_proj_enabled: 'lulynx_svd_gradient_filter_enabled',
  svd_grad_proj_rank: 'lulynx_svd_gradient_filter_rank',
  svd_grad_proj_update_interval: 'lulynx_svd_gradient_filter_update_interval',
  svd_grad_proj_warmup_steps: 'lulynx_svd_gradient_filter_warmup_steps',
  svd_grad_proj_scale: 'lulynx_svd_gradient_filter_scale',
  anima_ema_feat_align_enabled: 'lulynx_ema_cosine_self_distill_enabled',
  anima_ema_feat_align_weight: 'lulynx_ema_cosine_self_distill_weight',
  anima_ema_feat_align_teacher_layers: 'lulynx_ema_cosine_self_distill_teacher_layers',
  anima_ema_feat_align_student_layers: 'lulynx_ema_cosine_self_distill_student_layers',
  anima_ema_feat_align_decay: 'lulynx_ema_cosine_self_distill_decay',
  lpips_latent_enabled: 'lulynx_latent_feature_distillation_enabled',
  lpips_latent_weight: 'lulynx_latent_feature_distillation_weight',
  lpips_latent_feature_layers: 'lulynx_latent_feature_distillation_layers',
  lpips_latent_feature_weight: 'lulynx_latent_feature_distillation_layer_weights',
  lpips_latent_normalize_features: 'lulynx_latent_feature_distillation_normalize',
  lpips_latent_min_t: 'lulynx_latent_feature_distillation_min_sigma',
  lpips_latent_max_t: 'lulynx_latent_feature_distillation_max_sigma',
  use_allora: 'lulynx_gradient_norm_rescale_enabled',
  allora_eps: 'lulynx_gradient_norm_rescale_eps',
  allora_norm_threshold: 'lulynx_gradient_norm_rescale_threshold',
  krona_allora: 'krona_lulynx_gradient_norm_rescale_enabled',
  krona_allora_eta: 'krona_lulynx_gradient_norm_rescale_eta',
  cdka_allora: 'cdka_lulynx_gradient_norm_rescale_enabled',
  sra2_haste_enabled: 'lulynx_sra2_alignment_enabled',
  sra2_haste_capture_layers: 'lulynx_sra2_alignment_capture_layers',
  sra2_haste_loss_type: 'lulynx_sra2_alignment_loss_type',
  sra2_haste_base_weight: 'lulynx_sra2_alignment_base_weight',
  sra2_haste_start_step: 'lulynx_sra2_alignment_start_step',
  sra2_haste_stop_step: 'lulynx_sra2_alignment_stop_step',
  sra2_haste_decay_start_step: 'lulynx_sra2_alignment_decay_start_step',
  sra2_haste_decay_end_step: 'lulynx_sra2_alignment_decay_end_step',
  sra2_haste_min_weight: 'lulynx_sra2_alignment_min_weight',
  sra2_haste_plateau_patience: 'lulynx_sra2_alignment_plateau_patience',
  sra2_haste_min_relative_improvement: 'lulynx_sra2_alignment_min_relative_improvement',
  sra2_haste_normalize_targets: 'lulynx_sra2_alignment_normalize_targets',
  sra2_haste_stop_grad_target: 'lulynx_sra2_alignment_stop_grad_target',
});

export function normalizeTheoryNameAliases(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const normalized = { ...config };
  for (const [legacy, canonical] of Object.entries(THEORY_NAME_ALIASES)) {
    if (normalized[canonical] === undefined && normalized[legacy] !== undefined) {
      normalized[canonical] = normalized[legacy];
    }
    delete normalized[legacy];
  }
  return normalized;
}
