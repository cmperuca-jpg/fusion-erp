@echo off
setlocal EnableExtensions
title Fusion ERP - Reconectar Access Agent e Biometria

:: Auto-elevar
net session >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================================
echo FUSION ERP - RECONECTAR CATRACA + BIOMETRIA
echo ============================================================
echo.

echo [1/5] Encerrando somente os componentes Fusion locais...
schtasks /End /TN "Fusion Biometria FS80" >nul 2>&1
schtasks /End /TN "Fusion Access Agent" >nul 2>&1

powershell.exe -NoProfile -Command ^
  "$ps=Get-CimInstance Win32_Process -Filter ""Name='powershell.exe' OR Name='pwsh.exe'"" | Where-Object { $_.CommandLine -like '*C:\ProgramData\FusionERP\AccessAgent\*' }; foreach($p in $ps){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1

powershell.exe -NoProfile -Command ^
  "$ns=Get-CimInstance Win32_Process -Filter ""Name='node.exe'"" | Where-Object { $_.CommandLine -like '*fusion-biometria-sidecar.mjs*' }; foreach($p in $ns){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1

timeout /t 2 /nobreak >nul

echo [2/5] Iniciando Fusion Access Agent...
schtasks /Run /TN "Fusion Access Agent"
if errorlevel 1 goto :erro_agent

timeout /t 5 /nobreak >nul

echo [3/5] Iniciando biometria FS80...
schtasks /Run /TN "Fusion Biometria FS80"
if errorlevel 1 goto :erro_bio

timeout /t 7 /nobreak >nul

echo [4/5] Conferindo tarefas...
schtasks /Query /TN "Fusion Access Agent" /FO LIST | findstr /I "Status Estado"
schtasks /Query /TN "Fusion Biometria FS80" /FO LIST | findstr /I "Status Estado"

echo.
echo [5/5] Conferindo sidecar FS80...
powershell.exe -NoProfile -Command ^
  "$p=Get-CimInstance Win32_Process -Filter ""Name='node.exe'"" | Where-Object { $_.CommandLine -like '*fusion-biometria-sidecar.mjs*' }; if($p){ Write-Host '[OK] Biometria FS80 ativa.' } else { Write-Host '[AVISO] Sidecar FS80 ainda nao apareceu.' }"

echo.
echo ============================================================
echo RECONECTAR_FUSION_OK
echo Aguarde 10 segundos e atualize a pagina do Fusion.
echo Depois clique em TESTAR LEITOR.
echo ============================================================
pause
exit /b 0

:erro_agent
echo.
echo [ERRO] Nao foi possivel iniciar "Fusion Access Agent".
pause
exit /b 10

:erro_bio
echo.
echo [ERRO] Nao foi possivel iniciar "Fusion Biometria FS80".
pause
exit /b 11
