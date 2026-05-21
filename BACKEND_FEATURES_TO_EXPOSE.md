# 后端新增能力前端接入说明

本文给前端开发者使用，记录近期后端已经接入、但 `plugin/lora-scripts-ui-main` 里还没有完整暴露的训练功能。这里不是发布说明，而是前端接入清单。

重点：**Concept Geometry Sampling / 概念几何采样不是新的 LoRA 格式**。它只是 trainer 侧的数据几何分析、采样和可选 loss 加权策略，不改变 LoRA checkpoint key，也不改变 adapter 数学。

## 0. 建议先接的接口

训练页启动前：

```http
GET  /api/train/execution-profiles
GET  /api/train/profiles
GET  /api/train/profiles/{schema_id}
POST /api/train/config/resolve
POST /api/train/preflight
POST /api/train/performance/tune
POST /api/train/lr-find
```

训练运行中/结束后：

```http
GET  /api/train/active
GET  /api/train/status/{run_id}
GET  /api/train/log/{run_id}?offset=0&max_lines=500
GET  /api/train/chart-series/{run_id}?series=loss&last_n=200
GET  /api/train/events/{run_id}?last_n=50
GET  /api/train/runs
GET  /api/train/experiments
GET  /api/train/experiments/{run_id}
GET  /api/train/experiments/{run_id}/artifacts
GET  /api/train/experiments/{run_id}/compare?with_run_id=...
GET  /api/train/runs/{run_id}/timeline
GET  /api/train/runs/{run_id}/recovery
GET  /api/train/runs/{run_id}/report
POST /api/train/runs/{run_id}/report/rebuild
```

已有但更偏实验/内部：

```http
GET  /api/train/advanced-features/check
GET  /api/train/pilot-events
POST /api/train/auto-controller/config
GET  /api/train/auto-controller/status
POST /api/train/dora/config
POST /api/train/coreset/config
GET  /api/train/coreset/statistics
GET  /api/train/coreset/toxic-samples
```

`metrics/update`、`metrics/svd`、`metrics/pilot` 是训练进程回写用接口，前端一般只读 `/metrics`、`/chart-series`、`/events`。

## 1. 概念几何采样配置

后端训练配置已经支持以下字段，Anima LoRA 页面应该暴露。当前 `ui/src/animaSchema.js` 已经有一部分字段，但需要确认 UI 文案、显隐关系和预检报告是否完整。

基础字段：

```json
{
  "concept_geometry_enabled": false,
  "concept_geometry_path": "",
  "concept_geometry_sampler_mode": "density_curriculum",
  "concept_geometry_loss_weighting": false,
  "concept_geometry_density_power": 1.0
}
```

建议 UI：

- `concept_geometry_enabled`：开关，文案用“启用概念几何采样”。
- `concept_geometry_path`：文件选择器，留空时后端默认找 `train_data_dir/concept_geometry.json`，并兼容旧 `h_lora_geometry.json`。
- `concept_geometry_sampler_mode`：下拉框，选项为 `curriculum`、`density`、`density_curriculum`、`concept_batch`。
- `concept_geometry_loss_weighting`：开关。
- `concept_geometry_density_power`：数字输入，建议范围 `0 - 4`，步长 `0.1`。

旧字段 `h_lora_*` 仍由后端兼容，但新 UI 不建议再主动展示旧名称。

## 2. 概念几何语义增强配置

后端配置层和 schema 已保留 prep-time 语义增强字段，用于准备 `concept_geometry.json` 时增强 caption/tag 解析。

这些字段目前更适合放在“高级/实验”折叠区域：

```json
{
  "concept_geometry_semantic_enabled": false,
  "concept_geometry_embedding_provider": "local_path",
  "concept_geometry_embedding_backend": "pytorch",
  "concept_geometry_embedding_model": "BAAI/bge-m3",
  "concept_geometry_embedding_model_path": "",
  "concept_geometry_embedding_cache_dir": "",
  "concept_geometry_embedding_allow_download": false,
  "concept_geometry_embedding_api_base": "",
  "concept_geometry_embedding_api_key": "",
  "concept_geometry_embedding_api_model": "",
  "concept_geometry_embedding_batch_size": 8,
  "concept_geometry_embedding_device": "cpu",
  "concept_geometry_translation_enabled": false,
  "concept_geometry_translation_provider": "local_path",
  "concept_geometry_translation_model_path": "",
  "concept_geometry_translation_api_base": "",
  "concept_geometry_translation_api_key": "",
  "concept_geometry_translation_api_model": "",
  "concept_geometry_translation_batch_size": 8,
  "concept_geometry_alias_map": "",
  "concept_geometry_alias_map_path": "",
  "concept_geometry_source_priority": "explicit,folder,nl,identity,tag,stem"
}
```

注意：

- `allow_download`、API embedding、API translation 都有隐私/网络风险。UI 必须明确提示，不能静默联网。
- 当前主要训练路径不要求这些字段；默认 `latent_tags` 已可用。
- 如果没有“生成 concept_geometry.json”的前端入口，这些 prep-time 字段只是随配置保存/透传，用户仍需要通过脚本生成 geometry。

## 3. 预检报告新增字段

接口：

```http
POST /api/train/preflight
```

请求结构示例：

```json
{
  "execution_profile_id": "local",
  "attention_backend": "auto",
  "allow_attention_fallback": true,
  "execution_core": "standard",
  "schema_id": "anima-lora",
  "config": {
    "train_data_dir": "H:/lulynx-trainer/sucai/6_lulu",
    "pretrained_model_name_or_path": "H:/lulynx-trainer/models/anima/diffusion_models/anima-preview2.safetensors",
    "concept_geometry_enabled": true,
    "concept_geometry_path": "H:/lulynx-trainer/tmp/concept_geometry_p1_check.json",
    "concept_geometry_sampler_mode": "density_curriculum"
  }
}
```

响应里除 `ok`、`can_start`、`issues`、`errors`、`warnings`、`notes`、`dataset`、`cache`、`resume`、`tensorboard`、`resolved` 外，近期还新增了这些前端应渲染的块：

```json
{
  "dataset_audit": {},
  "dataset_health": {},
  "caption_tag_pipeline": {},
  "fixed_preview": {},
  "fixed_prompt_validation_set": {},
  "concept_geometry": {},
  "lock_check": {},
  "family_compatibility": {},
  "turbocore": {},
  "turbocore_capability_report": {},
  "checkpoint_info": {},
  "config_resolution": {},
  "repair_plan": {},
  "repair_actions": [],
  "repairable": true,
  "blocked_by_unrepairable": false,
  "override_layer_preview": {}
}
```

当前 `ui/src/renderers/preflight.js` 只渲染了 `pf.dataset` 和 `pf.dependencies` 等基础块，需要补这些新块。可以参考另一个工作目录里的实现：

```text
plugin/lora-scripts-ui-main-new/ui/src/renderers/preflight.js
```

## 4. Dataset Audit / Dataset Health

`preflight.dataset_audit` 是完整数据集审计报告，`preflight.dataset_health` 是给 UI 快速展示的摘要。

前端建议优先展示：

- `dataset_health.health_score`：健康分。
- `dataset_health.readiness`：是否适合直接训练。
- `dataset_health.finding_counts`：错误/警告/建议数量。
- `dataset_health.recommended_actions`：建议动作。
- `dataset_audit.summary`：图片数量、caption 数量、分辨率分布等。

UI 上可以做成“数据集健康”卡片。注意不要把低分一律当成阻塞，是否可启动以后端 `can_start` 和 `blocked_by_unrepairable` 为准。

## 5. Caption Tag Pipeline

`preflight.caption_tag_pipeline` 汇总 caption/tag 解析结果，并被 `fixed_prompt_validation_set` 和 Concept Geometry 使用。

前端建议展示：

- `status`：ready / unavailable / error。
- `dataset_signature`：数据集签名。
- `analysis`：tag 统计、概念词、可能的缺失项。
- `suggestions`：固定验证 prompt 或标签建议来源。

这块适合放在“标签/语义分析”折叠区，也可以给 Concept Geometry 报告提供 tag 分布说明。

## 6. Fixed Preview / 固定验证 Prompt

`preflight.fixed_preview` 和 `preflight.fixed_prompt_validation_set` 用于稳定复现实验对比。训练启动时后端会把固定验证集写入运行目录：

```text
.runs/<run_id>/fixed_prompt_validation_set.json
```

前端建议：

- 预检页展示 prompt 数量、来源和 `dataset_signature`。
- 训练完成报告页显示同一组 prompt，方便比较不同实验。
- 不要每次前端随机生成验证 prompt，否则实验之间不可比。

## 7. Concept Geometry 预检和可视化

`preflight.concept_geometry` 内含摘要、指标和轻量可视化数据。典型结构：

```json
{
  "concept_geometry": {
    "enabled": true,
    "geometry_path": ".../concept_geometry.json",
    "geometry_version": 2,
    "backend_requested": "latent_tags",
    "backend_resolved": "latent+tags",
    "feature_sources": ["latent", "tags"],
    "fallback_reasons": [],
    "dataset_sample_count": 60,
    "geometry_sample_count": 60,
    "attached_count": 60,
    "geometry_attach_rate": 1.0,
    "concept_group_count": 1,
    "neighbor_same_ratio": 1.0,
    "sibling_same_ratio": 1.0,
    "conflict_mean": 0.0,
    "risk": "collapsed",
    "warnings": []
  },
  "metrics": {},
  "visualization": {},
  "warnings": []
}
```

前端建议新增一个“概念几何采样”预检区块，显示：

- 几何覆盖：`metrics.geometry_attach_rate`
- 概念组数量：`metrics.geometry_concept_group_count`
- 邻居同概念率：`metrics.neighbor_same_ratio`
- 兄弟同概念率：`metrics.sibling_same_ratio`
- 冲突均值：`metrics.conflict_mean`
- 风险状态：`metrics.risk`
- 实际使用特征源：`concept_geometry.concept_geometry.feature_sources`
- fallback 原因：`concept_geometry.concept_geometry.fallback_reasons`

风险状态建议解释：

- `ok`：几何关系看起来正常。
- `collapsed`：通常是单概念数据，能做密度/课程采样，但不能证明多概念解耦。
- `cache_mismatch`：geometry 文件和数据集样本对不上。
- `weak_multiconcept`：多概念邻接关系混杂，可能有概念泄漏风险。

后端已经给了轻量可视化数据，不需要前端重新计算：

- `visualization.concept_distribution`
- `visualization.top_tags`
- `visualization.resolution_distribution`
- `visualization.orientation_distribution`
- `visualization.geometry_scatter`
- `visualization.geometry_edges`
- `visualization.conflict_histogram`

建议第一版 UI 用条形列表和小 SVG 散点图即可，不要先引入新图表依赖。

## 8. Preflight Repair / 启动前修复建议

预检响应里的修复相关字段：

```json
{
  "repair_plan": {},
  "repair_actions": [],
  "repairable": true,
  "blocked_by_unrepairable": false,
  "override_layer_preview": {}
}
```

前端用途：

- 展示哪些问题可自动修复，哪些必须用户手动处理。
- `override_layer_preview` 可作为“应用推荐配置”的预览层，但必须让用户确认后再加入 `extra_config_layers` 或写回表单。
- `blocked_by_unrepairable=true` 时禁用启动按钮，原因以 `issues/errors` 和 `repair_actions` 为准。

注意：repair plan 是建议，不是强制修改。前端不要在用户无感知时自动改训练参数。

## 9. Family Compatibility / Checkpoint Info

`preflight.family_compatibility` 用于检查 schema、route、profile、模型族和配置是否匹配。`preflight.checkpoint_info` 是模型 checkpoint 侧信息。

前端建议：

- 在模型选择/训练类型区域显示 compatibility 的 errors/warnings。
- 启动前若模型族不匹配，优先显示这块，比普通日志更容易定位。
- 不要只依赖文件扩展名判断模型类型，后端已经做了更可靠的检查。

## 10. 配置解析和训练 Profile

后端新增了配置解析/Profile 相关接口，适合前端用于“启动前预览最终训练配置”和“Profile 选择器”。

```http
GET  /api/train/execution-profiles
GET  /api/train/profiles
GET  /api/train/profiles/{schema_id}
POST /api/train/config/resolve
```

`POST /api/train/config/resolve` 请求：

```json
{
  "schema_id": "anima-lora",
  "profile_id": "default",
  "config": {},
  "include_trainer_config_preview": true,
  "config_schema_version": 1,
  "target_schema_version": 1,
  "extra_config_layers": []
}
```

前端建议用途：

- 用户切换 profile 后，调用 `/config/resolve` 预览最终配置。
- 展示 `warnings`、`applied_layers`、`trainer_config_preview`。
- 启动训练前可用解析结果减少“UI 显示值”和“实际提交值”不一致。
- `family_compatibility` 也会随解析结果返回，可提前拦截模型族/训练族不匹配。

## 11. Performance Tune / LR Finder

性能调参接口：

```http
POST /api/train/performance/tune
```

请求字段：

```json
{
  "hardware_summary": {},
  "backend_capabilities": {},
  "benchmark_results": {},
  "current_config": {},
  "benchmark_scope": {}
}
```

返回会包含建议配置和 `override_layer_preview`，适合做“根据显存/attention backend 推荐 batch、precision、缓存策略”的按钮。

LR finder 接口：

```http
POST /api/train/lr-find
```

它适合做成“学习率探测”实验按钮。前端要把它和正式训练区分开，避免用户误以为已经开始完整训练。

## 12. Config Snapshot / Config Lock

训练启动后，后端会在运行目录写入：

```text
.runs/<run_id>/config_snapshot.json
.runs/<run_id>/config_lock.json
.runs/<run_id>/fixed_prompt_validation_set.json
```

`GET /api/train/status/{run_id}` 会补充：

```json
{
  "config_snapshot": {},
  "config_lock": {},
  "lock_check": {},
  "training_config": {}
}
```

前端用途：

- 训练详情页展示“本次真实训练配置”，不要只显示当前表单值。
- 显示 `lock_check.status`，用于判断报告/固定验证集/数据审计是否和启动时一致。
- 实验比较时用 lock digest 判断两个 run 的配置是否真的可比。

## 13. 训练运行报告和实验注册表

后端已有运行报告接口，前端可以做“训练完成报告”或“实验详情页”。

```http
GET  /api/train/runs/{run_id}/report
POST /api/train/runs/{run_id}/report/rebuild
GET  /api/train/runs/{run_id}/timeline
GET  /api/train/runs/{run_id}/recovery
GET  /api/train/experiments
GET  /api/train/experiments/{run_id}
GET  /api/train/experiments/{run_id}/artifacts
GET  /api/train/experiments/{run_id}/compare?with_run_id=...
```

建议前端先做：

- 训练结束后展示 report 链接/按钮。
- 在 run detail 中展示 artifacts，包括 `config_snapshot.json`、`config_lock.json`、`fixed_prompt_validation_set.json`。
- timeline/recovery 可以先作为调试折叠面板。
- compare 页面先展示 dataset signature、config digest、loss 曲线摘要和产物列表。

## 14. 训练遥测 / 日志 / 事件

运行态相关接口：

```http
GET /api/train/active
GET /api/train/status/{run_id}
GET /api/train/log/{run_id}?offset=0&max_lines=500
GET /api/train/chart-series/{run_id}?series=loss&last_n=200
GET /api/train/chart-series/{run_id}?series=lr&last_n=200
GET /api/train/events/{run_id}?last_n=50
GET /api/train/metrics
GET /api/train/pilot-events
```

前端建议：

- 日志读取使用 `offset` 做增量轮询。
- loss/lr 曲线优先用 `/chart-series`，不用前端重复解析全量日志。
- `/pilot-events` 是 SSE，只有 MN-LoRA optimizer active 时才有实际 pilot 决策；普通 native trainer 不会产生这类事件。

## 15. Advanced Features / MN-LoRA / DoRA / Coreset

后端存在一组高级功能检查和配置接口：

```http
GET  /api/train/advanced-features/check
POST /api/train/auto-controller/config
GET  /api/train/auto-controller/status
POST /api/train/dora/config
POST /api/train/coreset/config
GET  /api/train/coreset/statistics
GET  /api/train/coreset/toxic-samples
```

注意：

- 这些接口里有些仍偏占位/实验态，前端应标注“实验功能”。
- MN-LoRA pilot 事件只在对应 optimizer 包装启用时有效。
- Concept Geometry 可以和 MN-LoRA 混合做实验，但 UI 文案应写成“采样/训练策略组合”，不要暗示它们是新的模型文件格式。

## 16. Runtime Doctor / 离线运行环境诊断

后端 launcher 层已有 runtime doctor 服务方法：

```text
doctor_runtime(runtime_id)
verify_runtime_repair(runtime_id, action_code="")
```

它们返回只读诊断报告和 dry-run 修复验证。当前文档没有确认这些方法在本 UI 插件里对应的 HTTP 路由路径，因此前端接入前需要按实际 launcher API 网关绑定确认 URL。

建议 UI：

- 放在运行环境/依赖管理页面，而不是训练表单里。
- 展示 repair actions，但执行修复前必须让用户确认。
- 不要把 runtime doctor 和训练 preflight repair 混在一个按钮里，它们诊断层级不同。

## 17. 训练后 Adapter 评估

后端核心里新增了 `adapter_evaluator.py`，可以读取 LoRA/adapter `.safetensors` 并输出权重健康信息：

- tensor 数量
- 参数数量
- 非零率
- mean_abs / rms / max_abs
- rank 估计
- key family 分布
- dtype / shape 分布
- warnings

目前它是脚本/benchmark 内部能力：

```powershell
python backend/core/lulynx_trainer/adapter_evaluator.py <adapter.safetensors> --output <report.json>
```

如果前端要做“训练后 LoRA 健康检查”按钮，建议先让后端补一个 HTTP API，例如：

```http
POST /api/train/adapter/evaluate
```

请求：

```json
{ "adapter_path": "H:/.../xxx.safetensors" }
```

在 HTTP API 补齐前，前端不建议直接 shell 调用脚本。

## 18. 当前不建议前端做的事

- 不要把 Concept Geometry 描述为“新 LoRA 格式”。
- 不要自动联网下载 embedding/translation 模型。
- 不要在 `batch_size == 1` 时宣传 `concept_batch` 一定生效；后端会 fallback。
- 不要把 `risk=collapsed` 当成训练失败；单概念数据通常会出现这个状态。
- 不要删除旧 `h_lora_*` 配置兼容，后端仍用于读取旧配置。
- 不要静默应用 repair plan、performance tune 或 runtime doctor 的建议。
- 不要用前端当前表单值代替 run 的 `config_snapshot` 展示历史训练。

## 19. 建议开发顺序

1. 在 preflight report 中渲染 `dataset_health`、`caption_tag_pipeline`、`fixed_preview`、`concept_geometry`、`repair_plan`、`family_compatibility`。
2. 完善 Anima LoRA 配置区的概念几何字段文案和显隐。
3. 接 `/train/config/resolve`、`/train/profiles`、`/train/execution-profiles`，做 profile/最终配置预览。
4. 做 fixed prompt 和 Concept Geometry 可视化：概念分布、冲突直方图、散点。
5. 做 run detail：`status`、`log`、`chart-series`、`events`、`config_snapshot`、`lock_check`。
6. 做 report/artifacts/experiments/compare 页面。
7. 再接 performance tune、LR finder 和高级实验功能。
8. 如需要训练后 adapter 评估，先让后端补 HTTP API，再做按钮。
