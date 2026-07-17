@echo off
title Fusion Access - Status
set "BASE=%ProgramData%\FusionERP\AccessAgent\"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-ScheduledTask -TaskName 'Fusion Access Agent' -ErrorAction SilentlyContinue;if(-not $t){Write-Host 'Fusion Access nao esta instalado.' -ForegroundColor Red;exit};Write-Host ('Estado automatico: '+$t.State) -ForegroundColor Cyan;$base=Join-Path $env:ProgramData 'FusionERP\AccessAgent';foreach($name in @('supervisor.log','agent.log','facial.log','offline-release.log')){$p=Join-Path (Join-Path $base 'logs') $name;if(Test-Path $p){Write-Host '';Write-Host ('--- '+$name+' ---');Get-Content $p -Tail 12}}"
echo.
echo --- Terminal offline ---
set "PAIR=aguardando"
if exist "%BASE%data\pair-code.txt" set /p PAIR=<"%BASE%data\pair-code.txt"
echo Porta local: 8765
echo Codigo de pareamento: %PAIR%
ipconfig | findstr /R /C:"IPv4"
pause
