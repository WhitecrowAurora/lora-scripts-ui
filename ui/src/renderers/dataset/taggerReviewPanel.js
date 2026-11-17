// Review candidates through the same interrogation request boundary.
export function createTaggerReviewPanel({ container, api, escapeHtml, showToast }) {
  const task = container.querySelector('[data-review-task]');
  const results = container.querySelector('[data-review-items]');
  const status = container.querySelector('[data-review-status]');
  const previous = container.querySelector('[data-review-previous]');
  const next = container.querySelector('[data-review-next]');
  const apply = container.querySelector('[data-review-apply]');
  let offset = 0;
  let generation = 0;
  let loadedTask = '';
  let busy = false;
  let total = 0;
  const failed = new Map();
  function setBusy(value) {
    busy = value;
    container.querySelectorAll('button,input').forEach(element => {
      element.disabled = value || (element.hasAttribute('data-review-select') && element.closest('[data-review-id]')?.dataset.reviewState === 'applied');
    });
    previous.disabled = value || offset === 0;
    next.disabled = value || offset + 50 >= total;
  }
  async function load() {
    if (busy || !task.value.trim()) return;
    const identity = task.value.trim();
    const current = ++generation;
    if (loadedTask !== identity) { offset = 0; failed.clear(); }
    setBusy(true);
    try {
      const response = await api.runInterrogate({ action: 'review_results', task_id: identity, offset, limit: 50 });
      if (current !== generation || identity !== task.value.trim()) return;
      const data = response?.data ?? response;
      loadedTask = identity;
      total = Number(data.total || 0);
      results.innerHTML = (data.items || []).map(item => {
        const error = failed.get(item.id);
        return `<article data-review-id="${escapeHtml(item.id)}" data-review-state="${item.state === 'applied' ? 'applied' : 'pending'}" style="margin:12px 0;padding:12px;border:1px solid var(--border);">
          <label><input type="checkbox" data-review-select ${item.state === 'applied' ? 'disabled' : ''}> ${escapeHtml(item.image_path)} · ${item.state === 'applied' ? '已应用' : '待审核'}</label>
          <div>原文<pre style="white-space:pre-wrap;">${escapeHtml(item.original || '')}</pre></div>
          <div>生成结果<pre style="white-space:pre-wrap;">${escapeHtml(item.caption || '')}</pre></div>
          ${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
        </article>`;
      }).join('');
      status.textContent = `共 ${total} 条，当前 ${total ? offset + 1 : 0}–${Math.min(offset + 50, total)} 条。`;
    } catch (error) {
      status.textContent = error.message || '读取审核结果失败，保留上次结果。';
    } finally {
      setBusy(false);
    }
  }
  container.querySelector('[data-review-load]').addEventListener('click', () => void load());
  previous.addEventListener('click', () => { offset = Math.max(0, offset - 50); void load(); });
  next.addEventListener('click', () => { offset += 50; void load(); });
  apply.addEventListener('click', async () => {
    if (busy || task.value.trim() !== loadedTask) { showToast('请先载入当前任务的审核结果。'); return; }
    const ids = Array.from(results.querySelectorAll('[data-review-select]:checked:not(:disabled)')).map(input => input.closest('[data-review-id]').dataset.reviewId);
    if (!ids.length) { showToast('请选择要应用的结果。'); return; }
    setBusy(true);
    try {
      const response = await api.runInterrogate({ action: 'apply_results', task_id: loadedTask, candidate_ids: ids });
      const data = response?.data ?? response;
      (data.results || []).forEach(result => { if (result.ok) failed.delete(result.id); else failed.set(result.id, result.error || '保存失败'); });
      showToast(`已应用 ${Number(data.success || 0)} 条，失败 ${Number(data.failed || 0)} 条。失败项保留待审核。`);
    } catch (error) { showToast(error.message || '应用失败，候选结果已保留。'); }
    finally { setBusy(false); }
    await load();
  });
  setBusy(false);
  return { setTask(identity, loadNow = false) {
    if (task.value !== identity) { results.innerHTML = ''; loadedTask = ''; total = 0; }
    task.value = identity;
    offset = 0;
    if (loadNow) void load();
  } };
}
