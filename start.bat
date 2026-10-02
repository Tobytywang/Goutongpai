@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   沟通牌计分平台 - 本地启动
echo   ============================================
node -v >nul 2>&1
if errorlevel 1 (
  echo   [错误] 没找到 node 命令。
  echo   请先安装 Node.js 22 或更高版本：https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo   Node 版本：%NODEVER%
echo   数据目录：%~dp0data
echo.
node server.js

echo.
echo   服务已停止。
pause
