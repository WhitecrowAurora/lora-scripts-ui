// Session-only drafts and submitted parameters never include credential inputs.
export function createTaggerTaskSnapshot({ container, state }) {
  const session = state.taggerSession ||= { draft: {}, submissions: {} };
  const fields = () => [...container.querySelectorAll('input[id], select[id], textarea[id]')]
    .filter(el => /^(tagger-|llm-)/.test(el.id) && !/^llm-channel-(keys|base|name|model|provider|timeout)$/.test(el.id));
  function capture() {
    if (!container.querySelector('#llm-tagger-path')) return;
    session.draft = Object.fromEntries(fields().map(el => [el.id,
      el.multiple ? [...el.selectedOptions].map(option => option.value)
        : el.type === 'checkbox' ? el.checked : el.value]));
  }
  function display() {
    for (const kind of ['tagger', 'llm']) {
      const output = container.querySelector(`[data-submitted-${kind}]`);
      if (!output) continue;
      const submitted = session.submissions[kind];
      output.textContent = submitted
        ? `任务 ${submitted.taskId}\n${JSON.stringify(submitted.params, null, 2)}`
        : '尚未提交任务。';
    }
  }
  for (const el of fields()) {
    if (!(el.id in session.draft)) continue;
    const value = session.draft[el.id];
    if (el.multiple) {
      for (const option of el.options) option.selected = Array.isArray(value) && value.includes(option.value);
    } else if (el.type === 'checkbox') el.checked = value === true;
    else {
      if (el.tagName === 'SELECT' && value && ![...el.options].some(option => option.value === value)) {
        el.add(new Option('原选项不可用，请重新选择', value));
      }
      el.value = value;
    }
  }
  container.addEventListener('input', capture);
  container.addEventListener('change', capture);
  display();
  return {
    capture,
    dispose() {
      container.removeEventListener('input', capture);
      container.removeEventListener('change', capture);
    },
    submitted(kind, taskId, params) {
      session.submissions[kind] = { taskId, params: structuredClone(params) };
      capture();
      display();
    },
  };
}
