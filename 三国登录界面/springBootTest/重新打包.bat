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

set "JAVA_HOME=C:\Program Files\Zulu\zulu-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"

rem ---- 优先使用 D 盘持久化 Maven，其次 IDEA 内置，最后项目自带 mvnw ----
set "MVN_CMD=C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\plugins\maven-plugin\lib\maven3\bin\mvn.cmd"
if not exist "%MVN_CMD%" set "MVN_CMD=C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\plugins\maven-plugin\lib\maven3\bin\mvn.cmd"
if not exist "%MVN_CMD%" set "MVN_CMD=%~dp0mvnw.cmd"

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
