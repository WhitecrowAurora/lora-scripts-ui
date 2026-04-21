# LoRA ReScripts UI V2.0.0

秋叶 LoRA 训练包的独立前端界面，提供中文本地化的 SDXL LoRA 训练参数配置、数据集处理、日志查看和实用工具。大部分功能主要适配重置版后端，请在这里下载https://github.com/WhitecrowAurora/lora-rescripts

## 目录结构

```
ui/
├── src/
│   ├── main.js          # 主逻辑（渲染、事件、状态管理）
│   ├── api.js           # 所有后端 API 调用封装
│   ├── sdxlSchema.js    # SDXL LoRA 参数定义（字段、默认值、可见性规则）
│   ├── i18n.js          # 中文本地化
│   └── style.css        # 全部样式
├── saved_params/        # 用户保存的参数文件（.json）
├── dist/                # 构建产物（部署用）
├── index.html           # 入口页面
├── vite.config.js       # Vite 配置 + 开发服务器 API
├── package.json
└── README.md
```

## 部署方式

### 推荐：放入训练包内部

将整个 `ui/` 文件夹放到训练包根目录下：

```
lora-scripts-v1.12.0/
├── train/
├── sd-models/
├── output/
├── logs/
├── config/
├── python/
├── ui/               ← 放在这里
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── app.py
└── ...
```

UI 会自动检测到上级目录就是训练包根目录（通过检查 `train/` 和 `sd-models/` 是否存在）。

### 备选：与训练包同级

```
Ai paint/
├── lora-scripts-v1.12.0/
└── ui/
```

UI 会自动扫描同级的 `lora-scripts*` 目录。

### 备选：环境变量

```bash
set LORA_SCRIPTS_ROOT=D:\path\to\lora-scripts-v1.12.0
cd ui
npm run dev
```

## 快速开始

### 方式一：一键启动（推荐）

双击训练包根目录下的 **`启动前端UI.bat`**，脚本会自动：

1. 启动后端服务（`gui.py`，端口 28000），包括 TensorBoard 和 TagEditor
2. 检查 Node.js（没有则尝试 winget 自动安装）
3. 首次运行时自动 `npm install`（使用淘宝镜像加速）
4. 启动前端开发服务器（端口 3006），自动打开浏览器

> 前置要求：Node.js 18+（脚本会尝试自动安装）

### 方式二：手动启动

先启动后端：

```bash
cd lora-scripts-v1.12.0
python gui.py --port 28000
```

再启动前端：

```bash
cd lora-scripts-v1.12.0/ui
npm install
npm run dev
```

开发模式下，Vite 自带的中间件会模拟以下 API（直接读写本地文件）：

| 端点 | 说明 |
|---|---|
| `/api/builtin_picker` | 浏览 train / sd-models / output 目录 |
| `/api/saved_configs/*` | 保存/读取/删除参数预设 |
| `/api/log_dirs` | 列出训练日志目录 |
| `/api/log_detail` | 查看日志目录详情 |
| `/api/dataset_tags` | 读取数据集标签 |
| `/api/dataset_tags/save` | 保存单张图片标签 |
| `/api/image_resize` | 调用图像预处理 Python 脚本 |

其余 API（训练、预检、显卡检测、标注等）会通过 `proxy` 转发到后端 `http://127.0.0.1:28000`。

### 3. 构建

```bash
npm run build
```

产物输出到 `ui/dist/`。可以直接替换训练包的 `frontend/dist/` 目录。

### 4. 配合后端使用

启动训练包后端：

```bash
cd lora-scripts-v1.12.0
python app.py
```

后端默认监听 `127.0.0.1:28000`，前端开发服务器会自动代理所有 `/api` 请求过去。

## 功能模块

### 配置（Config）

- SDXL LoRA 全参数表单，按 模型/数据集/网络/优化器/训练/预览/加速/高级 分 Tab
- 每个字段有三点菜单（撤销更改 / 恢复默认）
- 路径字段支持内置文件选择器（浏览 train / sd-models / output 目录）
- 状态卡片显示 GPU 信息、xFormers、训练预检、任务状态
- 参数预览面板（右侧 JSON）

### 参数管理（Navigator）

- 重置所有参数
- 保存参数（写入 `saved_params/*.json`）
- 读取参数（列表 + 预览 + 载入 + 删除）
- 下载配置文件（时间戳文件名）
- 导入配置文件

### 数据集处理（Dataset）

三个子 Tab：

1. **标签器** — WD14 / CL Tagger 自动标注（12 个模型可选）
2. **标签编辑器** — 占位，推荐使用外部 BooruDatasetTagManager
3. **图像预处理** — 批量缩放/裁剪/转格式/重命名（调用训练包内的 Python 脚本）

### 日志（Logs）

- 列出 `logs/` 下所有 TensorBoard 日志目录
- 查看目录内文件详情

### 工具（Tools）

- 从模型提取 LoRA
- 从 DyLoRA 提取 LoRA
- 合并 LoRA
- 合并模型

### 设置（Settings）

- 主题切换（深色/浅色）
- 左侧导航栏宽度调节
- 右侧预览面板宽度调节
- 布局重置

## API 接口对照表

前端所有 API 调用均通过 `/api` 前缀，与 lora-scripts 后端（Mikazuki）完全兼容。

| 前端方法 | 后端路由 | 来源 |
|---|---|---|
| `getGraphicCards()` | `GET /api/graphic_cards` | Mikazuki |
| `getPresets()` | `GET /api/presets` | Mikazuki |
| `getSavedParams()` | `GET /api/config/saved_params` | Mikazuki |
| `getTasks()` | `GET /api/tasks` | Mikazuki |
| `terminateTask(id)` | `GET /api/tasks/terminate/:id` | Mikazuki |
| `pickFile(type)` | `GET /api/pick_file` | Mikazuki |
| `runPreflight(config)` | `POST /api/train/preflight` | Vite 中间件（本地路径验证） |
| `runTraining(config)` | `POST /api/run` | Mikazuki |
| `runScript(params)` | `POST /api/run_script` | Mikazuki |
| `runInterrogate(params)` | `POST /api/interrogate` | Mikazuki |
| `getBuiltinPicker(type)` | `GET /api/builtin_picker` | Vite 中间件 |
| `saveConfig(name, config)` | `POST /api/saved_configs/save` | Vite 中间件 |
| `listSavedConfigs()` | `GET /api/saved_configs/list` | Vite 中间件 |
| `loadSavedConfig(name)` | `GET /api/saved_configs/load` | Vite 中间件 |
| `deleteSavedConfig(name)` | `GET /api/saved_configs/delete` | Vite 中间件 |
| `getLogDirs()` | `GET /api/log_dirs` | Vite 中间件 |
| `getLogDetail(dir)` | `GET /api/log_detail` | Vite 中间件 |
| `getDatasetTags(dir)` | `GET /api/dataset_tags` | Vite 中间件 |
| `saveDatasetTag(params)` | `POST /api/dataset_tags/save` | Vite 中间件 |
| `runImageResize(params)` | `POST /api/image_resize` | Vite 中间件 |

> "Vite 中间件" 标注的接口仅在开发模式 (`npm run dev`) 下可用。
> 生产部署时需要由后端（Python FastAPI）实现这些端点，或将 `dist/` 替换到训练包 `frontend/dist/` 后由 Mikazuki 统一代理。

## 路径自动检测逻辑

`vite.config.js` 中的 `detectLoraScriptsRoot()` 按以下优先级检测训练包位置：

1. **环境变量** `LORA_SCRIPTS_ROOT` — 最高优先级，适合自定义部署
2. **上级目录** — 如果 `ui/` 的上级目录包含 `train/` 和 `sd-models/`，认为它就是训练包根目录
3. **同级目录** — 扫描 `ui/` 同级的 `lora-scripts*` 目录
4. **兜底** — 使用上级目录

## 浏览器兼容性

- Chrome 90+
- Edge 90+
- Firefox 90+
- Safari 15+


