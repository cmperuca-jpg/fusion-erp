param(
  [Parameter(Mandatory=$false)]
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"

$repoPath = (Resolve-Path $Repo).Path
$htmlRel = "public\pages\alunos\prontuario.html"
$cssRel  = "public\pages\alunos\prontuario-contraste-v2.css"

$html = Join-Path $repoPath $htmlRel
if (-not (Test-Path $html)) {
  throw "Arquivo nao encontrado: $htmlRel"
}

$backupDir = Join-Path $repoPath ("backup-contraste-ficha-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backupDir "public\pages\alunos") | Out-Null
Copy-Item $html (Join-Path $backupDir $htmlRel) -Force

$cssOrigem = Join-Path $PSScriptRoot $cssRel
$cssDestino = Join-Path $repoPath $cssRel
Copy-Item $cssOrigem $cssDestino -Force

$conteudo = Get-Content $html -Raw -Encoding UTF8
$linkNovo = '  <link rel="stylesheet" href="./prontuario-contraste-v2.css?v=20260807-1">'

if ($conteudo -notmatch "prontuario-contraste-v2\.css") {
  $alvo = '<link rel="stylesheet" href="/pages/_shared/fusion-area-clara.css?v=20260729-contraste-global-2">'
  if ($conteudo.Contains($alvo)) {
    $conteudo = $conteudo.Replace($alvo, $alvo + "`r`n" + $linkNovo)
  } else {
    $conteudo = $conteudo.Replace("</head>", $linkNovo + "`r`n</head>")
  }
  Set-Content -Path $html -Value $conteudo -Encoding UTF8
}

Write-Host ""
Write-Host "Contraste da ficha aplicado." -ForegroundColor Green
Write-Host "CSS: $cssRel"
Write-Host "HTML: $htmlRel"
Write-Host "Backup: $backupDir"
Write-Host ""
Write-Host "Depois faca deploy e atualize a ficha com Ctrl+F5."
