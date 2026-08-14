@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Caixa obrigatorio para recebimentos
if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)
node "%~dp0APLICAR-CAIXA-OBRIGATORIO-RECEBIMENTOS.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo CAIXA_OBRIGATORIO_RECEBIMENTOS_FALHOU - codigo %RC%
pause
exit /b %RC%
