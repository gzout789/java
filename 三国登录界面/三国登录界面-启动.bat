@echo off
setlocal
cd /d "C:\Users\Administrator\Desktop\三国登录界面"

set "NPM=npm"
where npm >nul 2>nul
if errorlevel 1 (
  set "NPM=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node.exe C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node_modules\npm\bin\npm-cli.js"
)

if not exist "node_modules" (
  echo First run: installing dependencies, please wait...
  %NPM% install
  if errorlevel 1 (
    echo Failed to install dependencies. Check network or Node, then retry.
    pause
    exit /b 1
  )
)

echo Starting Sanguo Login dev server...
echo Browser will open http://localhost:5173/ automatically.
echo Close this window to stop the server.
%NPM% run dev
