@echo off
chcp 936 >nul
setlocal EnableDelayedExpansion
title 三国登录系统-一键启动
cd /d "%~dp0"

echo ============================================
echo   三国登录系统 - 一键启动（前端 + 后端）
echo   前端: http://localhost:5173  后端: 8081
echo ============================================
echo.

rem ============================================================
rem  1. 环境自检
rem ============================================================
echo [1/4] 环境自检...

where java >nul 2>nul
if errorlevel 1 (
    echo   [错误] 未找到 java，请安装 JDK 并加入 PATH
    goto :fail
)
echo   [OK] Java 已就绪

set "NPM=npm"
where npm >nul 2>nul
if errorlevel 1 (
    set "NPM=C:\Users\user\.workbuddy\binaries\node\versions\22.22.2-3\node.exe C:\Users\user\.workbuddy\binaries\node\versions\22.22.2-3\node_modules\npm\bin\npm-cli.js"
)
if not exist "%~dp0vue\node_modules" (
    echo   [提示] 前端依赖未安装，首次安装约需 1-2 分钟...
    pushd "%~dp0vue"
    call %NPM% install --registry=https://registry.npmmirror.com
    popd
    if not exist "%~dp0vue\node_modules" (
        echo   [错误] 前端依赖安装失败，请检查网络
        goto :fail
    )
)
echo   [OK] 前端依赖已就绪
echo.

rem ============================================================
rem  2. 启动后端
rem ============================================================
echo [2/4] 启动后端...
call "%~dp0springBootTest\启动后端.bat" nopause
if errorlevel 1 (
    echo   [错误] 后端启动脚本报错，请单独运行 springBootTest\启动后端.bat 排查
    goto :fail
)

rem ---- 真实健康检查：调用登录接口，能返回 JSON 才算真的就绪 ----
rem      仅看端口监听是不够的（端口被占也会显示 LISTENING）
echo   正在验证后端接口...
set "HEALTH_JSON=%~dp0springBootTest\.health.tmp"
set /a htry=0
:healthloop
set /a htry+=1
if !htry! gtr 30 goto :healthfail
rem  注意 --noproxy：避免系统代理(HTTP_PROXY)把 localhost 请求也转发出去导致误判
curl -s -m 3 --noproxy "*" -X POST "http://localhost:8081/api/login" ^
     -H "Content-Type: application/json" ^
     -d "{\"username\":\"\u4e91\u957f\",\"password\":\"danfeng123\"}" > "!HEALTH_JSON!" 2>nul
findstr /c:"success" "!HEALTH_JSON!" >nul 2>nul
if not errorlevel 1 (
    del "!HEALTH_JSON!" >nul 2>nul
    echo   [OK] 后端接口正常（登录测试通过）
    goto :backendok
)
ping -n 2 127.0.0.1 >nul
goto :healthloop

:healthfail
echo.
echo   [错误] 后端端口已开，但接口 30 秒内未响应。
echo          请查看弹出的「三国后端-8081」窗口中的报错信息，
echo          常见原因：MySQL 未启动 / 数据库账号密码不符 / 端口被其他程序占用。
if exist "!HEALTH_JSON!" del "!HEALTH_JSON!" >nul 2>nul
goto :fail

:backendok
echo.

rem ============================================================
rem  3. 启动前端
rem ============================================================
echo [3/4] 启动前端...
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo   [提示] 5173 端口被占用，先停止旧的前端进程...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%p >nul 2>nul
    ping -n 2 127.0.0.1 >nul
)

pushd "%~dp0vue"
start "三国前端-5173" cmd /c "%NPM% run dev"
popd
echo   前端启动中，等待就绪...
set /a ftry=0
:frontloop
set /a ftry+=1
if !ftry! gtr 30 goto :frontfail
rem 用 HTTP 探测而不是只看端口：端口 LISTENING 不代表能响应
rem 必须用 localhost（Vite 默认只监听 IPv6 的 [::1]，直连 127.0.0.1 会失败）
set "FE_CODE_FILE=%~dp0vue\.fe_code.tmp"
rem 每次循环先删掉旧文件，避免读到上一轮的残留状态码
if exist "!FE_CODE_FILE!" del "!FE_CODE_FILE!" >nul 2>nul
curl -s -m 2 --noproxy "*" -o nul -w "%%{http_code}" "http://localhost:5173/" > "!FE_CODE_FILE!" 2>nul
set "FE_CODE="
if exist "!FE_CODE_FILE!" set /p FE_CODE=<"!FE_CODE_FILE!"
if "!FE_CODE!"=="200" (
    del "!FE_CODE_FILE!" >nul 2>nul
    goto :frontok
)
ping -n 2 127.0.0.1 >nul
goto :frontloop

:frontfail
echo.
echo   [错误] 前端 30 秒内未就绪，请查看「三国前端-5173」窗口中的报错。
echo          常见原因：node_modules 损坏（删掉后重装）/ 端口冲突 / 语法错误。
goto :fail

:frontok
echo   [OK] 前端已就绪
echo.

rem ============================================================
rem  4. 端到端验证（前端 → /api 代理 → 后端 → MySQL）
rem ============================================================
echo [4/4] 端到端验证...
set "E2E_JSON=%~dp0vue\.e2e.tmp"
set /a etry=0
:e2eloop
set /a etry+=1
if !etry! gtr 15 goto :e2efail
curl -s -m 5 --noproxy "*" -X POST "http://localhost:5173/api/login" ^
     -H "Content-Type: application/json" ^
     -d "{\"username\":\"\u4e91\u957f\",\"password\":\"danfeng123\"}" > "!E2E_JSON!" 2>nul
findstr /c:"点兵入帐成功" "!E2E_JSON!" >nul 2>nul
if not errorlevel 1 (
    del "!E2E_JSON!" >nul 2>nul
    goto :e2eok
)
findstr /c:"success" "!E2E_JSON!" >nul 2>nul
if not errorlevel 1 (
    del "!E2E_JSON!" >nul 2>nul
    echo   [OK] 代理链路正常（登录返回 success）
    goto :e2eok
)
ping -n 2 127.0.0.1 >nul
goto :e2eloop

:e2efail
echo   [警告] 前端到后端的 /api 代理暂时未通，页面可打开但登录可能失败。
echo          请检查 vue\vite.config.js 中的 proxy 是否指向 http://localhost:8081
if exist "!E2E_JSON!" del "!E2E_JSON!" >nul 2>nul
echo.
goto :success

:e2eok
echo   [OK] 前后端链路已打通
echo.

:success
echo ============================================
echo   全部启动完成，可以开始使用了
echo   ------------------------------------------
echo   登录页:   http://localhost:5173
echo   演示账号: 云长 / danfeng123 （登录页点「试看」自动填入）
echo   后端接口: http://localhost:8081
echo   ------------------------------------------
echo   停止服务: 运行同目录「一键停止.bat」
echo ============================================
echo.

rem 自动打开登录页
start "" "http://localhost:5173"
pause
exit /b 0

:fail
echo.
echo ============================================
echo   [启动失败] 请根据上方提示排查后重试
echo ============================================
echo.
pause
exit /b 1
