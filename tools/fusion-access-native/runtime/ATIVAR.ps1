param(
  [Parameter(Mandatory=$true)][string]$ServerUrl,
  [Parameter(Mandatory=$true)][string]$Code,
  [Parameter(Mandatory=$true)][string]$InstallDir
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ServerUrl = $ServerUrl.Trim().TrimEnd("/")
$Code = $Code -replace '\D',''
if ($ServerUrl -notmatch '^https://') { throw "Use o endereço HTTPS informado pelo Fusion ERP." }
if ($Code.Length -ne 8) { throw "O código de ativação deve possuir oito números." }
$body = @{ codigo=$Code; computador=$env:COMPUTERNAME } | ConvertTo-Json -Compress
$result = Invoke-RestMethod -Method Post -Uri "$ServerUrl/api/access-onboarding/ativar" -ContentType "application/json" -Body $body -TimeoutSec 45
if (-not $result.ok -or -not $result.configuracao.agentToken) { throw "O servidor não confirmou a ativação." }
$cfg = $result.configuracao
$content = @"
ACCESS_AGENT_ID=$($cfg.agentId)
ACCESS_AGENT_TOKEN=$($cfg.agentToken)
ACCESS_SERVER_URL=$($cfg.serverUrl)
ACCESS_AGENT_POLL_MS=$($cfg.pollMs)
ACCESS_DRIVER=$($cfg.driver)
ACCESS_EQUIPMENT_ID=catraca-01
ACCESS_HOST=$($cfg.equipmentHost)
ACCESS_PORT=$($cfg.equipmentPort)
ACCESS_RELEASE_SECONDS=5
GENERIC_TCP_RELEASE_HEX=
GENERIC_TCP_EXPECTED_RESPONSE_HEX=
"@
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Content -LiteralPath (Join-Path $InstallDir "agent.env") -Value $content -Encoding ASCII
