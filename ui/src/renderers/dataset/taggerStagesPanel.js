// Ordered optional stages; requests still use the existing interrogation task.
export function createTaggerStagesPanel({ container, channels, escapeHtml }) {
  const rows = container?.querySelector('[data-stage-rows]');
  function addStage(stage = {}) {
    if (!rows || rows.children.length >= 8) return;
    const row = document.createElement('fieldset');
    row.dataset.captionStage = '';
    row.style.cssText = 'display:grid;gap:8px;margin:12px 0;padding:12px;border:1px solid var(--border);';
    row.innerHTML = `
      <legend>生成阶段</legend>
      <label>渠道 <select data-stage-channel><option value="">使用主通道</option>${channels.filter(c => c.enabled && c.has_key).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('')}</select></label>
      <label>模型 <input class="text-input" data-stage-model placeholder="留空使用该渠道默认模型"></label>
      <label>输出 <select data-stage-output><option value="caption">自然语言描述</option><option value="tags">逗号分隔标签</option></select></label>
      <label>提示词 <textarea class="text-input" data-stage-prompt placeholder="留空使用模板；用 {caption} 引用上一阶段的描述"></textarea></label>
      <button class="btn btn-outline btn-sm" type="button" data-remove-stage>移除此阶段</button>`;
    row.querySelector('[data-remove-stage]').addEventListener('click', () => row.remove());
    rows.append(row);
    for (const [field, value] of Object.entries({ channel: stage.channel_id || '', model: stage.model || '', output: stage.output_mode || 'caption', prompt: stage.user_prompt || '' })) {
      const input = row.querySelector(`[data-stage-${field}]`);
      if (field === 'channel' && value && ![...input.options].some(option => option.value === value)) {
        input.add(new Option('原渠道（需重新绑定）', value));
      }
      input.value = value;
    }
  }
  container?.querySelector('[data-add-stage]')?.addEventListener('click', () => addStage());
  return {
    restore(stages) { for (const stage of stages.slice(0, 8)) addStage(stage); },
    read() {
      return Array.from(rows?.children || []).map((row, index) => {
        const output = row.querySelector('[data-stage-output]').value;
        const channel = row.querySelector('[data-stage-channel]').value;
        return {
          name: `stage_${index + 1}`,
          ...(channel ? { channel_id: channel } : {}),
          model: row.querySelector('[data-stage-model]').value.trim(),
          output_mode: output,
          template_preset: output === 'caption' ? 'natural-caption' : 'anime-tags',
          user_prompt: row.querySelector('[data-stage-prompt]').value.trim(),
        };
      });
    },
  };
}
