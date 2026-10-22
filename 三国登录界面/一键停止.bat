@echo off
chcp 936 >nul
title 三国登录系统-一键停止
echo 正在停止三国登录系统（前端 5173 + 后端 8081）...
echo.

echo [1/2] 停止前端 (5173)...
set found1=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo   结束进程 PID=%%p
    taskkill /f /pid %%p >nul 2>nul
    set found1=1
)
if "%found1%"=="0" echo   前端未在运行

echo [2/2] 停止后端 (8081)...
set found2=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do (
    echo   结束进程 PID=%%p
    taskkill /f /pid %%p >nul 2>nul
    set found2=1
)
if "%found2%"=="0" echo   后端未在运行

echo.
echo 全部停止完成。
echo.
pause
