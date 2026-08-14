@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Vinculo Mensalidade Financeiro
if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)
node "%~dp0APLICAR-VINCULO-MENSALIDADE-FINANCEIRO.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo VINCULO_MENSALIDADE_FINANCEIRO_FALHOU - codigo %RC%
pause
exit /b %RC%
