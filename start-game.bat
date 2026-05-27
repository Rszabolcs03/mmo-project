@echo off
cd /d "%~dp0"
echo Starting the MMO demo and local Colyseus server...
echo.
echo Other players on your network can open:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"IPv4-cím"') do echo   http://%%a:5173
echo.
start "Colyseus MMO Server" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev:server"
npm.cmd run dev -- --host 0.0.0.0 --port 5173
pause
