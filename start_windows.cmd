@echo off
setlocal
cd /d "%~dp0"
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
echo Python 3 is not installed or not on PATH.
echo Install Python 3, then double-click this file again.
pause
:end
endlocal
