@echo off
cd /d "%~dp0"
echo Starting the MMO demo and local Colyseus server...
echo.
start "Colyseus MMO Server" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev:server"
npm.cmd run dev -- --host 127.0.0.1 --port 5173
pause
