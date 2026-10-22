@echo off
chcp 936 >nul
title 三国后端-停止
echo 正在停止三国后端 (端口 8081) ...
set found=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do (
    echo   结束进程 PID=%%p
    taskkill /f /pid %%p >nul 2>nul
    set found=1
)
if "%found%"=="0" (
    echo 后端当前未在运行。
) else (
    echo 后端已停止。
)
echo.
pause
