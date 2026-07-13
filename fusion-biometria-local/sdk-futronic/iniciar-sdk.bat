@echo off
setlocal
cd /d "%~dp0"

if not exist "FusionBiometriaSdk.exe" (
  call "compilar-x86.bat"
  if errorlevel 1 exit /b 1
)

start "" /min "%~dp0FusionBiometriaSdk.exe"
exit /b 0
