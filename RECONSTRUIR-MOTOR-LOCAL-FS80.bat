@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Reconstruir Motor Local FS80

if not exist ".git" (
  echo [ERRO] Extraia estes arquivos na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0RECONSTRUIR-MOTOR-LOCAL-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo MOTOR_LOCAL_FS80_RECONSTRUCAO_FALHOU - codigo %RC%
pause
exit /b %RC%
