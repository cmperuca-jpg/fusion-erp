$ErrorActionPreference = "Continue"
$base = $PSScriptRoot
$logDir = Join-Path $base "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Log([string]$text) {
  $path = Join-Path $logDir "supervisor.log"
  if ((Test-Path $path) -and (Get-Item $path).Length -gt 5242880) { Move-Item -Force $path "$path.1" }
  Add-Content -LiteralPath $path -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text" -Encoding UTF8
}
function Start-Hidden([string]$file,[string]$arguments) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $file; $info.Arguments = $arguments; $info.WorkingDirectory = $base
  $info.UseShellExecute = $false; $info.CreateNoWindow = $true; $info.WindowStyle = 'Hidden'
  return [System.Diagnostics.Process]::Start($info)
}
Log "Supervisor iniciado"
$catraca = $null; $facial = $null
while ($true) {
  try {
    if ($null -eq $catraca -or $catraca.HasExited) {
      $catraca = Start-Hidden "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$base\FusionAccessAgent.ps1`" -ConfigPath `"$base\agent.env`""
      Log "Processo da catraca iniciado"
    }
    if ($null -eq $facial -or $facial.HasExited) {
      $facial = Start-Hidden (Join-Path $base "FusionFacialWorker.exe") ""
      Log "Motor facial iniciado"
    }
  } catch { Log "Falha ao reiniciar componente: $($_.Exception.Message)" }
  Start-Sleep -Seconds 10
}
