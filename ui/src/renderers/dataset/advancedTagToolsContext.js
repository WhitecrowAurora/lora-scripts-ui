// Shared DOM and response helpers for the advanced tag tools panel.

export function createAdvancedTagToolsContext({ $, escapeHtml }) {
  const esc = (value) => escapeHtml(String(value ?? ''));

  function pathPicker(id, placeholder = './train/your_dataset') {
    return `
      <div class="config-group" style="grid-column:1/-1;">
        <label>数据集路径</label>
        <div class="input-picker">
          <button class="picker-icon" type="button" onclick="pickPathForInput('${id}', 'folder')">
            <svg class="icon"><use href="#icon-folder"></use></svg>
          </button>
          <button class="picker-mode-icon-btn" type="button" title="内置文件选择器（train 目录）" onclick="openBuiltinPickerForInput('${id}', 'folder')"><svg class="icon"><use href="#icon-folder"></use></svg></button>
          <input class="text-input" type="text" id="${id}" placeholder="${placeholder}">
        </div>
      </div>`;
  }

  function boolCard(id, label, checked = true) {
    return `
      <div class="config-group row boolean-card">
        <div class="label-col"><label>${label}</label></div>
        <label class="switch switch-compact"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="slider round"></span></label>
      </div>`;
  }

  function setResult(id, html) {
    const el = $('#' + id);
    if (el) el.innerHTML = html;
  }

  function busy(id, text = '处理中...') {
    setResult(id, `<div class="builtin-picker-empty"><span>${esc(text)}</span></div>`);
  }

  function errorBox(id, error) {
    setResult(id, `<div class="builtin-picker-empty"><span>${esc(error?.message || '操作失败')}</span></div>`);
  }

  function unwrap(response) {
    const data = response?.data;
    if (data && data.status === 'error') throw new Error(data.message || '后端返回错误');
    return data || {};
  }

  function samplesList(samples) {
    const rows = Array.isArray(samples) ? samples : [];
    if (!rows.length) return '<div class="module-list-item module-list-item-static"><div class="module-list-main"><strong>没有需要改写的文件</strong></div></div>';
    return rows.map((s) => `
      <div class="module-list-item module-list-item-static">
        <div class="module-list-main">
          <strong>${esc(s.image_path || s.file || '-')}</strong>
          <span class="module-list-meta">前: ${esc(s.before || '')}</span>
          <span class="module-list-meta" style="color:var(--accent);">后: ${esc(s.after || '')}</span>
        </div>
      </div>`).join('');
  }


  return {
    esc,
    pathPicker,
    boolCard,
    setResult,
    busy,
    errorBox,
    unwrap,
    samplesList,
  };
}

