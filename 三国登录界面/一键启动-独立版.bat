@echo off
chcp 936 >nul
title 三国登录系统 - 一键启动（独立版）
echo ============================================
echo   三国登录系统  前端 5173 / 后端 8081
echo ============================================
echo.
cd /d "C:\Users\user\IdeaProjects\java\三国登录界面\springBootTest"
netstat -ano | findstr ":8081 " | findstr "LISTENING" >nul
if errorlevel 1 (
  start "三国后端-8081" "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\java.exe" -XX:TieredStopAtLevel=1 -Xms64m -Xmx256m -jar target\springBootTest-0.0.1-SNAPSHOT.jar --server.port=8081
) else (
  echo   [提示] 8081 已在运行，跳过后端启动
)
cd /d "C:\Users\user\IdeaProjects\java\三国登录界面\vue"
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if errorlevel 1 (
  start "三国前端-5173" "C:\Users\user\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" node_modules\vite\bin\vite.js
) else (
  echo   [提示] 5173 已在运行，跳过前端启动
)
echo   正在等待服务就绪 ...
set /a sg_n=0
:sg_wait
set /a sg_n+=1
if %sg_n% gtr 40 goto sg_open
curl -s -m 2 --noproxy "*" -o nul -w "%%{http_code}" http://localhost:5173/ > "%TEMP%\sg_fe_code.tmp" 2>nul
set "sg_code="
if exist "%TEMP%\sg_fe_code.tmp" set /p sg_code=<"%TEMP%\sg_fe_code.tmp"
if "%sg_code%"=="200" goto sg_open
ping -n 2 127.0.0.1 >nul
goto sg_wait
:sg_open
start "" "http://localhost:5173"
echo.
echo   [OK] 已启动  http://localhost:5173
echo   演示账号   云长 / danfeng123
echo   后台管理   admin / admin123
echo   停止服务   运行同目录 一键停止.bat
echo.
timeout /t 10 >nul
exit /b 0
