@echo off
chcp 65001 >nul 2>&1
title LoRA ReScripts UI V2.1.0
echo ============================================
echo   LoRA ReScripts UI V2.1.0
echo ============================================
echo.

REM --- 查找训练包根目录 ---
cd /d "%~dp0"
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root

echo.
echo   [X] 找不到训练包根目录
echo.
echo       在当前目录及上级目录中均未找到 gui.py。
echo       请将此文件复制到训练包根目录后再运行。
echo.
pause
exit /b 1

:found_root
set "ROOT_DIR=%CD%"
echo   训练包根目录: %ROOT_DIR%

REM --- 查找新前端目录 ---
set "UI_DIR="
if exist "%ROOT_DIR%\ui\package.json" set "UI_DIR=%ROOT_DIR%\ui"
if not defined UI_DIR if exist "%ROOT_DIR%\plugin\lora-scripts-ui-main\ui\package.json" set "UI_DIR=%ROOT_DIR%\plugin\lora-scripts-ui-main\ui"
if defined UI_DIR goto ui_found

echo.
echo   [X] 未找到新前端文件
echo       ui/package.json 不存在，请确认 ui 目录完整。
echo.
pause
exit /b 1

:ui_found
echo   前端目录:     %UI_DIR%
echo.

REM --- 选择运行时 ---
echo [0/3] 选择运行时:
echo.
echo   1 - Default Python         RTX 40 and below
echo   2 - Blackwell              RTX 50 / PRO
echo   3 - FlashAttention 2       NVIDIA FA2
echo   4 - SageAttention          NVIDIA Sage
echo   5 - SageAttention 2        NVIDIA Sage 2.2
echo   6 - Intel XPU              Intel Arc / Xe
echo   7 - Intel XPU + Sage       Intel Arc + Sage
echo   8 - AMD ROCm               AMD RX 7000
echo   0 - Auto-detect            Default
echo.
echo   提示: 选择 2-8 前请确保已运行过对应的安装脚本
echo.
set "RC=0"
set /p "RC=请输入编号 (默认=0): "

set "LAUNCHER_SELECTION=auto"
if "%RC%"=="1" set "LAUNCHER_SELECTION=portable"
if "%RC%"=="2" set "LAUNCHER_SELECTION=blackwell"
if "%RC%"=="3" set "LAUNCHER_SELECTION=flashattention"
if "%RC%"=="4" set "LAUNCHER_SELECTION=sageattention"
if "%RC%"=="5" set "LAUNCHER_SELECTION=sageattention2"
if "%RC%"=="6" set "LAUNCHER_SELECTION=intel-xpu"
if "%RC%"=="7" set "LAUNCHER_SELECTION=intel-xpu-sage"
if "%RC%"=="8" set "LAUNCHER_SELECTION=rocm-amd"

if "%RC%"=="2" set "MIKAZUKI_PREFERRED_RUNTIME=blackwell"
if "%RC%"=="2" set "MIKAZUKI_BLACKWELL_STARTUP=1"
if "%RC%"=="3" set "MIKAZUKI_PREFERRED_RUNTIME=flashattention"
if "%RC%"=="3" set "MIKAZUKI_FLASHATTENTION_STARTUP=1"
if "%RC%"=="4" set "MIKAZUKI_PREFERRED_RUNTIME=sageattention"
if "%RC%"=="4" set "MIKAZUKI_SAGEATTENTION_STARTUP=1"
if "%RC%"=="5" set "MIKAZUKI_PREFERRED_RUNTIME=sageattention2"
if "%RC%"=="6" set "MIKAZUKI_PREFERRED_RUNTIME=intel-xpu"
if "%RC%"=="6" set "MIKAZUKI_INTEL_XPU_EXPERIMENTAL=1"
if "%RC%"=="6" set "MIKAZUKI_INTEL_XPU_STARTUP=1"
if "%RC%"=="6" set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"
if "%RC%"=="7" set "MIKAZUKI_PREFERRED_RUNTIME=intel-xpu-sage"
if "%RC%"=="7" set "MIKAZUKI_INTEL_XPU_EXPERIMENTAL=1"
if "%RC%"=="7" set "MIKAZUKI_INTEL_XPU_SAGE_EXPERIMENTAL=1"
if "%RC%"=="7" set "MIKAZUKI_INTEL_XPU_SAGE_STARTUP=1"
if "%RC%"=="7" set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"
if "%RC%"=="8" set "MIKAZUKI_PREFERRED_RUNTIME=rocm-amd"
if "%RC%"=="8" set "MIKAZUKI_AMD_EXPERIMENTAL=1"
if "%RC%"=="8" set "MIKAZUKI_ROCM_AMD_STARTUP=1"
if "%RC%"=="8" set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"

echo.
echo   已选择: %LAUNCHER_SELECTION%
echo.

REM --- 第一步：启动后端 ---
echo [1/3] 正在启动后端...
set "HF_HOME=huggingface"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

set "_T=%TEMP%\_lora_backend_%RANDOM%.ps1"
>  "%_T%" echo $ErrorActionPreference = 'Continue'
>> "%_T%" echo Set-Location '%ROOT_DIR%'
>> "%_T%" echo $Env:HF_HOME = 'huggingface'
>> "%_T%" echo $Env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'
>> "%_T%" echo try { ^& '%ROOT_DIR%\tools\runtime\launcher.ps1' -Mode Auto -Selection '%LAUNCHER_SELECTION%' -ForwardArgs '--port','28000','--dev' } catch { Write-Host -ForegroundColor Red "Backend error: $_" }
>> "%_T%" echo Write-Host ''
>> "%_T%" echo Write-Host 'Backend stopped / Press any key'
>> "%_T%" echo $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

start "LoRA-Backend" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%_T%"
echo   [OK] 后端正在启动: http://127.0.0.1:28000
echo   等待后端就绪（首次运行需安装依赖，请耐心等待）...
call :wait_backend

REM --- 第二步：检查 Node.js ---
echo.
echo [2/3] 检查 Node.js...
where node >nul 2>&1
if not errorlevel 1 goto node_ok

echo.
echo ============================================
echo   [X] 未找到 Node.js
echo ============================================
echo.
echo   新前端需要 Node.js 才能运行。
echo   请从 https://nodejs.org/ 下载 LTS 版本安装。
echo   安装完成后，关闭此窗口重新运行即可。
echo.
pause
exit /b 1

:node_ok
for /f "tokens=*" %%v in ('node -v 2^>nul') do echo   Node.js 版本: %%v

REM 进入前端目录
cd /d "%UI_DIR%"
if not errorlevel 1 goto cd_ok
echo   [X] 无法进入前端目录: %UI_DIR%
pause
exit /b 1

:cd_ok
if exist "node_modules\vite" goto deps_ok
echo   正在安装前端依赖（仅首次需要，请耐心等待）...
call npm install --registry=https://registry.npmmirror.com
if not errorlevel 1 goto deps_ok
echo   [X] npm install 失败，请检查网络连接后重试。
pause
exit /b 1

:deps_ok
echo   [OK] 前端依赖已就绪。

REM --- 第三步：启动新前端 ---
echo.
echo [3/3] 正在启动新前端...
echo.
echo   运行时:   %LAUNCHER_SELECTION%
echo   后端地址: http://127.0.0.1:28000
echo   前端地址: http://localhost:3006
echo.
echo   浏览器将自动打开。
echo   关闭此窗口即可停止前端服务。
echo.
call npx vite --port 3006 --open
pause
exit /b 0

REM --- 子程序：等待后端就绪 ---
:wait_backend
set "_W=0"
:wait_loop
if %_W% GEQ 30 goto wait_timeout
timeout /t 3 /nobreak >nul
curl -s -o nul http://127.0.0.1:28000/ >nul 2>&1
if not errorlevel 1 goto wait_ok
set /a _W+=1
echo     ...等待中 %_W%/30
goto wait_loop
:wait_ok
echo   [OK] 后端已就绪。
goto :eof
:wait_timeout
echo.
echo   [!] 后端可能尚未就绪。
echo       请查看最小化的后端窗口确认是否有错误。
echo       按任意键继续启动前端...
pause >nul
goto :eof
