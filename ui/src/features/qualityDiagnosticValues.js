// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
export function qualityClassListDisplayValue(key, value) {
  return Array.isArray(value)
    && (key === 'quality_class_labels' || key === 'quality_class_prompt_labels')
    ? JSON.stringify(value)
    : value;
}
