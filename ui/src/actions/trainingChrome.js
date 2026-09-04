export function createTrainingChromeActions({
  state,
  getFieldDefinition,
  loadTrainingWikiEntry,
  buildSchemaFallbackEntry,
  escapeHtml,
  renderNavigator,
  renderView,
  queryAll,
}) {
  let waterfallScrollHandler = null;

  function persistTrainingGroupsCollapsed() {
    try {
      const arr = Array.from(state._collapsedTrainingGroups || []);
      localStorage.setItem('sd-rescripts:training-groups-collapsed', JSON.stringify(arr));
    } catch (_e) {
      // Ignore blocked storage; UI state can be restored from defaults.
    }
  }

  function toggleTrainingGroup(group) {
    if (!state._collapsedTrainingGroups) state._collapsedTrainingGroups = new Set();
    if (state._collapsedTrainingGroups.has(group)) {
      state._collapsedTrainingGroups.delete(group);
    } else {
      state._collapsedTrainingGroups.add(group);
    }
    persistTrainingGroupsCollapsed();
    renderNavigator();
  }

  function toggleTrainingAdvisor() {
    state.trainingAdvisorCollapsed = !state.trainingAdvisorCollapsed;
    localStorage.setItem('sd-rescripts:training-advisor-collapsed', state.trainingAdvisorCollapsed ? 'true' : 'false');
    renderView(state.activeModule || 'config');
  }

  async function openTrainingOptionHelp(fieldKey) {
    const field = getFieldDefinition(fieldKey, state.activeTrainingType);
    renderTrainingOptionHelpModal({ loading: true, field, fieldKey });
    try {
      const wikiEntry = await loadTrainingWikiEntry(fieldKey);
      renderTrainingOptionHelpModal({ entry: wikiEntry || buildSchemaFallbackEntry(field), field, fieldKey });
    } catch (_error) {
      renderTrainingOptionHelpModal({ entry: buildSchemaFallbackEntry(field), field, fieldKey });
    }
  }

  function closeTrainingOptionHelp() {
    const modal = document.querySelector('.training-option-help-modal');
    if (modal) modal.remove();
  }

  function renderTrainingOptionHelpModal({ entry = null, loading = false, field = null, fieldKey = '' }) {
    closeTrainingOptionHelp();
    const safeEntry = entry || buildSchemaFallbackEntry(field) || {
      key: fieldKey,
      title: fieldKey || '参数说明',
      category: '训练参数',
      standard: {
        summary: '正在加载参数说明...',
        effect: '',
        whenToUse: '',
        avoidWhen: '',
      },
      relatedConfigs: [],
    };
    const standard = safeEntry.standard || {};
    const related = Array.isArray(safeEntry.relatedConfigs) ? safeEntry.relatedConfigs : [];
    const optionsHtml = loading ? '' : renderSelectOptionsHelp(field, safeEntry);
    const body = document.createElement('div');
    body.className = 'training-option-help-modal open';
    body.innerHTML = `
      <div class="training-option-help-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(safeEntry.title || '参数说明')}">
        <div class="training-option-help-head">
          <div>
            <span class="training-option-help-category">${escapeHtml(safeEntry.category || '训练参数')}</span>
            <h3>${escapeHtml(safeEntry.title || field?.label || fieldKey || '参数说明')}</h3>
          </div>
          <button class="modal-close" type="button" title="关闭" onclick="closeTrainingOptionHelp()">×</button>
        </div>
        <div class="training-option-help-body">
          ${loading ? '<p class="field-desc">正在加载参数说明...</p>' : ''}
          ${renderHelpRow('简单说', typeof standard.summary === 'string' ? standard.summary : '')}
          ${renderHelpRow('打开后效果', typeof standard.effect === 'string' ? standard.effect : '')}
          ${renderHelpRow('适合什么时候开', typeof standard.whenToUse === 'string' ? standard.whenToUse : '')}
          ${renderHelpRow('什么时候先别开', typeof standard.avoidWhen === 'string' ? standard.avoidWhen : '')}
          ${optionsHtml}
          ${safeEntry.fallback ? '<p class="training-option-help-note">完整 Wiki 条目还在补充中，当前内容来自训练 schema。</p>' : ''}
          ${related.length ? `<div class="training-option-help-related">${related.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `;
    body.addEventListener('click', (event) => {
      if (event.target === body) closeTrainingOptionHelp();
    });
    document.body.appendChild(body);
  }

  function renderHelpRow(title, text) {
    if (!text) return '';
    return `
      <div class="training-option-help-row">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  }

  function asStringMap(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v == null) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[String(k)] = String(v);
    }
    return out;
  }

  function normalizeHelpOption(opt) {
    if (opt == null) return null;
    if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
      const value = String(opt);
      return { value, label: value };
    }
    if (typeof opt === 'object') {
      const value = opt.value == null ? '' : String(opt.value);
      if (!value && !opt.label) return null;
      return { value, label: String(opt.label || value) };
    }
    return null;
  }

  function optionKeyAliases(value) {
    const raw = String(value || '');
    const lower = raw.toLowerCase();
    const snake = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
    const compact = snake.replace(/_/g, '');
    const digitSplit = snake.replace(/([a-z])(\d)/g, '$1_$2');
    return [...new Set([raw, lower, snake, compact, digitSplit, digitSplit.replace(/_/g, '')].filter(Boolean))];
  }

  // 返回该选项认领的**全部** wiki 键（不是说明文本）。
  //
  // 必须是全部而不是首个：optionDescriptions 讲「它是什么」、recommendedValues 讲
  // 「为什么选它」，两张表被压平成一个对象，同一个选项在两边的键名常常写法不同
  // （AdamW8bit vs adamw_8bit）。只认领首个命中的话，另一个键就会漏成孤儿，
  // 被当成一行「补充说明」，标签直接显示 adamw_8bit 这种原始键名。
  function lookupOptionDescriptionKeys(wikiDesc, value, label) {
    const hits = [];
    const direct = new Set([...optionKeyAliases(value), ...optionKeyAliases(label)]);
    const compact = new Set(
      [...direct].map((s) => String(s).toLowerCase().replace(/_/g, '')).filter(Boolean)
    );
    for (const k of Object.keys(wikiDesc)) {
      if (direct.has(k) || compact.has(String(k).toLowerCase().replace(/_/g, ''))) hits.push(k);
    }
    return hits;
  }

  // 词条要讲全部可选值，包含当前配置下被禁用的那些，所以按空配置解析函数式 options。
  // 空配置下每个 gater 都返回未加工的全量表（`module_offload_enabled` 缺省为假、
  // 梯度检查点缺省按开），正是这里要的东西。
  function resolveHelpOptions(field) {
    const raw = typeof field?.options === 'function' ? field.options({}) : field?.options;
    return Array.isArray(raw) ? raw : [];
  }

  function renderSelectOptionsHelp(field, entry) {
    const schemaOpts = resolveHelpOptions(field);
    const wikiDesc = {
      ...asStringMap(entry?.optionDescriptions),
      ...asStringMap(entry?.standard?.optionDescriptions),
      ...asStringMap(entry?.standard?.recommendedValues),
    };
    const rows = [];
    const seen = new Set();
    // 被选项用掉的 wiki 键（含别名命中，如 adamw_8bit → AdamW8bit）。
    const consumed = new Set();
    for (const opt of schemaOpts) {
      const n = normalizeHelpOption(opt);
      if (!n) continue;
      const key = n.value || n.label;
      if (seen.has(key)) continue;
      seen.add(key);
      const hits = lookupOptionDescriptionKeys(wikiDesc, n.value, n.label);
      for (const h of hits) consumed.add(h);
      // 同一选项在两张表里都有话说时全部展示，去重后按原顺序拼接。
      const texts = [...new Set(hits.map((h) => wikiDesc[h]).filter(Boolean))];
      rows.push({ ...n, description: texts.join('　·　') });
    }
    // 贴不上任何选项的 wiki 键归到「补充说明」，不再冒充可选值。
    // recommendedValues 装的是场景建议（block + swap_ratio=0.3-0.5），
    // optionDescriptions 里也有名词解释（thunder 的 nvfuser/sdpa 是逗号组合串的分量），
    // 以前它们被无条件塞进可选值列表，和真幽灵值长得一样。
    const notes = [];
    for (const [k, desc] of Object.entries(wikiDesc)) {
      if (seen.has(k) || consumed.has(k)) continue;
      notes.push({ value: '', label: k, description: desc });
    }
    if (!rows.length && !notes.length) return '';
    const items = rows
      .map((row) => {
        const valueHtml =
          row.value && row.value !== row.label
            ? `<code class="training-option-help-opt-value">${escapeHtml(row.value)}</code>`
            : '';
        const descHtml = row.description
          ? `<p class="training-option-help-opt-desc">${escapeHtml(row.description)}</p>`
          : '';
        return `<li class="training-option-help-opt">
          <div class="training-option-help-opt-head">
            <span class="training-option-help-opt-label">${escapeHtml(row.label)}</span>
            ${valueHtml}
          </div>
          ${descHtml}
        </li>`;
      })
      .join('');
    const noteItems = notes
      .map(
        (row) => `<li class="training-option-help-opt">
          <div class="training-option-help-opt-head">
            <span class="training-option-help-opt-label">${escapeHtml(row.label)}</span>
          </div>
          ${row.description ? `<p class="training-option-help-opt-desc">${escapeHtml(row.description)}</p>` : ''}
        </li>`
      )
      .join('');
    const optionsBlock = items
      ? `
      <div class="training-option-help-row training-option-help-options-block">
        <strong>可选值</strong>
        <ul class="training-option-help-options">${items}</ul>
      </div>`
      : '';
    const notesBlock = noteItems
      ? `
      <div class="training-option-help-row training-option-help-options-block">
        <strong>补充说明</strong>
        <ul class="training-option-help-options">${noteItems}</ul>
      </div>`
      : '';
    return `${optionsBlock}${notesBlock}`;
  }

  function startTrainingAdvisorDrag(event) {
    if (event.button !== 0 || event.target?.closest?.('button')) return;
    const panel = event.currentTarget?.closest?.('.floating-training-advisor');
    if (!panel) return;
    event.preventDefault();

    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const margin = 12;

    panel.classList.add('is-dragging');
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;

    const clampPosition = (clientX, clientY) => {
      const maxX = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
      return {
        x: Math.min(Math.max(margin, clientX - offsetX), maxX),
        y: Math.min(Math.max(margin, clientY - offsetY), maxY),
      };
    };

    const move = (moveEvent) => {
      const pos = clampPosition(moveEvent.clientX, moveEvent.clientY);
      panel.style.left = `${pos.x}px`;
      panel.style.top = `${pos.y}px`;
    };

    const stop = (upEvent) => {
      const pos = clampPosition(upEvent.clientX, upEvent.clientY);
      state.trainingAdvisorPosition = pos;
      localStorage.setItem('sd-rescripts:training-advisor-position', JSON.stringify(pos));
      panel.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function setupWaterfallScrollSpy(container) {
    if (waterfallScrollHandler) {
      document.removeEventListener('scroll', waterfallScrollHandler, true);
      waterfallScrollHandler = null;
    }
    const anchors = container.querySelectorAll('.waterfall-tab-anchor');
    if (!anchors.length) return;
    waterfallScrollHandler = () => {
      if (state.activeModule !== 'config' || !state.configWaterfall) return;
      let curTab = '';
      const triggerY = 140;
      anchors.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= triggerY) curTab = el.dataset.waterfallTab;
      });
      if (curTab && curTab !== state.activeTab) {
        state.activeTab = curTab;
        localStorage.setItem('sdxl_ui_tab', curTab);
        queryAll('.top-nav-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.tab === curTab);
        });
      }
    };
    document.addEventListener('scroll', waterfallScrollHandler, true);
  }

  return {
    persistTrainingGroupsCollapsed,
    toggleTrainingGroup,
    toggleTrainingAdvisor,
    openTrainingOptionHelp,
    closeTrainingOptionHelp,
    startTrainingAdvisorDrag,
    setupWaterfallScrollSpy,
  };
}
