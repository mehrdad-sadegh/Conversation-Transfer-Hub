@echo off
REM One-click builder for the official Windows installer.
REM Requires Node.js (LTS) from https://nodejs.org  (one-time install).
cd /d "%~dp0"
where npm >nul 2>nul || (
  echo.
  echo  Node.js is not installed.
  echo  Install the LTS version from https://nodejs.org , then run this file again.
  echo.
  pause
  exit /b 1
)
echo.
echo  [1/2] Installing dependencies (first run takes a few minutes)...
call npm install || (echo  npm install failed. & pause & exit /b 1)
echo.
echo  [2/2] Building the installer...
call npm run dist || (echo  build failed. & pause & exit /b 1)
echo.
echo  Done. Your installer is here:
echo    %~dp0dist\Conversation Transfer Hub Setup 0.1.0.exe
start "" "%~dp0dist"
pause
