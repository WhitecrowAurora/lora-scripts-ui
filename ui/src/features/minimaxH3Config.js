const H3_CHECKPOINT_OPTIONS = [
  { value: 'unsloth', label: 'Unsloth（推荐）' },
  { value: 'selective', label: 'Selective' },
  { value: 'full', label: 'Full recompute' },
];

const H3_SWAP_CHECKPOINT_CONFLICT =
  'MiniMax H3 开启 Block Swap 时必须使用 Unsloth 激活检查点；请将交换 Block 数设为 0，或改回 Unsloth。';

function isMiniMaxH3Route(config, typeId) {
  const route = `${typeId || ''} ${config?.model_train_type || ''}`.toLowerCase();
  return route.includes('minimax-h3') || route.includes('minimax_h3');
}

export function getMiniMaxH3CheckpointOptions(config = {}) {
  const swapEnabled = Number(config.h3_blocks_to_swap || 0) > 0;
  return H3_CHECKPOINT_OPTIONS.map((option) => (
    swapEnabled && option.value !== 'unsloth'
      ? {
        ...option,
        disabled: true,
        disabledReason: 'Block Swap 开启时不可用',
      }
      : option
  ));
}

export function getMiniMaxH3ConfigErrors(config = {}, typeId = '') {
  if (!isMiniMaxH3Route(config, typeId)) return [];
  const swapEnabled = Number(config.h3_blocks_to_swap || 0) > 0;
  const checkpointMode = String(config.h3_checkpoint_mode || 'unsloth').trim().toLowerCase();
  return swapEnabled && checkpointMode !== 'unsloth'
    ? [H3_SWAP_CHECKPOINT_CONFLICT]
    : [];
}
