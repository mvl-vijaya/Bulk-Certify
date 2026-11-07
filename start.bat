@echo off
setlocal
title Bulk Certify Server

:: Add local Node.js to PATH if present
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

echo ==================================================
echo   Starting Bulk Certify Application...
echo ==================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH or %LOCALAPPDATA%\Programs\nodejs.
    echo Please install Node.js or restart your terminal.
    pause
    exit /b 1
)

:: Run Express Server
if "%1"=="dev" (
    call npm run dev
) else (
    call npm start
)

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] If port 3000 was busy, please check if another instance is already running.
    pause
)

