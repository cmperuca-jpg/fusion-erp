$ErrorActionPreference = 'Stop'
$PatchRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TargetRoot = (Get-Location).Path
Write-Host "Fusion ERP Mobile 2.7.4" -ForegroundColor Cyan
Write-Host "Destino: $TargetRoot"
if (-not (Test-Path (Join-Path $TargetRoot 'package.json'))) { throw 'Execute este instalador dentro da pasta raiz do Fusion ERP, onde fica o package.json.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $TargetRoot "backup-mobile-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$itemsToBackup = @('public\mobile','public\assets\mobile','public\manifest.webmanifest','public\pages\portal-aluno\index.html','public\pages\professor-painel\index.html','public\pages\login\index.html')
foreach ($item in $itemsToBackup) {
  $src = Join-Path $TargetRoot $item
  if (Test-Path $src) {
    $dst = Join-Path $backup $item
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    Copy-Item $src $dst -Recurse -Force
  }
}
Copy-Item (Join-Path $PatchRoot 'public\mobile') (Join-Path $TargetRoot 'public\mobile') -Recurse -Force
Copy-Item (Join-Path $PatchRoot 'public\assets\mobile') (Join-Path $TargetRoot 'public\assets\mobile') -Recurse -Force
Copy-Item (Join-Path $PatchRoot 'public\manifest.webmanifest') (Join-Path $TargetRoot 'public\manifest.webmanifest') -Force
Copy-Item (Join-Path $PatchRoot 'INICIAR_FUSION_MOBILE.bat') (Join-Path $TargetRoot 'INICIAR_FUSION_MOBILE.bat') -Force
Copy-Item (Join-Path $PatchRoot 'LIBERAR_FIREWALL_FUSION_MOBILE.bat') (Join-Path $TargetRoot 'LIBERAR_FIREWALL_FUSION_MOBILE.bat') -Force
function Inject-Mobile($relativePath) {
  $file = Join-Path $TargetRoot $relativePath
  if (-not (Test-Path $file)) { return }
  $html = Get-Content $file -Raw
  if ($html -notmatch 'viewport-fit=cover') {
    $html = $html -replace '<meta name="viewport" content="width=device-width, initial-scale=1">','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  }
  if ($html -notmatch '/manifest.webmanifest') {
    $html = $html -replace '</head>', '  <link rel="manifest" href="/manifest.webmanifest">' + "`r`n</head>"
  }
  if ($html -notmatch '/assets/mobile/fusion-mobile.css') {
    $html = $html -replace '</head>', '  <link rel="stylesheet" href="/assets/mobile/fusion-mobile.css">' + "`r`n</head>"
  }
  if ($html -notmatch '/assets/mobile/fusion-mobile-loader.js') {
    $html = $html -replace '</body>', '  <script src="/assets/mobile/fusion-mobile-loader.js"></script>' + "`r`n</body>"
  }
  Set-Content -Path $file -Value $html -Encoding UTF8
}
Inject-Mobile 'public\pages\portal-aluno\index.html'
Inject-Mobile 'public\pages\professor-painel\index.html'
Inject-Mobile 'public\pages\login\index.html'
Write-Host "Instalacao concluida." -ForegroundColor Green
Write-Host "Backup criado em: $backup"
Write-Host "Abra: http://IP-DO-SERVIDOR:3000/mobile/"
