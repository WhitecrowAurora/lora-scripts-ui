@echo off
chcp 65001 >nul 2>&1
title LoRA ReScripts UI V2.0.0 (SageAttention)

echo ============================================
echo   LoRA ReScripts UI V2.0.0 一键启动脚本
echo   SageAttention Runtime
echo   Backend [28000] + Frontend [3006]
echo ============================================
echo.

cd /d "%~dp0"

:: ── 检查 ui 文件夹 ──
if not exist "ui\package.json" (
    echo [错误] 未找到 ui 文件夹，请将 ui 文件夹放入训练包根目录。
    pause
    exit /b 1
)

:: ── 查找 SageAttention Python ──
set SA_PYTHON=
if exist ".\python-sageattention\python.exe" (
    set "SA_PYTHON=python-sageattention\python.exe"
) else if exist ".\python_sageattention\python.exe" (
    set "SA_PYTHON=python_sageattention\python.exe"
)

if "%SA_PYTHON%"=="" (
    echo.
    echo [错误] 未找到 SageAttention 专用 Python 运行时！
    echo.
    echo   期望以下目录之一存在：
    echo     .\python-sageattention\python.exe
    echo     .\python_sageattention\python.exe
    echo.
    echo   请先运行 run_For_SageAttention_Experimental.bat 完成环境安装，
    echo   之后再用本脚本启动。
    echo.
    pause
    exit /b 1
)

echo [√] SageAttention Python: %SA_PYTHON%

:: ══════════════════════════════════════════════
:: 第一步：补装 GUI 必须的依赖（首次启动时）
:: ══════════════════════════════════════════════
echo.
echo [1/4] 检查 GUI 服务依赖...

:: 检测 uvicorn 是否可用（它是最关键的 GUI 依赖）
"%SA_PYTHON%" -c "import uvicorn; assert hasattr(uvicorn,'run'); import cv2; assert hasattr(cv2,'IMREAD_UNCHANGED'); import pytz" >nul 2>&1
if %errorlevel% neq 0 (
    echo       GUI 依赖不完整，正在补装（仅首次需要，约 1~2 分钟）...
    echo.
    "%SA_PYTHON%" -m pip install uvicorn fastapi httpx toml requests rich psutil websockets pillow packaging pyyaml pandas scipy imagesize sentencepiece voluptuous safetensors huggingface-hub wandb pytz opencv-python==4.10.0.84 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [警告] 部分依赖安装可能失败，尝试继续启动...
    ) else (
        echo [√] GUI 依赖补装完成
    )
    echo.
) else (
    echo       [√] GUI 依赖已就绪
)

:: ══════════════════════════════════════════════
:: 第二步：启动后端
:: ══════════════════════════════════════════════
echo.
echo [2/4] 正在启动后端服务 (SageAttention 运行时)...

set "HF_HOME=huggingface"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
set "TRITON_LOG_LEVEL=error"
set "MIKAZUKI_SAGEATTENTION_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=sageattention"
set "MIKAZUKI_SKIP_REQUIREMENTS_VALIDATION=1"
set "CUDA_PATH="

:: 检查 gui.py
if not exist "gui.py" (
    echo [警告] 未找到 gui.py，将跳过后端启动。
    goto :start_frontend
)

:: 后台启动后端
start "LoRA-Backend-SageAttn" /min cmd /k ""%SA_PYTHON%" gui.py --port 28000 --skip-prepare-environment --dev"
echo [√] 后端已在后台启动
echo       等待后端初始化...

:: 轮询等待后端就绪（每 3 秒检测一次，最多 90 秒）
set /a WAIT_COUNT=0
:wait_loop
if %WAIT_COUNT% geq 30 (
    echo [警告] 等待超时 90 秒，后端可能仍在启动中。继续启动前端...
    goto :start_frontend
)
curl -s -o nul -w "" http://127.0.0.1:28000/api/graphic_cards >nul 2>&1
if %errorlevel% equ 0 (
    echo [√] 后端 API 已就绪 (http://127.0.0.1:28000)
    goto :start_frontend
)
set /a WAIT_COUNT+=1
echo       等待中... (%WAIT_COUNT%/30)
timeout /t 3 /nobreak >nul
goto :wait_loop

:: ══════════════════════════════════════════════
:: 第三步：检查 Node.js 并安装前端依赖
:: ══════════════════════════════════════════════
:start_frontend
echo.
echo [3/4] 正在检查前端环境...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 未检测到 Node.js，正在尝试自动安装...
    echo.

    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        echo 正在通过 winget 安装 Node.js LTS...
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        if %errorlevel% neq 0 (
            echo [错误] winget 安装 Node.js 失败。
            goto :manual_install
        )
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else (
        goto :manual_install
    )
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    goto :manual_install
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo       Node.js %NODE_VER%

:: 安装前端依赖
cd ui

if not exist "node_modules\vite" (
    echo.
    echo [安装] 正在安装前端依赖（首次启动需要，约 30 秒）...
    call npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo [错误] npm install 失败，请检查网络连接。
        pause
        exit /b 1
    )
    echo [√] 依赖安装完成
) else (
    echo [√] 依赖已就绪
)

:: ══════════════════════════════════════════════
:: 第四步：启动前端
:: ══════════════════════════════════════════════
echo.
echo [4/4] 正在启动前端...
echo.
echo ============================================
echo   运行时: SageAttention
echo   Python:  %SA_PYTHON%
echo   后端:    http://127.0.0.1:28000
echo   前端:    http://localhost:3006
echo.
echo   Close this window to stop frontend.
echo   Backend window needs to be closed separately.
echo ============================================
echo.

call npx vite --port 3006 --open

pause
exit /b 0

:: ── 手动安装提示 ──
:manual_install
echo.
echo ============================================
echo   需要安装 Node.js
echo ============================================
echo.
echo 请从以下地址下载并安装 Node.js LTS 版本：
echo   https://nodejs.org/
echo.
echo 安装完成后，重新运行此脚本即可。
echo.
pause
exit /b 1
