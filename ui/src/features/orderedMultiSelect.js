// features/orderedMultiSelect.js — 有序多选字段的纯逻辑层
//
// 后端契约不变:这些字段在 config 里始终是**逗号分隔字符串**
//   - preference_models            → core/scorers/preference_scorer.py 归一化
//   - concept_geometry_source_priority → concept_geometry_metadata._parse_source_priority
// 所以本模块只负责「字符串 ⇄ 有序取值列表」,不引入数组类型。
//
// 别名表与后端一一对应:后端认的别名,UI 载入旧配置时也必须认,否则会把
// caption / pick 这类合法旧值当成未知值丢掉。

export const PREFERENCE_MODEL_OPTIONS = [
  { value: 'pickscore', label: 'PickScore', aliases: ['pick'] },
  { value: 'imagereward', label: 'ImageReward', aliases: ['reward'] },
  { value: 'hpsv2', label: 'HPS v2', aliases: ['hps'] },
];

export const CONCEPT_GEOMETRY_SOURCE_OPTIONS = [
  { value: 'explicit', label: '显式标注', aliases: ['caption'] },
  { value: 'folder', label: '目录名', aliases: ['directory'] },
  { value: 'nl', label: '自然语言', aliases: ['natural', 'natural_language'] },
  { value: 'identity', label: '身份/桶', aliases: ['bucket'] },
  { value: 'tag', label: '标签' },
  { value: 'stem', label: '文件名' },
];

// 供 actions 层按 field.key 反查候选集(避免 actions 反向依赖 schema 模块)。
export const ORDERED_MULTISELECT_CATALOGS = {
  preference_models: PREFERENCE_MODEL_OPTIONS,
  concept_geometry_source_priority: CONCEPT_GEOMETRY_SOURCE_OPTIONS,
};

export function orderedMultiSelectOptions(fieldOrKey) {
  if (fieldOrKey && typeof fieldOrKey === 'object') {
    const inline = Array.isArray(fieldOrKey.options) ? fieldOrKey.options : null;
    return inline || ORDERED_MULTISELECT_CATALOGS[fieldOrKey.key] || [];
  }
  return ORDERED_MULTISELECT_CATALOGS[String(fieldOrKey || '')] || [];
}

function canonicalMap(options) {
  const map = new Map();
  for (const option of options) {
    const value = String(option?.value ?? option ?? '').trim().toLowerCase();
    if (!value) continue;
    map.set(value, value);
    for (const alias of option?.aliases || []) {
      map.set(String(alias).trim().toLowerCase(), value);
    }
  }
  return map;
}

/** 后端两处都按 `[,>\s;]+` 切分,这里保持同一宽容度。 */
export function splitOrderedValue(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
  return String(raw ?? '').split(/[,>;\s]+/).map((item) => item.trim()).filter(Boolean);
}

/**
 * 解析成渲染所需的三段:已选(有序)、未选、无法识别。
 * 无法识别的值**不丢弃**——原样保留在 unknown 里并继续写回,避免 UI 静默吃掉
 * 用户手改的配置。
 */
export function orderedMultiSelectRows(raw, options) {
  const catalog = options || [];
  const canonical = canonicalMap(catalog);
  const labels = new Map(catalog.map((option) => [
    String(option?.value ?? option),
    String(option?.label ?? option?.value ?? option),
  ]));
  const selected = [];
  const unknown = [];
  const seen = new Set();
  for (const token of splitOrderedValue(raw)) {
    const resolved = canonical.get(token.toLowerCase());
    if (!resolved) {
      if (!seen.has(token)) {
        seen.add(token);
        unknown.push(token);
      }
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    selected.push({ value: resolved, label: labels.get(resolved) || resolved });
  }
  const unselected = catalog
    .map((option) => String(option?.value ?? option))
    .filter((value) => !seen.has(value))
    .map((value) => ({ value, label: labels.get(value) || value }));
  return { selected, unselected, unknown };
}

export function serializeOrderedMultiSelect(rows) {
  const values = (rows || []).map((row) => (row && typeof row === 'object' ? row.value : row));
  return values.map((value) => String(value ?? '').trim()).filter(Boolean).join(',');
}

function withUnknown(selected, unknown) {
  return serializeOrderedMultiSelect([...selected, ...(unknown || []).map((value) => ({ value }))]);
}

export function toggleOrderedMultiSelect(raw, options, target) {
  const { selected, unselected, unknown } = orderedMultiSelectRows(raw, options);
  const value = String(target ?? '').trim();
  if (!value) return withUnknown(selected, unknown);
  if (selected.some((row) => row.value === value)) {
    return withUnknown(selected.filter((row) => row.value !== value), unknown);
  }
  const added = unselected.find((row) => row.value === value) || { value, label: value };
  return withUnknown([...selected, added], unknown);
}

export function moveOrderedMultiSelect(raw, options, fromIndex, toIndex) {
  const { selected, unknown } = orderedMultiSelectRows(raw, options);
  const from = Number(fromIndex);
  let to = Number(toIndex);
  if (!Number.isInteger(from) || !selected[from]) return withUnknown(selected, unknown);
  if (!Number.isInteger(to)) return withUnknown(selected, unknown);
  to = Math.min(selected.length - 1, Math.max(0, to));
  if (to === from) return withUnknown(selected, unknown);
  const next = selected.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return withUnknown(next, unknown);
}
