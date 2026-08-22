@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-SpatialHardwareInspector.ps1" %*
exit /b %errorlevel%
