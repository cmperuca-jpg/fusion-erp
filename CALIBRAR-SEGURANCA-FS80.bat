@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Calibracao Segura FS80

if not exist "scripts\biometria\FusionBiometriaFs80.exe" (
  echo [ERRO] Extraia estes arquivos na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0CALIBRAR-SEGURANCA-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo CALIBRACAO_FS80_FALHOU - codigo %RC%
pause
exit /b %RC%
