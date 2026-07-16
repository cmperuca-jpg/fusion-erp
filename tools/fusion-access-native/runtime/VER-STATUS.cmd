@echo off
title Fusion Access - Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-ScheduledTask -TaskName 'Fusion Access Agent' -ErrorAction SilentlyContinue;if(-not $t){Write-Host 'Fusion Access nao esta instalado.' -ForegroundColor Red;exit};Write-Host ('Estado automatico: '+$t.State) -ForegroundColor Cyan;$base='$env:ProgramData\FusionERP\AccessAgent';foreach($name in @('supervisor.log','agent.log','facial.log')){$p=Join-Path (Join-Path $base 'logs') $name;if(Test-Path $p){Write-Host '';Write-Host ('--- '+$name+' ---');Get-Content $p -Tail 12}}"
pause
