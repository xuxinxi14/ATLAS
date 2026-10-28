@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.12 or newer and try again.
  pause
  exit /b 1
)
node --experimental-strip-types scripts\publish-notes.mjs
set "ATLAS_EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %ATLAS_EXIT_CODE%
