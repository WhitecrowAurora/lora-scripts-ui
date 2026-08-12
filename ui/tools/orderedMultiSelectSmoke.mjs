// 守卫:有序多选(可拖动排序)字段。
//
// 反向验证要点——这个组件真正要防的是"UI 静默吃值":
//   1. 后端契约仍是逗号串(preference_scorer / _parse_source_priority 都按串解析);
//   2. 别名(caption / pick / natural_language …)必须被认出来归一化,不能当未知值;
//   3. 未识别的取值必须**保留**并显式提示,不能被组件抹掉——用户手改过的配置
//      不该因为打开一次 UI 就被清空;
//   4. 顺序有语义(concept 来源优先级),move 必须真的换位且不丢未知值。

import assert from 'node:assert/strict';
import {
  CONCEPT_GEOMETRY_SOURCE_OPTIONS,
  PREFERENCE_MODEL_OPTIONS,
  moveOrderedMultiSelect,
  orderedMultiSelectOptions,
  orderedMultiSelectRows,
  serializeOrderedMultiSelect,
  splitOrderedValue,
  toggleOrderedMultiSelect,
} from '../src/features/orderedMultiSelect.js';
import { renderOrderedMultiSelectField } from '../src/renderers/orderedMultiSelect.js';
import { createOrderedMultiSelectActions } from '../src/actions/orderedMultiSelectActions.js';
import { S_QUALITY_EVAL } from '../src/schemaFieldGroups.js';
import { S_CONCEPT_GEOMETRY } from '../src/schemaFrontierGroups.js';

const PREF = PREFERENCE_MODEL_OPTIONS;
const GEO = CONCEPT_GEOMETRY_SOURCE_OPTIONS;

// ── 1. schema 已切到新类型,且候选集能按 key 反查到 ──
const prefField = S_QUALITY_EVAL.find((f) => f.key === 'preference_models');
assert.ok(prefField, 'preference_models 字段不存在');
assert.equal(prefField.type, 'ordered_multiselect', 'preference_models 还是纯文本框');
const geoField = S_CONCEPT_GEOMETRY.find((f) => f.key === 'concept_geometry_source_priority');
assert.ok(geoField, 'concept_geometry_source_priority 字段不存在');
assert.equal(geoField.type, 'ordered_multiselect', 'concept_geometry_source_priority 还是纯文本框');
assert.equal(orderedMultiSelectOptions(prefField).length, 3);
assert.equal(orderedMultiSelectOptions('concept_geometry_source_priority').length, 6);

// 默认值必须完全落在候选集内,否则一打开 UI 就会显示"未识别取值"。
for (const [field, options] of [[prefField, PREF], [geoField, GEO]]) {
  const rows = orderedMultiSelectRows(field.defaultValue, options);
  assert.deepEqual(rows.unknown, [], `${field.key} 默认值含未识别取值: ${rows.unknown}`);
  assert.equal(serializeOrderedMultiSelect(rows.selected), field.defaultValue, `${field.key} 默认值往返不一致`);
}

// ── 2. 后端宽容度对齐:`[,>;\s]+` 都算分隔符 ──
assert.deepEqual(splitOrderedValue('explicit > folder,nl ; identity'), ['explicit', 'folder', 'nl', 'identity']);
assert.deepEqual(splitOrderedValue(['a', ' b ', '']), ['a', 'b']);

// ── 3. 别名归一 + 去重 + 顺序保持 ──
const aliased = orderedMultiSelectRows('caption,directory,natural_language,bucket', GEO);
assert.deepEqual(aliased.selected.map((r) => r.value), ['explicit', 'folder', 'nl', 'identity'], '后端别名未被 UI 识别');
assert.deepEqual(aliased.unknown, [], '别名被误判为未知取值');
const dedup = orderedMultiSelectRows('pick,pickscore,hps,hpsv2', PREF);
assert.deepEqual(dedup.selected.map((r) => r.value), ['pickscore', 'hpsv2'], '别名与正名未合并去重');

// ── 4. 未识别取值必须保留(核心:不静默吃值) ──
const withUnknown = orderedMultiSelectRows('pickscore,mysteryscore', PREF);
assert.deepEqual(withUnknown.unknown, ['mysteryscore']);
const afterToggle = toggleOrderedMultiSelect('pickscore,mysteryscore', PREF, 'hpsv2');
assert.equal(afterToggle, 'pickscore,hpsv2,mysteryscore', `toggle 丢掉了未识别取值: ${afterToggle}`);
const afterMove = moveOrderedMultiSelect('pickscore,hpsv2,mysteryscore', PREF, 1, 0);
assert.equal(afterMove, 'hpsv2,pickscore,mysteryscore', `move 丢掉了未识别取值: ${afterMove}`);

// ── 5. toggle 语义:未选则追加到末尾,已选则移除 ──
assert.equal(toggleOrderedMultiSelect('', PREF, 'imagereward'), 'imagereward');
assert.equal(toggleOrderedMultiSelect('pickscore,imagereward', PREF, 'pickscore'), 'imagereward');
assert.equal(toggleOrderedMultiSelect('pickscore', PREF, ''), 'pickscore', '空目标不应改动取值');

// ── 6. move 边界:越界 clamp、同位置 no-op、非法索引不动值 ──
assert.equal(moveOrderedMultiSelect('explicit,folder,nl', GEO, 0, 99), 'folder,nl,explicit', '越界索引未 clamp 到末尾');
assert.equal(moveOrderedMultiSelect('explicit,folder,nl', GEO, 1, 1), 'explicit,folder,nl', '同位置 move 不该改变顺序');
assert.equal(moveOrderedMultiSelect('explicit,folder', GEO, 7, 0), 'explicit,folder', '非法源索引不该改动取值');

// ── 7. 渲染:列表 + 序号 + 拖拽属性 + 未选池 + 未知提示 ──
const html = renderOrderedMultiSelectField({
  field: geoField,
  value: 'nl,explicit,weird_source',
  renderHeader: () => '<header>概念来源优先级</header>',
  renderFieldDescription: () => '',
  renderConflictHint: () => '',
});
assert.match(html, /data-ordered-multiselect-row="0"[^>]*data-value="nl"/, '首行应是 nl');
assert.match(html, /draggable="true"/, '缺少拖拽属性');
// 内联 handler 的参数经 escapeHtml(JSON.stringify(...)) 输出,引号是 &quot;(与 configForm 的
// fieldKeyArg 同一写法);浏览器解码实体后 JS 拿到的仍是普通字符串。
const K = '&quot;concept_geometry_source_priority&quot;';
assert.ok(html.includes(`beginOrderedMultiSelectDrag(${K}, 0)`), '缺少 dragstart 绑定');
assert.ok(html.includes(`dropOrderedMultiSelect(${K}, 1)`), '缺少 drop 绑定');
assert.ok(html.includes(`moveOrderedMultiSelectItem(${K}, 0, 1)`), '缺少下移绑定');
assert.match(html, /weird_source/, '未识别取值必须在界面上显示出来');
for (const value of ['folder', 'identity', 'tag', 'stem']) {
  assert.ok(html.includes(`toggleOrderedMultiSelectItem(${K}, &quot;${value}&quot;)`), `未选池缺少 ${value}`);
}

// disabled 时不给拖拽,避免锁定字段仍能被改。
const disabledHtml = renderOrderedMultiSelectField({
  field: geoField,
  value: 'explicit,folder',
  disabledAttr: ' disabled',
  renderHeader: () => '',
  renderFieldDescription: () => '',
  renderConflictHint: () => '',
});
assert.ok(!disabledHtml.includes('draggable="true"'), 'disabled 字段仍可拖拽');

// 空值时给出提示而不是渲染空列表。
const emptyHtml = renderOrderedMultiSelectField({
  field: prefField,
  value: '',
  renderHeader: () => '',
  renderFieldDescription: () => '',
  renderConflictHint: () => '',
});
assert.match(emptyHtml, /ordered-multiselect-empty/);

// ── 8. actions:写回逗号串 + 记录 undo + 拖拽跨字段不生效 ──
function harness(config) {
  const state = { config: { ...config }, fieldUndo: {} };
  let renders = 0;
  const actions = createOrderedMultiSelectActions({
    state,
    syncConfigState: () => {},
    updateJSONPreview: () => {},
    renderView: () => { renders += 1; },
  });
  return { state, actions, renders: () => renders };
}

const h1 = harness({ preference_models: 'pickscore' });
h1.actions.toggleOrderedMultiSelectItem('preference_models', 'hpsv2');
assert.equal(h1.state.config.preference_models, 'pickscore,hpsv2');
assert.equal(h1.state.fieldUndo.preference_models, 'pickscore', 'undo 未记录改动前的值');
h1.actions.toggleOrderedMultiSelectItem('preference_models', 'imagereward');
assert.equal(h1.state.fieldUndo.preference_models, 'pickscore', 'undo 应保留最早的值');
assert.ok(h1.renders() >= 2, 'commit 后必须重绘');

const h2 = harness({ concept_geometry_source_priority: 'explicit,folder,nl' });
h2.actions.beginOrderedMultiSelectDrag('concept_geometry_source_priority', 2);
assert.equal(h2.actions.dropOrderedMultiSelect('concept_geometry_source_priority', 0), true);
assert.equal(h2.state.config.concept_geometry_source_priority, 'nl,explicit,folder', '拖拽换位未生效');

const h3 = harness({ concept_geometry_source_priority: 'explicit,folder', preference_models: 'pickscore' });
h3.actions.beginOrderedMultiSelectDrag('preference_models', 0);
assert.equal(h3.actions.dropOrderedMultiSelect('concept_geometry_source_priority', 1), false, '跨字段拖拽应被拒绝');
assert.equal(h3.state.config.concept_geometry_source_priority, 'explicit,folder', '跨字段拖拽改动了目标字段');

const h4 = harness({ preference_models: 'pickscore,hpsv2' });
assert.equal(h4.actions.dropOrderedMultiSelect('preference_models', 0), false, '无拖拽源时 drop 应无效');
h4.actions.beginOrderedMultiSelectDrag('preference_models', 1);
h4.actions.endOrderedMultiSelectDrag();
assert.equal(h4.actions.dropOrderedMultiSelect('preference_models', 0), false, 'dragend 后拖拽源应被清空');
assert.equal(h4.state.config.preference_models, 'pickscore,hpsv2');

console.log('orderedMultiSelectSmoke: ok');
