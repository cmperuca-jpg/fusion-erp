@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Acesso Frequencia Contraste

if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-ACESSO-FREQUENCIA-CONTRASTE.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo ACESSO_FREQUENCIA_CONTRASTE_FALHOU - codigo %RC%
pause
exit /b %RC%
