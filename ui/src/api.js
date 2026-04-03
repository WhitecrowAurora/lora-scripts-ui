const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? JSON_HEADERS : undefined,
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`接口返回的 JSON 无效：${path}`);
  }

  if (!response.ok) {
    throw new Error(payload?.message || `请求失败：${response.status}`);
  }

  return payload;
}

function postJson(path, data) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export const api = {
  getGraphicCards() {
    return request('/api/graphic_cards');
  },

  getPresets() {
    return request('/api/presets');
  },

  getSavedParams() {
    return request('/api/config/saved_params');
  },

  getTasks() {
    return request('/api/tasks');
  },

  terminateTask(taskId) {
    return request(`/api/tasks/terminate/${taskId}`);
  },

  pickFile(type) {
    return request(`/api/pick_file?picker_type=${encodeURIComponent(type)}`);
  },

  getBuiltinPicker(type) {
    return request(`/api/builtin_picker?picker_type=${encodeURIComponent(type)}`);
  },

  saveConfig(name, config) {
    return postJson('/api/saved_configs/save', { name, config });
  },

  listSavedConfigs() {
    return request('/api/saved_configs/list');
  },

  loadSavedConfig(name) {
    return request(`/api/saved_configs/load?name=${encodeURIComponent(name)}`);
  },

  deleteSavedConfig(name) {
    return request(`/api/saved_configs/delete?name=${encodeURIComponent(name)}`);
  },

  runScript(params) {
    return postJson('/api/run_script', params);
  },

  runPreflight(config) {
    return postJson('/api/train/preflight', config);
  },

  previewSamplePrompt(config) {
    return postJson('/api/train/sample_prompt', config);
  },

  getLogDirs() {
    return request('/api/log_dirs');
  },

  getLogDetail(dir) {
    return request(`/api/log_detail?dir=${encodeURIComponent(dir)}`);
  },

  runInterrogate(params) {
    return postJson('/api/interrogate', params);
  },

  getDatasetTags(dir) {
    return request(`/api/dataset_tags?dir=${encodeURIComponent(dir)}`);
  },

  saveDatasetTag(params) {
    return postJson('/api/dataset_tags/save', params);
  },

  runImageResize(params) {
    return postJson('/api/image_resize', params);
  },

  runTraining(config) {
    return postJson('/api/run', config);
  },

  // === 新增接口 ===

  /** 获取标签编辑器启动状态 */
  getTagEditorStatus() {
    return request('/api/tageditor_status');
  },

  /** 获取可用标注模型列表（WD14 / CL / LLM） */
  getInterrogators() {
    return request('/api/interrogators');
  },

  /** 数据集分析 */
  analyzeDataset(params) {
    return postJson('/api/dataset/analyze', params);
  },

  /** Masked-loss 数据集审查 */
  maskedLossAudit(params) {
    return postJson('/api/dataset/masked_loss_audit', params);
  },

  /** Caption 清洗 - 预览 */
  captionCleanupPreview(params) {
    return postJson('/api/captions/cleanup/preview', params);
  },

  /** Caption 清洗 - 应用 */
  captionCleanupApply(params) {
    return postJson('/api/captions/cleanup/apply', params);
  },

  /** Caption 备份 - 创建 */
  captionBackupCreate(params) {
    return postJson('/api/captions/backups/create', params);
  },

  /** Caption 备份 - 列表 */
  captionBackupList(params) {
    return postJson('/api/captions/backups/list', params);
  },

  /** Caption 备份 - 恢复 */
  captionBackupRestore(params) {
    return postJson('/api/captions/backups/restore', params);
  },

  /** 图像预处理预览 */
  imageResizePreview(inputDir, recursive = false, limit = 8) {
    return request(`/api/image_resize/preview?input_dir=${encodeURIComponent(inputDir)}&recursive=${recursive}&limit=${limit}`);
  },

  /** 获取可用脚本列表 */
  getAvailableScripts() {
    return request('/api/scripts');
  },

  /** 获取文件列表（模型文件 / 训练目录） */
  getFiles(pickType) {
    return request(`/api/get_files?pick_type=${encodeURIComponent(pickType)}`);
  },

  /** 获取配置摘要 */
  getConfigSummary() {
    return request('/api/config/summary');
  },

  /** 获取训练任务输出日志 */
  getTaskOutput(taskId, tail = 100) {
    return request(`/api/task_output/${taskId}?tail=${tail}`);
  },
};
