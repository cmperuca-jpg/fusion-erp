param(
  [Parameter(Mandatory=$false)]
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"

$repoPath = (Resolve-Path $Repo).Path
$marker = "FUSION_PWA_SCROLL_FIX_20260807"

$arquivosAppend = @(
  "public\assets\pwa\fusion-pwa-mobile.css",
  "public\assets\css\fusion-mobile-final.css"
)

$arquivosJsAppend = @(
  "public\assets\pwa\fusion-pwa-install.js",
  "public\assets\js\fusion-mobile-final.js"
)

$swRel = "public\fusion-sw-sistema.js"

$cssPatch = Join-Path $PSScriptRoot "patches\append-fusion-pwa-scroll.css"
$jsPatch = Join-Path $PSScriptRoot "patches\append-fusion-pwa-scroll.js"
$swNovo = Join-Path $PSScriptRoot "public\fusion-sw-sistema.js"

foreach ($rel in ($arquivosAppend + $arquivosJsAppend + @($swRel))) {
  $alvo = Join-Path $repoPath $rel
  if (-not (Test-Path $alvo)) {
    throw "Arquivo não encontrado na cópia do fusion-erp: $rel"
  }
}

$backupDir = Join-Path $repoPath ("backup-pwa-scroll-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Backup-Arquivo([string]$rel) {
  $origem = Join-Path $repoPath $rel
  $destino = Join-Path $backupDir $rel
  $pasta = Split-Path $destino -Parent
  New-Item -ItemType Directory -Force -Path $pasta | Out-Null
  Copy-Item $origem $destino -Force
}

function Append-Se-Necessario([string]$rel, [string]$patchFile) {
  $alvo = Join-Path $repoPath $rel
  $conteudo = Get-Content $alvo -Raw -Encoding UTF8

  if ($conteudo -match [regex]::Escape($marker)) {
    Write-Host "Já corrigido: $rel" -ForegroundColor DarkGray
    return
  }

  Backup-Arquivo $rel
  $patch = Get-Content $patchFile -Raw -Encoding UTF8
  Add-Content -Path $alvo -Value ("`r`n" + $patch) -Encoding UTF8
  Write-Host "Corrigido: $rel" -ForegroundColor Green
}

foreach ($rel in $arquivosAppend) {
  Append-Se-Necessario $rel $cssPatch
}

foreach ($rel in $arquivosJsAppend) {
  Append-Se-Necessario $rel $jsPatch
}

# O Service Worker atual da main é v280. Só substitui automaticamente
# quando encontra essa versão ou a própria versão desta correção.
$swAlvo = Join-Path $repoPath $swRel
$swAtual = Get-Content $swAlvo -Raw -Encoding UTF8

if ($swAtual -match "fusion-sistema-v280" -or $swAtual -match "fusion-sistema-v281-scroll") {
  Backup-Arquivo $swRel
  Copy-Item $swNovo $swAlvo -Force
  Write-Host "Service Worker atualizado: $swRel" -ForegroundColor Green
} else {
  Write-Warning "O Service Worker mudou depois da versão lida. Não foi sobrescrito automaticamente."
  Write-Warning "Compare manualmente com: public\fusion-sw-sistema.js deste pacote."
}

Write-Host ""
Write-Host "Correção de rolagem PWA aplicada." -ForegroundColor Cyan
Write-Host "Backup: $backupDir"
Write-Host ""
Write-Host "Próximos passos:"
Write-Host "1. Commit/push/deploy dos arquivos alterados."
Write-Host "2. Feche completamente o PWA no celular."
Write-Host "3. Abra novamente e teste uma página longa."
Write-Host "4. Se o aparelho insistir em usar a versão antiga, limpe o cache/dados do site ou reinstale o PWA uma vez."
