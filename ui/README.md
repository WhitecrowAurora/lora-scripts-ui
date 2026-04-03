# LoRA ReScripts UI

> SD-reScripts 新前端界面，基于 Vite + 原生 JS 构建。

## 快速开始

### 普通启动（推荐）

双击根目录下的 **`A启动新前端UI.bat`**，脚本会自动：

1. 启动后端 API 服务（端口 28000）
2. 检测并安装 Node.js（如未安装）
3. 安装前端依赖（首次约 30 秒）
4. 启动 Vite 开发服务器（端口 3006）并自动打开浏览器

访问地址：
- **前端**：http://localhost:3006
- **后端 API**：http://127.0.0.1:28000

---

## SageAttention 版使用须知

SageAttention 使用独立的 Python 运行时环境（`python-sageattention/`），与主环境完全隔离。

### 首次使用

**必须先完成 SageAttention 环境安装**，否则无法启动：

1. 先双击 **`run_For_SageAttention_Experimental.bat`** 完成 SageAttention 环境初始化
   - 这一步会自动下载并安装 torch (cu128)、triton、sageattention 等训练依赖
   - 首次安装约需 5~10 分钟（视网络速度）
   - 如果最后报编码错误（`0xb5 invalid start byte`）但之前显示 `symbols: True True`，说明实际已安装成功，可以忽略
2. 安装成功后，双击 **`A启动新前端UI(SageAttention).bat`** 启动新前端
   - 首次启动时会自动补装 GUI 服务依赖（uvicorn、fastapi、pandas 等），约 1~2 分钟
   - 训练依赖（accelerate、transformers、diffusers 等）也会一并安装，版本已锁定与主环境一致
   - 后续启动会跳过安装步骤，几秒内完成

### 启动脚本对比

| 脚本 | 后端 Python | 训练时可用 SageAttention | 用途 |
|---|---|---|---|
| `A启动新前端UI.bat` | `python/python.exe` | ❌ | 普通训练（xformers/SDPA） |
| `A启动新前端UI(SageAttention).bat` | `python-sageattention/python.exe` | ✅ | 需要 SageAttention 加速的训练 |

### 注意事项

- **不要同时运行两个启动脚本**，它们共用 28000 端口，会冲突
- SageAttention 版的后端窗口最小化在任务栏，需要**手动关闭**
- 如果后端启动失败，检查最小化的后端窗口（标题 `LoRA-Backend-SageAttn`）查看错误信息
- 配置模块中勾选「启用 SageAttention」后训练时才会实际使用 sageattn
- SageAttention 仅支持 NVIDIA GPU（RTX 20/30/40/50 系列）

### 已知问题

- `run_gui.ps1` 的运行时探测脚本在 Triton 首次编译内核时可能输出非 UTF-8 字节（如 `µ`），导致 PowerShell 解析失败。`A启动新前端UI(SageAttention).bat` 通过直接调用 `gui.py` 并设置 `PYTHONIOENCODING=utf-8` 绕过了此问题。
- SageAttention 环境的 tensorboard 需要额外安装（脚本会自动处理）

---

## 目录结构

```
ui/
├── src/
│   ├── main.js          # 主逻辑（渲染、状态管理、事件绑定）
│   ├── sdxlSchema.js    # 多训练类型 Schema 系统（18 种训练类型）
│   ├── api.js           # 后端 API 调用封装
│   ├── style.css        # 全局样式
│   └── i18n.js          # 国际化（预留）
├── saved_params/        # 用户保存的训练参数配置
├── index.html           # 入口 HTML
├── package.json         # Node.js 依赖
├── vite.config.js       # Vite 配置（含 API 代理）
└── README.md            # 本文件
```

## 反馈

GitHub 地址：https://github.com/WhitecrowAurora/lora-rescripts

本前端反馈：https://github.com/LichiTI/lora-scripts-ui
