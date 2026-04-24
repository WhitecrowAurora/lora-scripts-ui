@echo off
chcp 65001 >nul 2>&1
title SD-reScripts Launcher

REM --- Find project root (where gui.py lives) ---
cd /d "%~dp0"
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root
cd ..
if exist "%CD%\gui.py" goto found_root

echo.
echo   [X] Cannot find project root (gui.py not found)
echo       Please place this file in the training toolkit root directory.
echo.
pause
exit /b 1

:found_root
set "ROOT_DIR=%CD%"

REM --- Find Python (prefer system Python with tkinter) ---
set "PY="
where python >nul 2>&1
if errorlevel 1 goto try_portable_py
python -c "import tkinter" >nul 2>&1
if errorlevel 1 goto try_portable_py
set "PY=python"
goto py_found

:try_portable_py
if not exist "%ROOT_DIR%\python\python.exe" goto no_python
"%ROOT_DIR%\python\python.exe" -c "import tkinter" >nul 2>&1
if errorlevel 1 goto no_python
set "PY=%ROOT_DIR%\python\python.exe"
goto py_found

:no_python
echo.
echo   [X] Python with tkinter not found
echo       The launcher requires tkinter (included in standard Python installs).
echo       Please install Python from https://python.org (not embedded/portable).
echo.
pause
exit /b 1

:py_found

REM --- Find launcher directory ---
set "LAUNCHER_DIR="
if exist "%ROOT_DIR%\launcher\main.py" set "LAUNCHER_DIR=%ROOT_DIR%\launcher"
if defined LAUNCHER_DIR goto launcher_found
if exist "%ROOT_DIR%\plugin\lora-scripts-ui-main\launcher\main.py" set "LAUNCHER_DIR=%ROOT_DIR%\plugin\lora-scripts-ui-main\launcher"
if defined LAUNCHER_DIR goto launcher_found

echo.
echo   [X] Launcher not found
echo       Searched: launcher\main.py
echo                plugin\lora-scripts-ui-main\launcher\main.py
echo.
pause
exit /b 1

:launcher_found

REM --- Install customtkinter if missing ---
"%PY%" -c "import customtkinter" >nul 2>&1
if not errorlevel 1 goto deps_ok
echo.
echo   Installing launcher dependencies...
echo.
"%PY%" -m pip install "customtkinter>=5.2.0" --quiet --disable-pip-version-check
if errorlevel 1 goto deps_fail
echo   [OK] Dependencies installed.
echo.
goto deps_ok

:deps_fail
echo.
echo   [X] Failed to install customtkinter.
echo       Please check your network connection and try again.
echo.
pause
exit /b 1

:deps_ok

REM --- Launch the GUI launcher ---
cd /d "%ROOT_DIR%"
"%PY%" "%LAUNCHER_DIR%\main.py"
if errorlevel 1 (
    echo.
    echo   Launcher exited with an error.
    echo.
    pause
)
