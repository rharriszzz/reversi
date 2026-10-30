@echo off
setlocal
cd /d "%~dp0"
if defined REVERSI_PYTHON (
    "%REVERSI_PYTHON%" launch.py %*
    goto :end
)
if defined VIRTUAL_ENV (
    "%VIRTUAL_ENV%\Scripts\python.exe" launch.py %*
    goto :end
)
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" launch.py %*
    goto :end
)
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 launch.py %*
    goto :end
)
where python >nul 2>&1
if %errorlevel%==0 (
    python launch.py %*
    goto :end
)
echo Python 3.13+ is not installed or not on PATH.
echo Install Python 3.13 or newer, then double-click this file again.
pause
:end
endlocal
