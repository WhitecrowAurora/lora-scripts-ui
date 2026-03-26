@echo off
chcp 65001 >nul 2>&1
title LoRA ReScripts UI V2.0.0

echo ============================================
echo   LoRA ReScripts UI V2.0.0 一键启动脚本
echo   同时启动后端 (28000) + 前端 (3006)
echo ============================================
echo.

cd /d "%~dp0"

:: ── 检查 ui 文件夹 ──
if not exist "ui\package.json" (
    echo [错误] 未找到 ui 文件夹，请将 ui 文件夹放入训练包根目录。
    echo.
    echo 正确的目录结构：
    echo   lora-scripts\
    echo     ui\
    echo       package.json
    echo       src\
    echo     train\
    echo     sd-models\
    echo     gui.py
    echo     启动前端UI.bat   ← 你现在运行的这个
    echo.
    pause
    exit /b 1
)

:: ══════════════════════════════════════════════
:: 第一步：启动后端 (Python / Mikazuki)
:: ══════════════════════════════════════════════
echo [1/3] 正在启动后端服务...

set HF_HOME=huggingface
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
set CUDA_PATH=
set PYTHON=python

if exist ".\python\python.exe" (
    set PYTHON=python\python.exe
    echo       使用训练包内置 Python
) else (
    echo       使用系统 Python
)

:: 检查 gui.py 是否存在
if not exist "gui.py" (
    echo [警告] 未找到 gui.py，将跳过后端启动。
    echo       前端仍可启动，但训练/预检等功能不可用。
    goto :start_frontend
)

:: 在后台启动后端（不阻塞当前窗口）
:: --dev 阻止秋叶原版前端自动打开浏览器，仅保留 API 服务
start "LoRA-Backend" /min cmd /c ""%PYTHON%" gui.py --port 28000 --dev"
echo [✓] 后端 API 已在后台启动 (http://127.0.0.1:28000)
echo       等待 3 秒让后端初始化...
timeout /t 3 /nobreak >nul

:: ══════════════════════════════════════════════
:: 第二步：检查 Node.js 并安装前端依赖
:: ══════════════════════════════════════════════
:start_frontend
echo.
echo [2/3] 正在检查前端环境...

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
        echo.
        echo Node.js 安装完成，正在继续...
        echo.
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
        echo.
        echo [错误] npm install 失败，请检查网络连接。
        pause
        exit /b 1
    )
    echo [✓] 依赖安装完成
) else (
    echo [✓] 依赖已就绪
)

:: ══════════════════════════════════════════════
:: 第三步：启动前端
:: ══════════════════════════════════════════════
echo.
echo [3/3] 正在启动前端...
echo.
echo ============================================
echo   后端: http://127.0.0.1:28000
echo   前端: http://localhost:3006
echo.
echo   关闭此窗口将同时停止前端。
echo   后端窗口需要单独关闭（最小化在任务栏）。
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
