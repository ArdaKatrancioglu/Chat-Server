@echo off
title Chat Server - Suevical3D

echo Firing server...
start "" /b cmd /c "node server.js"
timeout /t 2 /nobreak

:: Start ngrok tunnel in a new window
echo Starting ngrok tunnel in a new window...
start "NGROK Tunnel" cmd /k "ngrok http 8080 --domain=crack-aware-stud.ngrok-free.app"

echo --------------------------------------------
echo Both Node.js server and Ngrok should be running.
pause