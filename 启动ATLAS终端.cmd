@echo off
chcp 65001 >nul
title ATLAS · Personal Knowledge Terminal
cd /d "%~dp0"
echo ========================================================
echo   ATLAS · PERSONAL KNOWLEDGE TERMINAL (Local WebUI)
echo ========================================================
echo.
echo [1/2] 正在编译本地 Markdown 知识库与搜索索引...
call npm run build:content
if errorlevel 1 (
  echo.
  echo [!] Markdown 内容校验未通过，请检查上方错误提示。
  pause
  exit /b 1
)
echo.
echo [2/2] 正在启动本地知识终端服务器 (默认进入 3D 档案大厅 http://127.0.0.1:5173/)...
start "" "http://127.0.0.1:5173/"
call npm run dev
