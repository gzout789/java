@echo off
chcp 936 >nul
title 三国后端-重新打包
cd /d "%~dp0"
echo ============================================
echo   三国后端 - 重新编译打包（跳过测试）
echo ============================================
echo.

rem ---- 0. 若后端正在运行先停止（否则 clean 删不掉被占用的 jar）----
netstat -ano | findstr ":8081 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [提示] 先停止正在运行的后端...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do taskkill /f /pid %%p >nul 2>nul
    ping -n 3 127.0.0.1 >nul
)


set "MVN_CMD="
where mvn >nul 2>nul && set "MVN_CMD=mvn"
if not defined MVN_CMD for %%m in ("D:\IntelliJ IDEA 2024.3.2.2\plugins\maven\lib\maven3\bin\mvn.cmd") do if exist "%%~m" set "MVN_CMD=%%~m"
if not defined MVN_CMD if exist "%~dp0mvnw.cmd" set "MVN_CMD=%~dp0mvnw.cmd"
if not defined MVN_CMD (
    echo [错误] 未找到 Maven，请安装 Maven 或使用 IDEA 打开项目打包
    pause
    exit /b 1
)
echo [打包] 使用 Maven: %MVN_CMD%
call "%MVN_CMD%" -DskipTests clean package
if not exist "target\springBootTest-0.0.1-SNAPSHOT.jar" (
    echo.
    echo [错误] 打包失败，请查看上方日志
    pause
    exit /b 1
)
echo.
echo [成功] 已生成 target\springBootTest-0.0.1-SNAPSHOT.jar
echo 现在可运行「启动后端.bat」
echo.
pause
