@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Corrigir Caminho DPAPI FS80

if not exist "scripts\biometria\FusionBiometriaFs80.cs" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0CORRIGIR-CAMINHO-DPAPI-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo CORRECAO_CAMINHO_DPAPI_FALHOU - codigo %RC%
pause
exit /b %RC%
