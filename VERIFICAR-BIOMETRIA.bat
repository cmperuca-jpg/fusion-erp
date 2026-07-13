@echo off
curl http://127.0.0.1:3041/status
echo.
curl http://127.0.0.1:3000/api/biometria/motor/status
echo.
pause
