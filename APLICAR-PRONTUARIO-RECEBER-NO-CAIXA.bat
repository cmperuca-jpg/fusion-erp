@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Prontuario Receber no Caixa

if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-PRONTUARIO-RECEBER-NO-CAIXA.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo PRONTUARIO_RECEBER_NO_CAIXA_FALHOU - codigo %RC%
pause
exit /b %RC%
