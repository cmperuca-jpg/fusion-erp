$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Read-EnvMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=",2)
    if ($parts.Count -eq 2) { $map[$parts[0].Trim()] = $parts[1].Trim() }
  }
  return $map
}

function First-Value($primary, $fallback, [string]$name, [string]$default = "") {
  if ($primary.ContainsKey($name) -and [string]$primary[$name]) { return [string]$primary[$name] }
  if ($fallback.ContainsKey($name) -and [string]$fallback[$name]) { return [string]$fallback[$name] }
  return $default
}

function Backup-IfExists([string]$Path, [string]$Suffix) {
  if (Test-Path -LiteralPath $Path) {
    Copy-Item -LiteralPath $Path -Destination "$Path.backup-$Suffix" -Force
  }
}

function Stop-FusionProcesses([string]$InstallDir) {
  $all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
  foreach ($p in $all) {
    $cmd = [string]$p.CommandLine
    $exe = [string]$p.ExecutablePath
    if (($cmd -and $cmd.IndexOf($InstallDir, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
        ($exe -and $exe.IndexOf($InstallDir, [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
    }
  }
}

function Agent-Headers($cfg) {
  return @{
    "x-agent-id" = [string]$cfg["ACCESS_AGENT_ID"]
    "x-agent-token" = [string]$cfg["ACCESS_AGENT_TOKEN"]
    "x-agent-timestamp" = ([DateTime]::UtcNow.ToString("o"))
    "x-agent-nonce" = ([Guid]::NewGuid().ToString("N"))
    "x-agent-tenant-id" = [string]$cfg["ACCESS_AGENT_TENANT_ID"]
    "x-agent-equipment-id" = [string]$cfg["ACCESS_EQUIPMENT_ID"]
  }
}

$RepoRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$InstallDir = "C:\ProgramData\FusionERP\AccessAgent"
$InstallEnv = Join-Path $InstallDir "agent.env"
$RepoEnv = Join-Path $RepoRoot "data\fusion-access-live-agent.env"
$RepoAgent = Join-Path $RepoRoot "tools\fusion-access-native\legacy\FusionAccessAgent.ps1"
$RepoSupervisor = Join-Path $RepoRoot "tools\fusion-access-native\runtime\FusionAccessSupervisor.ps1"
$InstallAgent = Join-Path $InstallDir "FusionAccessAgent.ps1"
$InstallSupervisor = Join-Path $InstallDir "FusionAccessSupervisor.ps1"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "[1/7] Conferindo runtime..."
if (-not (Test-Path -LiteralPath $RepoAgent)) { throw "FusionAccessAgent.ps1 do repositorio nao encontrado." }
if (-not (Test-Path -LiteralPath $RepoSupervisor)) { throw "FusionAccessSupervisor.ps1 do repositorio nao encontrado." }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$installed = Read-EnvMap $InstallEnv
$repo = Read-EnvMap $RepoEnv

$token = First-Value $installed $repo "ACCESS_AGENT_TOKEN"
if (-not $token) { throw "ACCESS_AGENT_TOKEN nao encontrado no runtime instalado nem no env local." }

$driver = First-Value $installed $repo "ACCESS_DRIVER" "henry7x"
$hostName = First-Value $installed $repo "ACCESS_HOST" "10.0.0.236"
$port = First-Value $installed $repo "ACCESS_PORT" "3000"

Write-Host "[2/7] Atualizando configuracao instalada..."
Backup-IfExists $InstallEnv $stamp
Backup-IfExists $InstallAgent $stamp
Backup-IfExists $InstallSupervisor $stamp

$lines = @(
  "ACCESS_AGENT_ID=academia-01",
  "ACCESS_AGENT_TENANT_ID=academia-piloto",
  "ACCESS_AGENT_TOKEN=$token",
  "ACCESS_SERVER_URL=https://fusionsistema.com.br",
  "ACCESS_AGENT_POLL_MS=1000",
  "ACCESS_DRIVER=$driver",
  "ACCESS_EQUIPMENT_ID=disp_henry7x_01",
  "ACCESS_HOST=$hostName",
  "ACCESS_PORT=$port",
  "ACCESS_RELEASE_SECONDS=5",
  "GENERIC_TCP_RELEASE_HEX=",
  "GENERIC_TCP_EXPECTED_RESPONSE_HEX="
)
Set-Content -LiteralPath $InstallEnv -Value $lines -Encoding ASCII

Copy-Item -LiteralPath $RepoAgent -Destination $InstallAgent -Force
Copy-Item -LiteralPath $RepoSupervisor -Destination $InstallSupervisor -Force

Write-Host "[OK] Tenant=academia-piloto | Equipamento=disp_henry7x_01 | Servidor=fusionsistema.com.br"
Write-Host "[OK] Token preservado sem ser exibido."

Write-Host "[3/7] Reiniciando Fusion Access Agent..."
schtasks.exe /End /TN "Fusion Access Agent" *> $null
Start-Sleep -Seconds 1
Stop-FusionProcesses $InstallDir
Start-Sleep -Seconds 2
& schtasks.exe /Run /TN "Fusion Access Agent" | Out-Host
Start-Sleep -Seconds 6

Write-Host "[4/7] Validando heartbeat autenticado..."
$cfg = Read-EnvMap $InstallEnv
$server = ([string]$cfg["ACCESS_SERVER_URL"]).TrimEnd("/")
$body = @{
  state = "repair-heartbeat"
  tenantId = [string]$cfg["ACCESS_AGENT_TENANT_ID"]
  equipmentId = [string]$cfg["ACCESS_EQUIPMENT_ID"]
  equipmentIds = @([string]$cfg["ACCESS_EQUIPMENT_ID"])
  repairedAt = [DateTime]::UtcNow.ToString("o")
} | ConvertTo-Json -Compress

try {
  $r = Invoke-RestMethod -Method Post `
    -Uri "$server/api/access-bridge/agent/heartbeat" `
    -Headers (Agent-Headers $cfg) `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 20
  if (-not $r.ok) { throw "Servidor nao confirmou heartbeat." }
  Write-Host "[OK] HEARTBEAT_SERVIDOR_OK"
} catch {
  Write-Host "[ERRO] Heartbeat falhou: $($_.Exception.Message)"
  $log = Join-Path $InstallDir "logs\agent.log"
  if (Test-Path -LiteralPath $log) {
    Write-Host "---- ultimas linhas do agent.log ----"
    Get-Content -LiteralPath $log -Tail 12
    Write-Host "-------------------------------------"
  }
  throw
}

Write-Host "[5/7] Conferindo processo da catraca..."
$catraca = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*FusionAccessAgent.ps1*" -and $_.CommandLine -like "*ProgramData\FusionERP\AccessAgent*" }
if ($catraca) {
  Write-Host "[OK] Processo FusionAccessAgent.ps1 ativo."
} else {
  Write-Host "[AVISO] Heartbeat funcionou, mas o processo permanente ainda nao apareceu."
}

Write-Host "[6/7] Reiniciando biometria FS80..."
schtasks.exe /End /TN "Fusion Biometria FS80" *> $null
$nodes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*fusion-biometria-sidecar.mjs*" }
foreach ($n in $nodes) {
  try { Stop-Process -Id $n.ProcessId -Force -ErrorAction Stop } catch {}
}
Start-Sleep -Seconds 2
& schtasks.exe /Run /TN "Fusion Biometria FS80" | Out-Host
Start-Sleep -Seconds 6

$bio = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*fusion-biometria-sidecar.mjs*" }
if ($bio) {
  Write-Host "[OK] Sidecar FS80 ativo."
} else {
  Write-Host "[AVISO] Tarefa biometrica foi acionada, mas o node ainda nao apareceu."
}

Write-Host "[7/7] Resultado..."
Write-Host ""
Write-Host "============================================================"
Write-Host "REPARO_FUSION_ACCESS_OK"
Write-Host "Servidor recebeu tenant + equipamento com autenticacao."
Write-Host "Atualize a pagina do Fusion e clique em TESTAR LEITOR."
Write-Host "============================================================"
