@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion Aluno - Contador Biometria V2

if not exist ".git" (
  echo [ERRO] Extraia este ZIP diretamente na raiz do fusion-erp.
  pause
  exit /b 2
)

node "%~dp0APLICAR-CONTADOR-BIOMETRIA-ALUNO-V2.mjs"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo FUSION_ALUNO_BIOMETRIA_CONTADOR_V2_FALHOU - codigo %RC%
pause
exit /b %RC%
