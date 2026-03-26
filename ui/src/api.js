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
};
