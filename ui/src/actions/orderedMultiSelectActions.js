import {
  moveOrderedMultiSelect,
  orderedMultiSelectOptions,
  toggleOrderedMultiSelect,
} from '../features/orderedMultiSelect.js';

export function createOrderedMultiSelectActions({
  state,
  syncConfigState,
  updateJSONPreview,
  renderView,
}) {
  // 拖拽源索引存在 state 上而不是模块级变量:renderView 会整块重绘 DOM,
  // HTML5 dataTransfer 在 Windows WebView2 里对 setData 之后的重绘并不可靠。
  const dragState = () => {
    state.orderedMultiSelectDrag ||= { key: '', from: -1 };
    return state.orderedMultiSelectDrag;
  };

  function commit(fieldKey, nextValue) {
    state.fieldUndo ||= {};
    if (!Object.hasOwn(state.fieldUndo, fieldKey)) state.fieldUndo[fieldKey] = state.config[fieldKey];
    state.config[fieldKey] = nextValue;
    syncConfigState?.();
    if (!syncConfigState) updateJSONPreview?.();
    renderView?.('config');
    return true;
  }

  function toggleOrderedMultiSelectItem(fieldKey, target) {
    const key = String(fieldKey || '');
    if (!key) return false;
    const options = orderedMultiSelectOptions(key);
    return commit(key, toggleOrderedMultiSelect(state.config[key], options, target));
  }

  function moveOrderedMultiSelectItem(fieldKey, fromIndex, toIndex) {
    const key = String(fieldKey || '');
    if (!key) return false;
    const options = orderedMultiSelectOptions(key);
    return commit(key, moveOrderedMultiSelect(state.config[key], options, fromIndex, toIndex));
  }

  function beginOrderedMultiSelectDrag(fieldKey, fromIndex) {
    const drag = dragState();
    drag.key = String(fieldKey || '');
    drag.from = Number(fromIndex);
    return true;
  }

  function dropOrderedMultiSelect(fieldKey, toIndex) {
    const drag = dragState();
    const key = String(fieldKey || '');
    const sourceKey = String(drag.key || '');
    const from = Number(drag.from);
    drag.key = '';
    drag.from = -1;
    // 跨字段拖拽或没有有效拖拽源:什么都不做,而不是把值改成猜测结果。
    if (!key || sourceKey !== key || !Number.isInteger(from) || from < 0) return false;
    return moveOrderedMultiSelectItem(key, from, toIndex);
  }

  function endOrderedMultiSelectDrag() {
    const drag = dragState();
    drag.key = '';
    drag.from = -1;
    return true;
  }

  return {
    toggleOrderedMultiSelectItem,
    moveOrderedMultiSelectItem,
    beginOrderedMultiSelectDrag,
    dropOrderedMultiSelect,
    endOrderedMultiSelectDrag,
  };
}
