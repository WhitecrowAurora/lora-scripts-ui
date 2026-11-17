import { when } from './schemaCommon.js';

// 主体隔离：一张图里有多个主体要分别触发时，特征泄漏的根源是 caption 里还留着
// 别人的 trigger / class word。这一节只做语料层的改写与样本权重，不新增损失项。
const enabled = when('subject_isolation_enabled', true);

export const SUBJECT_ISOLATION_FIELDS = [
  {
    key: 'subject_isolation_enabled', type: 'boolean', label: '启用主体隔离训练',
    title: 'subject_isolation_enabled',
    desc: '多人物 / 多主体训练时按主体改写 caption，去掉别人的触发词与类别词。默认关闭；开启时至少要配两个主体，只配一个会直接报错，因为那时开关什么都不会做。',
    defaultValue: false,
  },
  {
    key: 'subject_isolation_subjects', type: 'textarea', label: '主体列表（JSON）',
    title: 'subject_isolation_subjects',
    desc: '形如 [{"name":"A","trigger":"sks_a","class_words":["man","suit"]}, {...}]。name 用于子集归属映射，trigger 与 class_words 才是被隔离的对象。',
    defaultValue: '', visibleWhen: enabled,
  },
  {
    key: 'subject_isolation_boost', type: 'number', label: '样本不足主体的加权',
    title: 'subject_isolation_boost',
    desc: '给样本较少的那个主体放大配置权重，夹在 1..4；不改动任何已有损失的量纲。',
    defaultValue: 1.0, min: 1, max: 4, step: 0.1, visibleWhen: enabled,
  },
  {
    key: 'subject_isolation_subset_subjects', type: 'textarea', label: '子集 → 主体归属（JSON）',
    title: 'subject_isolation_subset_subjects',
    desc: '形如 {"<subset_id>": "<主体 name>"}。归属必须写在这里：一张图同时出现两个 trigger 时无法从 caption 反推它属于谁。留空表示不做逐子集隔离。',
    defaultValue: '', visibleWhen: enabled,
  },
];

// 与 dataset_intelligence 一样挂进各族已有的数据集设置，不新开分组：这些字段
// 管的就是数据集侧的行为，单独一页只会让人以为还有别的入口。
export function withSubjectIsolation(sections) {
  if (sections.some((section) => section.id === 'subject-isolation')) return sections;
  return sections.map((section) => (section.id === 'dataset-settings'
    ? { ...section, fields: [...section.fields, ...SUBJECT_ISOLATION_FIELDS] }
    : section));
}
