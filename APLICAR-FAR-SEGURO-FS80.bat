@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - FS80 FAR Seguro

if not exist "scripts\biometria\FusionBiometriaFs80.cs" (
  echo [ERRO] Extraia os arquivos na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-FAR-SEGURO-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo FS80_FAR_SEGURO_FALHOU - codigo %RC%
pause
exit /b %RC%
