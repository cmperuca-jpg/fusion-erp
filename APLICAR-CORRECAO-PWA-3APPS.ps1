param(
  [Parameter(Mandatory=$false)]
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"
$repoPath = (Resolve-Path $Repo).Path
$origemRoot = $PSScriptRoot

$arquivos = @(
  "public\fusion-sw-sistema.js",
  "public\fusion-sw-aluno.js",
  "public\fusion-sw-professor.js",
  "public\manifest-sistema.webmanifest",
  "public\manifest-aluno.webmanifest",
  "public\manifest-professor.webmanifest",
  "public\assets\pwa\fusion-pwa-install.js",
  "public\assets\pwa\fusion-pwa-mobile.css",
  "public\assets\css\fusion-mobile-final.css",
  "public\assets\css\fusion-mobile-first.css",
  "public\assets\js\fusion-mobile-final.js",
  "public\assets\css\fusion-app.css",
  "public\assets\css\fusion-menu-global.css",
  "public\assets\css\fusion-premium-final.css",
  "public\assets\js\fusion-layout.js",
  "public\pages\_shared\fusion-area-clara.css"
)

$backupDir = Join-Path $repoPath ("backup-pwa-3apps-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

foreach ($rel in $arquivos) {
  $src = Join-Path $origemRoot $rel
  $dst = Join-Path $repoPath $rel

  if (-not (Test-Path $src)) {
    throw "Arquivo ausente no pacote: $rel"
  }

  if (Test-Path $dst) {
    $backup = Join-Path $backupDir $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $backup -Parent) | Out-Null
    Copy-Item $dst $backup -Force
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  }

  Copy-Item $src $dst -Force
  Write-Host "Atualizado: $rel" -ForegroundColor Green
}

Write-Host ""
Write-Host "Correção PWA 3 apps aplicada." -ForegroundColor Cyan
Write-Host "Backup: $backupDir"
Write-Host ""
Write-Host "Faça commit/push/deploy e depois feche/reabra os PWAs no celular."
