import { escapeHtml } from './utils/dom.js';

function emptyWorkspace() {
  return {
    revision: 0,
    active_project_id: '',
    active_version_id: '',
    projects: [],
    active_config: null,
  };
}

function activeEntries(workspace) {
  const projects = Array.isArray(workspace?.projects) ? workspace.projects : [];
  const project = projects.find((item) => item.id === workspace.active_project_id) || null;
  const versions = Array.isArray(project?.versions) ? project.versions : [];
  const version = versions.find((item) => item.id === workspace.active_version_id) || null;
  return { projects, project, versions, version };
}

function responseWorkspace(response) {
  if (response?.status !== 'success' || !response.data || typeof response.data !== 'object') {
    throw new Error(response?.message || '训练项目操作失败。');
  }
  return response.data;
}

export function renderTrainingProjectBar(state) {
  const workspace = state.trainingWorkspace || emptyWorkspace();
  const { projects, project, versions, version } = activeEntries(workspace);
  const projectOptions = projects.map((item) => (
    `<option value="${escapeHtml(item.id)}"${item.id === project?.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`
  )).join('');
  const versionOptions = versions.map((item) => (
    `<option value="${escapeHtml(item.id)}"${item.id === version?.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`
  )).join('');
  return `
    <div class="section-toolbar training-project-toolbar" aria-label="训练项目与版本">
      <label class="training-project-control">
        <span>项目</span>
        <select onchange="switchTrainingProject(this.value)" ${projects.length ? '' : 'disabled'}>
          ${projectOptions || '<option value="">尚未创建</option>'}
        </select>
      </label>
      <label class="training-project-control">
        <span>版本</span>
        <select onchange="switchTrainingProjectVersion(this.value)" ${versions.length ? '' : 'disabled'}>
          ${versionOptions || '<option value="">尚未创建</option>'}
        </select>
      </label>
      <label class="training-project-control training-project-name">
        <span>名称</span>
        <input id="training-project-version-name" type="text" maxlength="128"
          value="${escapeHtml(version?.name || '')}" placeholder="版本名称">
      </label>
      <div class="toolbar-actions training-project-actions">
        <button class="btn btn-outline btn-sm" type="button" onclick="createTrainingProject()" title="以当前配置创建项目">新建项目</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="saveTrainingProjectVersion()" ${version ? '' : 'disabled'} title="保存当前版本">保存</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="forkTrainingProjectVersion()" ${version ? '' : 'disabled'} title="从当前版本创建分支">Fork</button>
      </div>
    </div>
  `;
}

export function createTrainingProjectActions({
  state,
  api,
  configTransaction,
  resetTransientState,
  saveDraft,
  renderView,
  showToast,
}) {
  let operationQueue = Promise.resolve();

  function enqueue(operation) {
    const result = operationQueue.catch(() => {}).then(operation);
    operationQueue = result;
    return result;
  }

  function setWorkspace(payload, { applyConfig = false } = {}) {
    state.trainingWorkspace = payload && typeof payload === 'object' ? payload : emptyWorkspace();
    if (!applyConfig || !state.trainingWorkspace.active_config) return;
    const config = { ...state.trainingWorkspace.active_config };
    const typeId = String(config.model_train_type || state.activeTrainingType || '').trim();
    if (typeId) {
      state.activeTrainingType = typeId;
      localStorage.setItem('sd-rescripts:training-type', typeId);
      if (window.currentTrainingType !== undefined) window.currentTrainingType = typeId;
    }
    state.config = config;
    state.hasLocalDraft = true;
    resetTransientState();
    saveDraft();
  }

  function inputName() {
    return String(document.getElementById('training-project-version-name')?.value || '').trim();
  }

  async function persistCurrentVersion() {
    const workspace = state.trainingWorkspace || emptyWorkspace();
    const { project, version } = activeEntries(workspace);
    if (!project || !version) return workspace;
    await configTransaction.flush();
    const response = await api.saveTrainingProjectVersion({
      revision: workspace.revision,
      project_id: project.id,
      version_id: version.id,
      name: inputName() || version.name,
      config: state.config,
    });
    const payload = responseWorkspace(response);
    setWorkspace(payload);
    return payload;
  }

  function createTrainingProject() {
    return enqueue(async () => {
      try {
        await configTransaction.flush();
        const response = await api.createTrainingProject({
          revision: Number(state.trainingWorkspace?.revision || 0),
          name: String(state.config.output_name || 'Training project'),
          version_name: inputName() || 'Version 1',
          config: state.config,
        });
        setWorkspace(responseWorkspace(response), { applyConfig: true });
        renderView('config');
        showToast('训练项目已创建。');
      } catch (error) {
        showToast(error.message || '创建训练项目失败。');
      }
    });
  }

  function saveTrainingProjectVersion() {
    return enqueue(async () => {
      try {
        await persistCurrentVersion();
        renderView('config');
        showToast('项目版本已保存。');
      } catch (error) {
        showToast(error.message || '保存项目版本失败。');
      }
    });
  }

  function forkTrainingProjectVersion() {
    return enqueue(async () => {
      try {
        const saved = await persistCurrentVersion();
        const { project, version } = activeEntries(saved);
        if (!project || !version) throw new Error('当前项目版本不可用。');
        const response = await api.forkTrainingProjectVersion({
          revision: saved.revision,
          project_id: project.id,
          version_id: version.id,
          name: inputName() ? `${inputName()} fork` : `${version.name} fork`,
          config: state.config,
        });
        setWorkspace(responseWorkspace(response), { applyConfig: true });
        renderView('config');
        showToast('已创建项目版本分支。');
      } catch (error) {
        showToast(error.message || '创建版本分支失败。');
      }
    });
  }

  function switchTo(projectId, versionId) {
    return enqueue(async () => {
      try {
        const saved = await persistCurrentVersion();
        const targetProject = saved.projects?.find((item) => item.id === projectId);
        const targetVersionId = versionId || targetProject?.versions?.[0]?.id || '';
        if (!targetProject || !targetVersionId) throw new Error('目标项目版本不存在。');
        const response = await api.switchTrainingProjectVersion({
          revision: saved.revision,
          project_id: targetProject.id,
          version_id: targetVersionId,
        });
        setWorkspace(responseWorkspace(response), { applyConfig: true });
        renderView('config');
      } catch (error) {
        showToast(error.message || '切换项目版本失败。');
        renderView('config');
      }
    });
  }

  function switchTrainingProject(projectId) {
    return switchTo(projectId, '');
  }

  function switchTrainingProjectVersion(versionId) {
    return switchTo(state.trainingWorkspace?.active_project_id || '', versionId);
  }

  async function recordTrainingProjectRun(runId, projectId = '', versionId = '') {
    return enqueue(async () => {
      const workspace = state.trainingWorkspace || emptyWorkspace();
      const { projects, project: activeProject, version: activeVersion } = activeEntries(workspace);
      const hasExplicitTarget = Boolean(projectId || versionId);
      let project = activeProject;
      let version = activeVersion;
      if (hasExplicitTarget) {
        project = projectId ? projects.find((item) => item.id === projectId) : null;
        version = project && versionId
          ? project.versions?.find((item) => item.id === versionId)
          : null;
        if (!project || !version) {
          showToast('训练项目谱系目标已失效，已跳过记录。');
          return;
        }
      }
      if (!project || !version || !runId) return;
      try {
        const response = await api.recordTrainingProjectRun({
          revision: workspace.revision,
          project_id: project.id,
          version_id: version.id,
          run_id: runId,
        });
        setWorkspace(responseWorkspace(response));
      } catch (error) {
        showToast(`训练已启动，但项目 lineage 写入失败：${error.message || '未知错误'}`);
      }
    });
  }

  return {
    createTrainingProject,
    saveTrainingProjectVersion,
    forkTrainingProjectVersion,
    switchTrainingProject,
    switchTrainingProjectVersion,
    recordTrainingProjectRun,
  };
}
