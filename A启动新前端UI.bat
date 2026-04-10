@echo off
title LoRA ReScripts UI V2.1.0
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================
echo   LoRA ReScripts UI V2.1.0 (新前端)
echo ============================================
echo.

:: ============================
:: 基础检查
:: ============================
set "UI_DIR=%CD%\ui"

if not exist "gui.py" (
    echo [X] 未找到 gui.py，请将此 bat 放在仓库根目录下运行。
    pause
    exit /b 1
)
if not exist "%UI_DIR%\package.json" (
    echo [X] 未找到新前端目录: %UI_DIR%
    echo     请确认 ui 文件夹存在于根目录中。
    pause
    exit /b 1
)

:: ============================
:: 选择运行时
:: ============================
echo [0/3] 选择运行时:
echo.
echo   [1] 默认 Python
echo   [2] FlashAttention 2 (NVIDIA)
echo   [3] SageAttention (NVIDIA)
echo   [4] Intel XPU
echo   [5] Intel XPU + Sage
echo   [6] AMD ROCm
echo   [7] AMD ROCm + Sage
echo   [0] 自动检测 (默认)
echo.
set "RC=0"
set /p "RC=请输入编号 (默认=0): "

:: 将用户选择映射为 launcher.ps1 能识别的 selection 参数
set "LAUNCHER_SELECTION="
if "!RC!"=="1" set "LAUNCHER_SELECTION=portable"
if "!RC!"=="2" set "LAUNCHER_SELECTION=flashattention"
if "!RC!"=="3" set "LAUNCHER_SELECTION=sageattention"
if "!RC!"=="4" set "LAUNCHER_SELECTION=intel-xpu"
if "!RC!"=="5" set "LAUNCHER_SELECTION=intel-xpu-sage"
if "!RC!"=="6" set "LAUNCHER_SELECTION=rocm-amd"
if "!RC!"=="7" set "LAUNCHER_SELECTION=rocm-amd-sage"
if not defined LAUNCHER_SELECTION set "LAUNCHER_SELECTION=auto"

echo.
echo   已选择: !LAUNCHER_SELECTION!
echo.

:: ============================
:: 第一步：启动后端
:: 通过项目自带的 PowerShell 启动框架 (launcher.ps1) 启动后端
:: 该框架会自动处理:
::   - Python 运行时查找和验证
::   - pip 初始化 (setup_embeddable_python.bat)
::   - 依赖安装 (requirements.txt)
::   - 环境变量配置
:: ============================
echo [1/3] 正在启动后端 (通过项目启动框架)...
set "HF_HOME=huggingface"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

:: 生成临时 PowerShell 脚本，用于在最小化窗口中运行后端
set "_WORKDIR=!CD!"
set "_T=%TEMP%\_lora_backend.ps1"
(
    echo $ErrorActionPreference = 'Continue'
    echo Set-Location '!_WORKDIR!'
    echo $Env:HF_HOME = 'huggingface'
    echo $Env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'
    echo try {
    echo     ^& '!_WORKDIR!\tools\runtime\launcher.ps1' -Mode Auto -Selection '!LAUNCHER_SELECTION!' -ForwardArgs '--port','28000','--dev'
    echo } catch {
    echo     Write-Host -ForegroundColor Red "Backend error: $_"
    echo }
    echo Write-Host ''
    echo Write-Host '[Backend stopped / Press any key to close]'
    echo $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'^)
) > "!_T!"

:: 在最小化的新窗口中启动后端
start "LoRA-Backend" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "!_T!"
echo [OK] 后端正在启动: http://127.0.0.1:28000

:: 等待后端就绪（首次启动需要安装依赖，可能需要较长时间）
echo 正在等待后端启动（首次运行可能需要安装依赖，请耐心等待）...
set "_READY=0"
for /L %%i in (1,1,30) do (
    if "!_READY!"=="0" (
        timeout /t 3 /nobreak >nul
        curl -s -o nul -w "" http://127.0.0.1:28000/ >nul 2>&1
        if !errorlevel! equ 0 (
            set "_READY=1"
            echo [OK] 后端已就绪。
        ) else (
            echo   ...仍在等待 %%i/30
        )
    )
)
if "!_READY!"=="0" (
    echo.
    echo [!] 后端可能尚未就绪。
    echo     请查看最小化的 LoRA-Backend 窗口确认是否有错误。
    echo     按任意键继续启动前端...
    pause >nul
)

:: ============================
:: 第二步：检查前端环境
:: 新前端基于 Vite + 原生 JS，需要 Node.js
:: ============================
echo.
echo [2/3] 检查 Node.js...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [X] 未找到 Node.js，请先安装: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set "NV=%%i"
echo   Node.js 版本: !NV!

:: 切换到新前端目录，安装依赖
cd /d "!UI_DIR!"
if not exist "node_modules\vite" (
    echo 正在安装前端依赖...
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [X] npm install 失败。
        pause
        exit /b 1
    )
)
echo [OK] 前端依赖已就绪。

:: ============================
:: 第三步：启动新前端
:: Vite 开发服务器会自动代理 /api 请求到后端 (127.0.0.1:28000)
:: ============================
echo.
echo [3/3] 正在启动新前端...
echo.
echo   运行时  : !LAUNCHER_SELECTION!
echo   后端地址: http://127.0.0.1:28000
echo   前端地址: http://localhost:3006
echo.
echo   浏览器将自动打开。
echo   关闭此窗口即可停止前端服务。
echo.
call npx vite --port 3006 --open
pause
exit /b 0
