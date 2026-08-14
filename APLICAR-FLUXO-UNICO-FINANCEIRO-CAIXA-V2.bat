@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Fluxo unico Financeiro Caixa V2

if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-FLUXO-UNICO-FINANCEIRO-CAIXA-V2.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo FINANCEIRO_FLUXO_UNICO_CAIXA_V2_FALHOU - codigo %RC%
pause
exit /b %RC%
