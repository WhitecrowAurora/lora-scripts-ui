export const unwrapEditorResponse = response => {
  if (response?.status === 'error' || response?.success === false) throw new Error(response.message || response.error || '操作失败');
  return response?.data ?? response;
};

export function captionWithTags(components, tags) {
  const values = [...(components?.triggers || []), ...tags.split(',').map(tag => tag.trim()).filter(Boolean), ...(components?.nl || [])];
  return [...new Set(values)].join(', ');
}

export function createTagEditorSession() {
  const drafts = new Map();
  const selected = new Set();
  let items = [];
  return {
    drafts, selected,
    get items() { return items; },
    load(page) {
      items = page.items || [];
      // This set covers every filtered page, not just the current page.
      const matched = new Set(page.matched_selected_paths || []);
      for (const path of selected) if (!matched.has(path)) selected.delete(path);
    },
    edit(item, caption, tags = null) {
      const previous = drafts.get(item.image_path);
      drafts.set(item.image_path, { ...previous, image_path: item.image_path, caption, tags,
        expected_revision: previous?.expected_revision ?? item.caption_revision, error: '' });
    },
    applyResults(submitted, results) {
      const byIndex = new Map((results || []).map(result => [result.index, result]));
      submitted.forEach((update, index) => {
        const result = byIndex.get(index);
        const draft = drafts.get(update.image_path);
        if (!draft) return;
        if (result?.success === true) {
          const item = items.find(row => row.image_path === update.image_path);
          if (item) Object.assign(item, { caption: update.caption, caption_revision: result.caption_revision, caption_components: null });
          if (draft.caption === update.caption) drafts.delete(update.image_path);
          else { draft.expected_revision = result.caption_revision; draft.error = ''; }
        } else {
          draft.error = result?.error || '未确认此文件保存成功，请检查后重试。';
        }
      });
    },
  };
}
