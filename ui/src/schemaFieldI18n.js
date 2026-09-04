// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
/**
 * Thin schema field i18n for legacy WebUI.
 * Reuses Evolution EN catalogs (labels/descs/options/tabs/groups) without a full i18n stack rewrite.
 * Chinese path keeps schema-inline label/desc as source of truth.
 */
// 带 `with { type: 'json' }` 的标准写法:Vite 5.4/esbuild 0.21 与裸 node 都认。
// 早先的无属性写法只有 vite 能解析,导致所有 node 跑的 smoke 一碰 i18n 就整条挂掉。
import labelsEn from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaFieldLabelsEn.json' with { type: 'json' }
import descsEn from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaFieldDescsEn.json' with { type: 'json' }
import labelsEnByType from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaFieldLabelsEnByType.json' with { type: 'json' }
import descsEnByType from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaFieldDescsEnByType.json' with { type: 'json' }
import optionsEn from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaFieldOptionsEn.json' with { type: 'json' }
import tabsEn from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaTabsEn.json' with { type: 'json' }
import groupsEn from '../../../Lulynx-evolution-ui/ui/src/i18n/schemaGroupsEn.json' with { type: 'json' }

function langOf(lang) {
  const raw = String(lang || 'zh').toLowerCase()
  if (raw.startsWith('en')) return 'en'
  return 'zh'
}

// `key@typeId` 维度。同一个键在不同训练类型下常常声明了不同的中文(最坏的
// pretrained_model_name_or_path 有 18 种 desc / 23 种 label),平表一个键只装得下一条英文
// ⇒ 其余类型换到英文后会显示别的类型那句。嵌套表只收「与该键多数变体不同」的那些对。
// 与 label_en/desc_en 的关系:内联英文本来就是按类型写的,仍然优先。
function byTypeText(table, key, typeId) {
  if (!key || !typeId) return ''
  const bucket = table[key]
  const text = bucket && typeof bucket === 'object' ? bucket[String(typeId)] : ''
  return typeof text === 'string' && text.trim() ? text : ''
}

export function resolveFieldLabel(field, lang = 'zh', typeId = '') {
  if (!field) return ''
  if (langOf(lang) !== 'en') return field.label || field.key || ''
  const key = String(field.key || '')
  if (field.label_en) return field.label_en
  const scoped = byTypeText(labelsEnByType, key, typeId)
  if (scoped) return scoped
  if (key && labelsEn[key]) return labelsEn[key]
  return field.label || key
}

export function resolveFieldDesc(field, lang = 'zh', typeId = '') {
  if (!field) return ''
  if (langOf(lang) !== 'en') return field.desc || ''
  const key = String(field.key || '')
  if (field.desc_en) return field.desc_en
  const scoped = byTypeText(descsEnByType, key, typeId)
  if (scoped) return scoped
  if (key && descsEn[key]) return descsEn[key]
  return field.desc || ''
}

export function resolveOptionLabel(fieldKey, option, lang = 'zh') {
  const value = option && typeof option === 'object' ? option.value ?? option.id ?? option.key : option
  const inline = option && typeof option === 'object' ? option.label || option.name || String(value) : String(option)
  if (langOf(lang) !== 'en') return inline
  const key = String(fieldKey || '')
  // Evolution catalog is flat: "fieldKey|value" → label (not nested buckets).
  if (key && value != null) {
    const flat = optionsEn[`${key}|${String(value)}`]
    if (flat != null && String(flat).trim()) return String(flat)
  }
  const bucket = optionsEn[key]
  if (bucket && typeof bucket === 'object' && value != null && bucket[String(value)] != null) {
    return bucket[String(value)]
  }
  if (option && typeof option === 'object' && option.label_en) return option.label_en
  return inline
}

/** Resolve UI tab label (model/dataset/…/frontier). Falls back to Chinese registry label. */
export function resolveTabLabel(tab, lang = 'zh') {
  if (!tab) return ''
  const key = typeof tab === 'string' ? tab : String(tab.key || '')
  const zh = typeof tab === 'object' ? tab.label || key : key
  if (langOf(lang) !== 'en') return zh
  if (key && tabsEn[key]) return tabsEn[key]
  return zh
}

/** Resolve training-type group labels (LoRA / Edit / …). */
export function resolveGroupLabel(group, lang = 'zh') {
  const raw = String(group || '')
  if (!raw) return ''
  if (langOf(lang) !== 'en') return raw
  if (groupsEn[raw]) return groupsEn[raw]
  return raw
}

/** Section title: prefer title_en / titles catalog is not global; keep ZH unless title_en set. */
export function resolveSectionTitle(section, lang = 'zh') {
  if (!section) return ''
  if (langOf(lang) !== 'en') return section.title || section.id || ''
  if (section.title_en) return section.title_en
  return section.title || section.id || ''
}

export default {
  resolveFieldLabel,
  resolveFieldDesc,
  resolveOptionLabel,
  resolveTabLabel,
  resolveGroupLabel,
  resolveSectionTitle,
}
