@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未找到 Node.js，请先安装 Node.js 18 或更高版本：
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo 正在打包单文件版本...
node build-standalone.js
if errorlevel 1 (
  echo.
  echo 打包失败，请把上面的错误信息发给我。
  pause
  exit /b 1
)

echo.
echo 完成！请在文件夹中找到 standalone.html，
echo 把这一个文件发给别人，或单独上传到静态托管即可。
echo.
pause
