@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fusion ERP - Reparo Access Agent

net session >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0REPARAR-FUSION-ACCESS.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo REPARO_FUSION_ACCESS_FALHOU - codigo %RC%
)
pause
exit /b %RC%
