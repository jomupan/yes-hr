@echo off
setlocal
title YES HR - Starter
rem Always work from the folder this file is in (the project folder).
cd /d "%~dp0"

echo.
echo   YES HR - starting the app
echo   =========================
echo.

rem ---- First run only: install packages ----
if not exist "backend\node_modules" (
  echo   First run: installing server packages...
  pushd backend
  call npm install
  popd
)
if not exist "node_modules" (
  echo   First run: installing website packages...
  call npm install
)

rem ---- Build the website (only needed after code changes) ----
set REBUILD=N
if not exist "dist\index.html" set REBUILD=Y
if "%REBUILD%"=="N" (
  choice /c YN /n /t 8 /d N /m "  Rebuild the website first? Only needed after code changes. [Y/N, auto N in 8s] "
  if errorlevel 2 (set REBUILD=N) else (set REBUILD=Y)
)
if "%REBUILD%"=="Y" (
  echo   Building the website, this takes about a minute...
  call npm run build
  if errorlevel 1 (
    echo.
    echo   The website build failed. Scroll up to see the error.
    pause
    exit /b 1
  )
)

rem ---- Start the server (skipped if it's already running) ----
curl.exe -s http://localhost:4000/api/health >nul 2>&1
if errorlevel 1 (
  start "YES HR - Server (keep this open)" /d "%~dp0backend" cmd /k npm run dev
) else (
  echo   The server is already running.
)

echo   Waiting for the server to start...
set /a TRIES=0
:waitserver
timeout /t 2 /nobreak >nul
curl.exe -s http://localhost:4000/api/health >nul 2>&1
if not errorlevel 1 goto serverup
set /a TRIES+=1
if %TRIES% geq 60 (
  echo.
  echo   The server didn't start. Check the "YES HR - Server" window for a red error.
  pause
  exit /b 1
)
goto waitserver
:serverup
echo   Server is running at http://localhost:4000
echo.

rem ---- Start the phone link (Cloudflare quick tunnel) ----
if exist "tunnel.log" del "tunnel.log"
start "YES HR - Phone link (keep this open)" /d "%~dp0" cmd /k npx --yes cloudflared@0.7.3 tunnel --url http://localhost:4000 --logfile tunnel.log

echo   Creating the phone link (can take up to a minute)...
set "URL="
set /a TRIES=0
:waiturl
timeout /t 2 /nobreak >nul
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "if (Test-Path 'tunnel.log') { $m = Select-String -Path 'tunnel.log' -Pattern 'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com' -List; if ($m) { $m.Matches[0].Value } }"`) do set "URL=%%U"
if defined URL goto goturl
set /a TRIES+=1
if %TRIES% geq 60 (
  echo.
  echo   Couldn't get the phone link. Check the "YES HR - Phone link" window for errors.
  echo   The app still works on this laptop at http://localhost:4000
  pause
  exit /b 1
)
goto waiturl

:goturl
echo %URL%| clip
echo.
echo   ==============================================================
echo    Phone link (also copied to your clipboard):
echo.
echo      %URL%
echo.
echo    On this laptop:  http://localhost:4000
echo   ==============================================================
echo.
echo   Scan this with your phone camera to open the app:
echo.
echo %URL%| npx --yes qrcode-terminal@0.12.0
echo.
echo   The link can take up to a minute to start working on phones.
echo   The link is new each time, so re-add the app to the home screen if needed.
echo.
echo   To stop the app: close the "Server" and "Phone link" windows.
echo.
pause
