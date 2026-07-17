@echo off
chcp 65001 >nul
title Fusion Access - Status
set "BASE=%ProgramData%\FusionERP\AccessAgent\"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$base=Join-Path $env:ProgramData 'FusionERP\AccessAgent';$installed=Test-Path (Join-Path $base 'FusionAccessSupervisor.ps1');$online=$false;try{$r=Invoke-RestMethod 'http://127.0.0.1:8765/status' -TimeoutSec 2;$online=[bool]$r.ok}catch{};if(-not $installed){Write-Host 'Fusion Access nao esta instalado.' -ForegroundColor Red}elseif($online){Write-Host 'Estado automatico: Running' -ForegroundColor Green}else{Write-Host 'Fusion Access instalado, mas o terminal local nao respondeu.' -ForegroundColor Yellow};foreach($name in @('supervisor.log','agent.log','facial.log','offline-release.log')){$p=Join-Path (Join-Path $base 'logs') $name;if(Test-Path $p){Write-Host '';Write-Host ('--- '+$name+' ---');Get-Content $p -Tail 12}}"
echo.
echo --- Terminal offline ---
set "PAIR=aguardando"
if exist "%BASE%data\pair-code.txt" set /p PAIR=<"%BASE%data\pair-code.txt"
echo Porta local: 8765
echo Codigo de pareamento: %PAIR%
powershell.exe -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'WSL|vEthernet|Docker'} ^| ForEach-Object {Write-Host ('IP local: '+$_.IPAddress)}"
pause
