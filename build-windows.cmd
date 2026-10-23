@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 22.12 or newer first.
  echo         https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo.
echo Building Luogu VP for Windows: installer + portable...
echo.

node scripts\build-windows.mjs --open %*
set "CODE=%ERRORLEVEL%"

echo.
if not "%CODE%"=="0" (
  echo [ERROR] Build failed. Check the log above.
) else (
  echo [OK] Build finished. The release folder should be open.
)
echo.
pause
exit /b %CODE%
