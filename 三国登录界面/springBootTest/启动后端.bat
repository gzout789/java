@echo off
chcp 936 >nul
title 三国后端-启动
cd /d "%~dp0"
echo ============================================
echo   三国登录系统 - 后端启动脚本 (端口 8081)
echo ============================================
echo.

rem ---- 1. 检查 Java ----
where java >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 java 命令，请确认 JDK 已安装并加入 PATH
    pause
    exit /b 1
)

rem ---- 2. 检查 MySQL (3306 端口) ----
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [提示] MySQL 未运行，尝试启动服务 MySQL80 ...
    net start MySQL80 >nul 2>nul
    ping -n 4 127.0.0.1 >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
    if errorlevel 1 (
        echo [错误] MySQL 仍未运行！请手动启动 MySQL 服务（服务名通常为 MySQL80）
        pause
        exit /b 1
    )
)
echo [OK] MySQL 正常
echo.

rem ---- 3. 若 8081 已被占用则先停掉旧进程 ----
netstat -ano | findstr ":8081 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [提示] 8081 端口被占用，先停止旧的后端进程...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do taskkill /f /pid %%p >nul 2>nul
    ping -n 2 127.0.0.1 >nul
)

rem ---- 4. 若无 jar 则自动编译打包 ----
rem     注意：用 goto 结构，不能把 set 和 %%MVN_CMD%% 放进同一个括号块（延迟展开问题）
if exist "target\springBootTest-0.0.1-SNAPSHOT.jar" goto runjar
echo [提示] 未发现 jar 包，先编译打包（约 1-3 分钟）...
set "MVN_CMD=C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\plugins\maven-plugin\lib\maven3\bin\mvn.cmd"
if not exist "%MVN_CMD%" set "MVN_CMD=C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\plugins\maven-plugin\lib\maven3\bin\mvn.cmd"
if exist "%MVN_CMD%" (
    call "%MVN_CMD%" -q -DskipTests package
) else (
    call mvnw.cmd -q -DskipTests package
)
if not exist "target\springBootTest-0.0.1-SNAPSHOT.jar" (
    echo [错误] 打包失败，请查看上方 Maven 日志
    pause
    exit /b 1
)
echo [OK] jar 打包完成
echo.

:runjar
rem ---- 5. 启动后端（带快速启动 JVM 参数）----
echo [启动] 正在启动后端，数据库/表/演示账号会自动初始化...
start "三国后端-8081" java -XX:TieredStopAtLevel=1 -Xms64m -Xmx256m -jar target\springBootTest-0.0.1-SNAPSHOT.jar --server.port=8081

rem ---- 6. 等待端口就绪（最多 40 秒）----
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 40 goto ready
netstat -ano | findstr ":8081 " | findstr "LISTENING" >nul
if not errorlevel 1 goto ready
ping -n 2 127.0.0.1 >nul
goto waitloop
:ready
echo.
echo [就绪] 后端已启动：http://localhost:8081
echo        演示账号：云长 / danfeng123
echo.
echo 关闭弹出的「三国后端-8081」窗口即可停止后端，
echo 或运行同目录下的「停止后端.bat」。
echo.
if /i not "%1"=="nopause" pause
exit /b 0
