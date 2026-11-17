import { renderTaggerTemplate } from './taggerTemplate.js';
import { createTaggerStagesPanel } from './taggerStagesPanel.js';
import { createTaggerReviewPanel } from './taggerReviewPanel.js';
import { createTaggerTaskSnapshot } from './taggerTaskSnapshot.js';
import { bindPortableChannel } from './taggerPortablePreset.js';

export function createTaggerWorkflow({ state, api, $, _ico, escapeHtml, showToast }) {
  let taggerPollTimer = null;
  let stagesPanel = null;
  let reviewPanel = null;
  let taskSnapshot = null;
  let formEvents = null;

  function renderTagger() {
    const content = $('#dataset-content');
    if (!content) return;
    if (content.querySelector('#llm-tagger-path')) {
      taskSnapshot?.capture();
      state.taggerStagesDraft = stagesPanel?.read() || [];
    }
    taskSnapshot?.dispose();
    formEvents?.abort();
    formEvents = new AbortController();

    const allInterrogators = state.interrogators?.interrogators || [];
    const defaultModel = 'wd-eva02-large-v3';
    const wdModels = allInterrogators.filter((model) => model.kind === 'wd' || model.kind === 'cl');
    const llmModels = allInterrogators.filter((model) => model.kind === 'llm');
    const llmChannels = state.interrogators?.llm_channels || [];
    const fallbackModels = [
      'wd-eva02-large-v3',
      'wd-convnext-v3',
      'wd-swinv2-v3',
      'wd-vit-v3',
      'wd14-convnextv2-v2',
      'wd14-swinv2-v2',
      'wd14-vit-v2',
      'wd14-moat-v2',
      'wd-eva02-large-tagger-v3',
      'wd-vit-large-tagger-v3',
      'eva02_large_E621_FULL_V1',
      'cl_tagger_1_01',
    ];
    const models = wdModels.length > 0 ? wdModels.map((model) => model.name) : fallbackModels;
    const conflicts = ['ignore', 'copy', 'prepend', 'append'];
    const conflictLabels = { ignore: '跳过已有', copy: '覆盖', prepend: '前置追加', append: '后置追加' };
    const presets = state.interrogators?.llm_template_presets || [
      { id: 'anime-tags', label: '动漫标签 / Anime Tags' },
      { id: 'natural-caption', label: '自然语言描述 / Natural Caption' },
    ];

    content.innerHTML = renderTaggerTemplate({
      models,
      defaultModel,
      llmModels,
      llmChannels,
      presets,
      conflicts,
      conflictLabels,
      escapeHtml,
    });
    stagesPanel = createTaggerStagesPanel({ container: $('#llm-stages-panel'), channels: llmChannels, escapeHtml });
    reviewPanel = createTaggerReviewPanel({ container: $('#llm-review-panel'), api, escapeHtml, showToast });
    stagesPanel.restore(state.taggerStagesDraft || []);
    taskSnapshot = createTaggerTaskSnapshot({ container: content, state });
    const recentLlmTask = state.taggerSession?.submissions?.llm;
    if (recentLlmTask?.params?.llm_review_before_save) reviewPanel?.setTask(recentLlmTask.taskId);
    bindPortableChannel({ container: content, channels: llmChannels, $, showToast });
    for (const event of ['input', 'change', 'click']) {
      content.addEventListener(event, () => { state.taggerStagesDraft = stagesPanel.read(); }, { signal: formEvents.signal });
    }
    const preset = $('#llm-preset');
    preset?.addEventListener('change', () => {
      if (preset.value !== 'caption-rewrite') return;
      const scope = $('#llm-caption-scope');
      const conflict = $('#llm-conflict');
      if (scope) scope.value = 'existing';
      if (conflict?.value === 'ignore') conflict.value = 'copy';
    });
  }

  function setTaggerButtonLoading(btnId, hintId, loading) {
    const btn = $('#' + btnId);
    const hint = $('#' + hintId);
    if (btn) {
      btn.disabled = loading;
      if (loading) {
        btn.dataset.origText = btn.textContent;
        btn.innerHTML = _ico('loader') + ' 提交中...';
      } else {
        btn.textContent = btn.dataset.origText || '开始标注';
      }
    }
    if (hint && loading) {
      hint.innerHTML = '';
    }
  }

  function showTaggerRunningHint(hintId, message) {
    const hint = $('#' + hintId);
    if (hint) {
      hint.innerHTML = '<span style="color:var(--warning);">' + _ico('loader') + ' ' + message + '</span>';
    }
  }

  function showTaggerDoneHint(hintId, message) {
    const hint = $('#' + hintId);
    if (hint) {
      hint.innerHTML = '<span style="color:var(--success);">' + _ico('check-circle') + ' ' + message + '</span>';
      setTimeout(() => {
        if (hint) hint.innerHTML = '';
      }, 15000);
    }
  }

  function showTaggerErrorHint(hintId, message) {
    const hint = $('#' + hintId);
    if (hint) {
      hint.innerHTML = '<span style="color:var(--danger);">' + _ico('x-circle') + ' ' + escapeHtml(message) + '</span>';
    }
  }

  function formatTaggerHealthMessage(health) {
    const errors = Array.isArray(health?.errors) ? health.errors.filter(Boolean) : [];
    const warnings = Array.isArray(health?.warnings) ? health.warnings.filter(Boolean) : [];
    if (errors.length) return errors.join('；');
    if (warnings.length) return warnings.join('；');
    const count = Number(health?.image_count || 0);
    return count > 0 ? `预检通过，检测到 ${count} 张图片。` : '预检通过。';
  }

  function formatTaggerSummary(summary, fallbackCount) {
    if (!summary || typeof summary !== 'object') {
      return '标注完成' + (fallbackCount ? ` (${fallbackCount})` : '') + '！标签文件已生成。';
    }
    const total = Number(summary.total_images || 0);
    const written = Number(summary.written_count || 0);
    const skippedExisting = Number(summary.skipped_existing_count || 0);
    const skippedEmpty = Number(summary.skipped_empty_count || 0);
    const empty = Number(summary.empty_output_count || 0);
    const skippedMissing = Number(summary.skipped_missing_caption_count || 0);
    const failed = Number(summary.failed_count || 0);
    const wouldWrite = Number(summary.would_write_count || 0);
    const dryRun = summary.dry_run === true;
    const parts = [];
    if (total) parts.push(`共 ${total} 张`);
    parts.push(`写入 ${written} 张`);
    if (skippedExisting) parts.push(`跳过已有 ${skippedExisting} 张`);
    if (skippedEmpty) parts.push(`空输出跳过 ${skippedEmpty} 张`);
    if (skippedMissing) parts.push(`缺少 Caption 跳过 ${skippedMissing} 张`);
    if (failed) parts.push(`失败 ${failed} 张`);
    if (empty && !skippedEmpty) parts.push(`空输出 ${empty} 张`);
    if (dryRun) parts.push(`预计写入 ${wouldWrite} 张`);
    if (summary.review_count) parts.push(`待审核 ${Number(summary.review_count)} 张`);
    return (dryRun ? '预演完成：' : '标注完成：') + parts.join('，') + '。';
  }

  function getSelectedFallbackChannels() {
    const select = $('#llm-fallback-channels');
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map((option) => option.value).filter(Boolean);
  }

  function updateChannelState(channels) {
    state.interrogators = {
      ...(state.interrogators || {}),
      llm_channels: Array.isArray(channels) ? channels : [],
    };
  }

  async function refreshLlmTaggerChannels() {
    try {
      const response = await api.getLlmTaggerChannels();
      updateChannelState(response?.data?.channels || []);
      renderTagger();
      showToast('LLM 通道已刷新。');
    } catch (error) {
      showToast(error.message || '刷新 LLM 通道失败。');
    }
  }

  async function saveLlmTaggerChannelFromForm() {
    const name = $('#llm-channel-name')?.value?.trim() || '';
    const provider = $('#llm-channel-provider')?.value || 'openai_compatible';
    const model = $('#llm-channel-model')?.value?.trim() || '';
    const apiKeys = $('#llm-channel-keys')?.value || '';
    if ($('#llm-channel-keys')?.dataset.importedPreset === 'true' && !apiKeys.trim()) {
      showToast('导入的预设需要重新填写本机密钥后保存。');
      return;
    }
    const existing = (state.interrogators?.llm_channels || []).find((channel) => String(channel.id || '') === channelIdFromName(name));
    if (!name || !model) {
      showToast('请填写通道名称和模型。');
      return;
    }
    if (!existing && !apiKeys.trim()) {
      showToast('新通道请至少填写一个 API Key。');
      return;
    }
    try {
      const response = await api.saveLlmTaggerChannel({
        name,
        provider,
        model,
        api_base: $('#llm-channel-base')?.value?.trim() || '',
        api_keys: apiKeys,
        replace_api_keys: !!apiKeys.trim(),
        enabled: true,
        timeout: Number($('#llm-channel-timeout')?.value ?? 120),
        retries: Number($('#llm-retries')?.value ?? 1),
        interval: Number($('#llm-interval')?.value ?? 0),
        retry_interval: Number($('#llm-retry-interval')?.value ?? 0),
      });
      updateChannelState(response?.data?.channels || []);
      renderTagger();
      showToast(`已保存 LLM 通道：${name}`);
    } catch (error) {
      showToast(error.message || '保存 LLM 通道失败。');
    }
  }

  function channelIdFromName(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }

  async function clearSelectedLlmTaggerChannelKeys() {
    const channelId = $('#llm-channel')?.value || '';
    if (!channelId) {
      showToast('请先选择要清空密钥的通道。');
      return;
    }
    if (channelId.startsWith('env-')) {
      showToast('环境变量通道的密钥来自系统环境，不能在这里清空。');
      return;
    }
    try {
      const response = await api.clearLlmTaggerChannelKeys(channelId);
      updateChannelState(response?.data?.channels || []);
      renderTagger();
      showToast('已清空所选通道的 API Key。');
    } catch (error) {
      showToast(error.message || '清空 API Key 失败。');
    }
  }

  async function deleteSelectedLlmTaggerChannel() {
    const channelId = $('#llm-channel')?.value || '';
    if (!channelId) {
      showToast('请先选择要删除的通道。');
      return;
    }
    if (channelId.startsWith('env-')) {
      showToast('环境变量通道不能在这里删除。');
      return;
    }
    try {
      const response = await api.deleteLlmTaggerChannel(channelId);
      updateChannelState(response?.data?.channels || []);
      renderTagger();
      showToast('已删除所选 LLM 通道。');
    } catch (error) {
      showToast(error.message || '删除 LLM 通道失败。');
    }
  }

  function pollTaggerProgress(hintId, taskId = '') {
    if (taggerPollTimer) clearInterval(taggerPollTimer);
    let imageCount = '';
    const targetTaskId = String(taskId || '');
    taggerPollTimer = setInterval(async () => {
      try {
        const tasksResp = await api.getTasks();
        const tasks = tasksResp?.data?.tasks || [];
        const targetTask = targetTaskId
          ? tasks.find((task) => String(task.id || task.task_id || '') === targetTaskId)
          : null;
        if (targetTaskId && !targetTask) return;
        const running = targetTask
          ? (['RUNNING', 'PENDING', 'QUEUED', 'STARTING'].includes(String(targetTask.status || '').toUpperCase()) ? [targetTask] : [])
          : tasks.filter((task) => task.status === 'RUNNING');
        if (running.length === 0) {
          clearInterval(taggerPollTimer);
          taggerPollTimer = null;
          const finished = targetTask || tasks.find((task) => ['COMPLETED', 'FINISHED'].includes(String(task.status || '').toUpperCase()) && String(task.type || '').toLowerCase() === 'tagging');
          if (finished?.metadata?.summary?.review_available) reviewPanel?.setTask(targetTaskId, true);
          if (['FAILED', 'ERROR', 'CANCELLED', 'CANCELED'].includes(String(finished?.status || '').toUpperCase())) {
            showTaggerErrorHint(hintId, finished.error || '标注任务未完成；已生成的审核结果可继续查看。');
            return;
          }
          const doneMsg = formatTaggerSummary(finished?.metadata?.summary, imageCount);
          showTaggerDoneHint(hintId, doneMsg);
          showToast('✓ ' + doneMsg);
          return;
        }
        const taskId = running[0].id || running[0].task_id;
        if (!taskId) return;
        const summary = running[0].metadata?.summary;
        if (summary) {
          showTaggerRunningHint(hintId, `已处理 ${Number(summary.processed_count || 0)}/${Number(summary.total_images || 0)} 张，已写入 ${Number(summary.written_count || 0)} 张，失败 ${Number(summary.failed_count || 0)} 张。`);
          return;
        }

        const outResp = await api.getTaskOutput(taskId, 30);
        const lines = outResp?.data?.lines || [];
        for (let index = lines.length - 1; index >= 0; index -= 1) {
          const line = lines[index];
          const imgMatch = line.match(/[Ff]ound\s+(\d+)\s+image/i);
          if (imgMatch) {
            imageCount = imgMatch[1] + ' 张图片';
            const hint = document.getElementById(hintId);
            if (hint) {
              hint.innerHTML = '<span style="color:var(--warning);">' + _ico('loader') + ' 标注中... 检测到 ' + imageCount + '</span>';
            }
            break;
          }
          if (/all\s*done|识别完成|Unloaded/i.test(line)) {
            clearInterval(taggerPollTimer);
            taggerPollTimer = null;
            const doneMsg = '标注完成' + (imageCount ? ` (${imageCount})` : '') + '！标签文件已生成。';
            showTaggerDoneHint(hintId, doneMsg);
            showToast('✓ ' + doneMsg);
            return;
          }
        }
      } catch (error) {
        // Progress polling is best-effort; the backend task continues independently.
      }
    }, 3000);
  }

  async function runLlmTagger() {
    const pathVal = $('#llm-tagger-path')?.value?.trim();
    if (!pathVal) {
      showToast('请先填写数据集路径。');
      return;
    }
    const channelId = $('#llm-channel')?.value || '';
    if (!channelId) {
      showToast('请先选择可用的 LLM 通道，或先保存一个通道。');
      return;
    }
    const params = {
      path: pathVal,
      method: 'llm',
      llm_channel_id: channelId,
      llm_fallback_channel_ids: getSelectedFallbackChannels().filter((id) => id !== channelId),
      llm_fallback_enabled: $('#llm-fallback-enabled')?.checked ?? true,
      llm_model: $('#llm-model')?.value?.trim() || '',
      llm_template_preset: $('#llm-preset')?.value || 'anime-tags',
      batch_output_action_on_conflict: $('#llm-conflict')?.value || 'ignore',
      llm_caption_scope: $('#llm-caption-scope')?.value || 'auto',
      llm_batch_concurrency: Math.max(1, Math.min(8, parseInt($('#llm-batch-concurrency')?.value, 10) || 1)),
      dry_run: $('#llm-dry-run')?.checked || false,
      llm_temperature: parseFloat($('#llm-temperature')?.value) || 0.2,
      llm_max_tokens: parseInt($('#llm-max-tokens')?.value, 10) || 300,
      llm_retries: Number($('#llm-retries')?.value ?? 1),
      llm_interval: Number($('#llm-interval')?.value ?? 0),
      llm_retry_interval: Number($('#llm-retry-interval')?.value ?? 0),
      llm_stages: stagesPanel?.read() || [],
      llm_review_before_save: $('#llm-review-before-save')?.checked || false,
      llm_min_tags: parseInt($('#llm-min-tags')?.value, 10) || 1,
      llm_max_tags: parseInt($('#llm-max-tags')?.value, 10) || 120,
      batch_input_recursive: $('#llm-recursive')?.checked || false,
      threshold: 0.5,
    };
    setTaggerButtonLoading('btn-run-llm-tagger', 'llm-tagger-status-hint', true);
    try {
      const healthResp = await api.checkInterrogateHealth(params);
      const health = healthResp?.data || {};
      const healthMessage = formatTaggerHealthMessage(health);
      if (!health.ok) {
        throw new Error(healthMessage || 'LLM 标注预检未通过。');
      }
      if (Array.isArray(health.warnings) && health.warnings.length) {
        showToast(healthMessage);
      }
      const response = await api.runInterrogate(params);
      const taskId = response?.data?.task_id || response?.task_id || '';
      taskSnapshot?.submitted('llm', taskId, params);
      if (params.llm_review_before_save) reviewPanel?.setTask(taskId);
      setTaggerButtonLoading('btn-run-llm-tagger', 'llm-tagger-status-hint', false);
      showTaggerRunningHint(
        'llm-tagger-status-hint',
        'LLM 标注后台运行中... 进度请查看后端控制台窗口（任务栏最小化窗口 "LoRA-Backend"）',
      );
      showToast(params.llm_review_before_save ? 'LLM 标注已提交；生成后可在「审核生成结果」中应用。' : '✓ LLM 标注任务已提交到后端，正在后台运行。完成后 .txt 标签文件会自动生成在图片旁边。');
      pollTaggerProgress('llm-tagger-status-hint', taskId);
    } catch (error) {
      setTaggerButtonLoading('btn-run-llm-tagger', 'llm-tagger-status-hint', false);
      showTaggerErrorHint('llm-tagger-status-hint', error.message || '提交失败');
      showToast(error.message || 'LLM 标注任务启动失败。');
    }
  }

  async function runTagger() {
    const pathVal = $('#tagger-path')?.value?.trim();
    if (!pathVal) {
      showToast('请先填写数据集路径。');
      return;
    }
    const params = {
      path: pathVal,
      interrogator_model: $('#tagger-model')?.value || 'wd-eva02-large-v3',
      threshold: parseFloat($('#tagger-threshold')?.value) || 0.5,
      additional_tags: $('#tagger-additional')?.value || '',
      exclude_tags: $('#tagger-exclude')?.value || '',
      batch_input_recursive: $('#tagger-recursive')?.checked || false,
      batch_output_action_on_conflict: $('#tagger-conflict')?.value || 'ignore',
      replace_underscore: $('#tagger-underscore')?.checked ?? true,
      escape_tag: $('#tagger-escape')?.checked ?? true,
      protect_empty_output: $('#tagger-empty-protect')?.checked ?? true,
    };
    setTaggerButtonLoading('btn-run-tagger', 'tagger-status-hint', true);
    try {
      const healthResp = await api.checkInterrogateHealth({ ...params, method: 'wd14' });
      const health = healthResp?.data || {};
      const healthMessage = formatTaggerHealthMessage(health);
      if (!health.ok) {
        throw new Error(healthMessage || '标注预检未通过。');
      }
      if (Array.isArray(health.warnings) && health.warnings.length) {
        showToast(healthMessage);
      }
      const response = await api.runInterrogate(params);
      const taskId = response?.data?.task_id || response?.task_id || '';
      taskSnapshot?.submitted('tagger', taskId, params);
      setTaggerButtonLoading('btn-run-tagger', 'tagger-status-hint', false);
      showTaggerRunningHint(
        'tagger-status-hint',
        '标注后台运行中（首次需下载模型，可能需要几分钟）... 进度请查看后端控制台窗口',
      );
      showToast('✓ 标注任务已提交到后端，正在后台运行。完成后 .txt 标签文件会自动生成在图片旁边。');
      pollTaggerProgress('tagger-status-hint', taskId);
    } catch (error) {
      setTaggerButtonLoading('btn-run-tagger', 'tagger-status-hint', false);
      showTaggerErrorHint('tagger-status-hint', error.message || '提交失败');
      showToast(error.message || '标注任务启动失败。');
    }
  }

  return {
    renderTagger,
    runTagger,
    runLlmTagger,
    refreshLlmTaggerChannels,
    saveLlmTaggerChannelFromForm,
    clearSelectedLlmTaggerChannelKeys,
    deleteSelectedLlmTaggerChannel,
  };
}
