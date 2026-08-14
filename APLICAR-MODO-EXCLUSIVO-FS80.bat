@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - FS80 Modo Exclusivo

if not exist "scripts\fusion-biometria-sidecar.mjs" (
  echo [ERRO] Extraia estes arquivos na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-MODO-EXCLUSIVO-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo FS80_MODO_EXCLUSIVO_FALHOU - codigo %RC%
pause
exit /b %RC%
