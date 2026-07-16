$ErrorActionPreference = "SilentlyContinue"
Stop-ScheduledTask -TaskName "Fusion Access Agent"
Unregister-ScheduledTask -TaskName "Fusion Access Agent" -Confirm:$false
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*FusionAccessSupervisor.ps1*' -or $_.Name -eq 'FusionFacialWorker.exe' -or $_.CommandLine -like '*FusionAccessAgent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
