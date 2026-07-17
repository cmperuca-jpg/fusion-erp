param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference = "Stop"
$task = "Fusion Access Agent"
Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*FusionAccessSupervisor.ps1*' -or $_.Name -eq 'FusionFacialWorker.exe' -or $_.CommandLine -like '*FusionAccessAgent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "data") | Out-Null
& icacls.exe (Join-Path $InstallDir "agent.env") /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
& icacls.exe (Join-Path $InstallDir "data") /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' | Out-Null
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\FusionAccessSupervisor.ps1`""
$startup = New-ScheduledTaskTrigger -AtStartup
$logon = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $task -Action $action -Trigger @($startup,$logon) -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $task
& netsh.exe advfirewall firewall delete rule name="Fusion Access Offline" | Out-Null
& netsh.exe advfirewall firewall add rule name="Fusion Access Offline" dir=in action=allow protocol=TCP localport=8765 profile=any | Out-Null
Start-Sleep -Seconds 2
if (-not (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue)) {
  throw "A tarefa automatica do Fusion Access nao foi criada."
}
