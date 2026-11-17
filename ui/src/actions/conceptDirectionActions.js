import { editConceptDirectionPairs } from '../features/conceptDirectionPairs.js';

export function createConceptDirectionActions({ state, updateConfigValue, renderView }) {
  // The field key is the first argument so the same editor can serve
  // concept_direction_pairs and slider_lora_pairs without crossing wires.
  function change(fieldKey, action, index, key, value) {
    const next = editConceptDirectionPairs(state.config[fieldKey], action, index, key, value);
    void updateConfigValue(fieldKey, next);
    if (action !== 'update') renderView('config');
  }
  return {
    addConceptDirectionPair: (fieldKey) => change(fieldKey, 'add'),
    removeConceptDirectionPair: (fieldKey, index) => change(fieldKey, 'remove', Number(index)),
    updateConceptDirectionPair: (fieldKey, index, key, value) => change(fieldKey, 'update', Number(index), key, value),
    refreshConceptDirectionPairs: () => renderView('config'),
  };
}
