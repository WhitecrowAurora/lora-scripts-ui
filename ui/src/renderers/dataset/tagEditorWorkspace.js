import { captionWithTags, createTagEditorSession, unwrapEditorResponse } from './tagEditorSession.js';

export function createTagEditorWorkspace({ container, api, state, escapeHtml, showToast, onMask }) {
  const sessions = state.tagEditorSessions ||= new Map();
  let session = null;
  let scope = null;
  let offset = 0;
  let total = 0;
  let loadVersion = 0;
  let saving = false;
  const $ = selector => container.querySelector(selector);
  const esc = value => escapeHtml(String(value ?? ''));
  const previousScope = state.tagEditorLastScope || {};
  container.innerHTML = `
    <label>数据集目录 <input class="text-input" data-editor-dir placeholder="./train/your_dataset"></label>
    <label>Caption 扩展名 <input class="text-input" data-editor-ext value="${esc(state.config?.caption_extension || '.txt')}"></label>
    <label>文件名筛选 <input class="text-input" data-editor-filename></label>
    <label>Caption 筛选 <input class="text-input" data-editor-query></label>
    <button class="btn btn-outline btn-sm" data-editor-load>载入 / 筛选</button>
    <p class="field-desc">筛选改变后清除原选择；翻页保留选择。保存仅作用于当前筛选范围内已选择且有修改的文件。隐藏草稿仍保留。</p>
    <button class="btn btn-outline btn-sm" data-editor-select>选择本页</button>
    <button class="btn btn-outline btn-sm" data-editor-clear>清空选择</button>
    <button class="btn btn-primary btn-sm" data-editor-save>保存选中修改</button>
    <span data-editor-status role="status"></span>
    <div data-editor-stats></div><div data-editor-items></div>
    <button class="btn btn-outline btn-sm" data-editor-prev>上一页</button>
    <button class="btn btn-outline btn-sm" data-editor-next>下一页</button>`;
  for (const [field, key] of [['dir', 'dir'], ['ext', 'caption_extension'], ['filename', 'filename_query'], ['query', 'caption_query']]) {
    if (previousScope[key] !== undefined) $(`[data-editor-${field}]`).value = previousScope[key];
  }
  const status = text => { $('[data-editor-status]').textContent = text; };
  const request = async (path, params) => unwrapEditorResponse(await api.runCoreTool(path, params));
  function count() {
    const amount = session ? [...session.selected].filter(path => session.drafts.has(path)).length : 0;
    $('[data-editor-save]').disabled = saving || !amount;
    $('[data-editor-save]').textContent = saving ? '保存中…' : `保存选中修改（${amount}）`;
    $('[data-editor-prev]').disabled = saving || !scope || offset === 0;
    $('[data-editor-next]').disabled = saving || !scope || offset + 50 >= total;
    $('[data-editor-load]').disabled = saving;
  }
  function render() {
    $('[data-editor-items]').innerHTML = (session?.items || []).map((item, index) => {
      const draft = session.drafts.get(item.image_path);
      const components = item.caption_components;
      const disabled = item.caption_read_error ? 'disabled' : '';
      return `<article class="form-section" data-editor-row="${index}">
        <label><input type="checkbox" data-editor-check ${disabled} ${session.selected.has(item.image_path) ? 'checked' : ''}> ${esc(item.relative_path)}</label>
        <span data-editor-dirty>${draft ? '未保存' : '已载入'}</span>
        ${components ? `<label>标签（保留触发词和自然语言）<textarea class="text-input" data-editor-tags ${draft?.tags === null ? 'disabled' : ''}>${esc(draft?.tags ?? components.tags.join(', '))}</textarea></label>` : ''}
        <label>完整 Caption <textarea class="text-input" data-editor-caption ${disabled} style="width:100%;min-height:70px;">${esc(draft?.caption ?? item.caption)}</textarea></label>
        <span role="status" data-editor-error>${esc(item.caption_read_error || draft?.error || '')}</span>
        ${draft ? '<button class="btn btn-outline btn-sm" data-editor-discard>放弃此草稿并重新载入</button>' : ''}
        <button class="btn btn-outline btn-sm" data-editor-mask>编辑遮罩</button>
      </article>`;
    }).join('');
    count();
  }
  async function load(reset = false) {
    if (saving) return;
    const params = { dir: $('[data-editor-dir]').value.trim(), caption_extension: $('[data-editor-ext]').value.trim() || '.txt',
      filename_query: $('[data-editor-filename]').value.trim(), caption_query: $('[data-editor-query]').value.trim(),
      recursive: true, limit: 50, offset: reset ? 0 : offset, prefer_json_caption: false };
    if (!params.dir) { showToast('请填写数据集目录。'); return; }
    const key = JSON.stringify([params.dir, params.caption_extension]);
    const nextSession = sessions.get(key) || createTagEditorSession();
    const changed = !scope || ['dir', 'caption_extension', 'filename_query', 'caption_query'].some(field => scope[field] !== params[field]);
    params.selected_paths = changed ? [] : [...nextSession.selected];
    const version = ++loadVersion;
    status('载入中…');
    try {
      const page = await request('/api/tageditor/dataset', params);
      if (version !== loadVersion || !container.isConnected) return;
      if (changed) nextSession.selected.clear();
      session = nextSession;
      sessions.set(key, session);
      session.load(page);
      scope = params;
      state.tagEditorLastScope = { dir: params.dir, caption_extension: params.caption_extension,
        filename_query: params.filename_query, caption_query: params.caption_query };
      offset = params.offset;
      total = page.filtered_total;
      $('[data-editor-stats]').textContent = `筛选 ${total} 张；已保存内容的标签统计：` + (page.top_tags || []).map(row => `${row.tag} (${row.count})`).join('，');
      render();
      status(`第 ${Math.floor(offset / 50) + 1} 页；保留草稿 ${session.drafts.size} 份。`);
    } catch (error) { if (version === loadVersion) status(error.message); }
  }
  container.addEventListener('input', event => {
    const row = event.target.closest('[data-editor-row]');
    if (!row || !session) return;
    const item = session.items[Number(row.dataset.editorRow)];
    const tags = row.querySelector('[data-editor-tags]');
    const caption = row.querySelector('[data-editor-caption]');
    if (event.target.matches('[data-editor-tags]')) caption.value = captionWithTags(item.caption_components, tags.value);
    else if (event.target !== caption) return;
    // Editing the full caption deliberately takes precedence over the tag-only view.
    if (event.target === caption && tags) { tags.disabled = true; }
    session.edit(item, caption.value, event.target === caption ? null : tags?.value ?? null);
    row.querySelector('[data-editor-dirty]').textContent = '未保存';
    row.querySelector('[data-editor-error]').textContent = '';
    count();
  });
  container.addEventListener('change', event => {
    const row = event.target.closest('[data-editor-row]');
    if (!row || !event.target.matches('[data-editor-check]')) return;
    const path = session.items[Number(row.dataset.editorRow)].image_path;
    if (event.target.checked) session.selected.add(path); else session.selected.delete(path);
    count();
  });
  container.addEventListener('click', event => {
    const row = event.target.closest('[data-editor-row]');
    if (row && event.target.matches('[data-editor-mask]')) onMask(session.items[Number(row.dataset.editorRow)].image_path);
    if (row && !saving && event.target.matches('[data-editor-discard]')) {
      session.drafts.delete(session.items[Number(row.dataset.editorRow)].image_path);
      load();
    }
  });
  $('[data-editor-load]').onclick = () => load(true);
  $('[data-editor-prev]').onclick = () => { offset = Math.max(0, offset - 50); load(); };
  $('[data-editor-next]').onclick = () => { offset += 50; load(); };
  $('[data-editor-select]').onclick = () => { session?.items.filter(item => !item.caption_read_error).forEach(item => session.selected.add(item.image_path)); render(); };
  $('[data-editor-clear]').onclick = () => { session?.selected.clear(); render(); };
  $('[data-editor-save]').onclick = async () => {
    if (saving || !session) return;
    const submitted = [...session.selected].filter(path => session.drafts.has(path)).map(path => ({ ...session.drafts.get(path) }));
    if (!submitted.length) return;
    saving = true;
    ++loadVersion;
    count();
    status(`正在保存 ${submitted.length} 个文件…`);
    try {
      const result = await request('/api/tageditor/save_batch', { dir: scope.dir, caption_extension: scope.caption_extension,
        updates: submitted.map(({ tags, error, ...update }) => update), create_backup: true });
      session.applyResults(submitted, result.results);
      status(`已保存 ${result.success}，失败 ${result.failed}；未确认成功的草稿继续保留。`);
    } catch (error) { status(error.message); }
    finally { saving = false; render(); }
  };
  count();
  if (previousScope.dir) load(true);
}
