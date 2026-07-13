@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo Fusion ERP - Biometria Estavel Homologada
echo ============================================

taskkill /F /IM FusionBiometriaSdk.exe >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'wscript.exe' -and $_.CommandLine -like '*FusionBiometriaWatchdog.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*FusionBiometriaLocal.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo Iniciando Fusion ERP com o SDK Futronic homologado...
npm start
