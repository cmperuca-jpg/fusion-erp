@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Progresso Cadastro FS80

if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-PROGRESSO-CADASTRO-FS80.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo FS80_PROGRESSO_CADASTRO_FALHOU - codigo %RC%
pause
exit /b %RC%
