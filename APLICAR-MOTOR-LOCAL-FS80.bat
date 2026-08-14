@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Motor Local Offline FS80

if not exist "server.mjs" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-MOTOR-LOCAL-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo MOTOR_LOCAL_FS80_FALHOU - codigo %RC%
pause
exit /b %RC%
