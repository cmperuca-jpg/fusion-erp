param(
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"

$repoPath = (Resolve-Path $Repo).Path
$destinoJs = Join-Path $repoPath "public\pages\alunos\cep-autofill.js"
$indexHtml = Join-Path $repoPath "public\pages\alunos\index.html"
$origemJs = Join-Path $PSScriptRoot "public\pages\alunos\cep-autofill.js"

if (-not (Test-Path $indexHtml)) {
  throw "Não encontrei public\pages\alunos\index.html. Execute este script apontando para a raiz do fusion-erp: .\APLICAR_CORRECAO.ps1 -Repo C:\caminho\fusion-erp"
}

if (-not (Test-Path $origemJs)) {
  throw "Arquivo de correção não encontrado no pacote."
}

$backupDir = Join-Path $repoPath ("backup-troca-turma-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Copy-Item $destinoJs (Join-Path $backupDir "cep-autofill.js") -Force
Copy-Item $indexHtml (Join-Path $backupDir "index.html") -Force

Copy-Item $origemJs $destinoJs -Force

$html = Get-Content $indexHtml -Raw -Encoding UTF8
$htmlNovo = $html -replace 'cep-autofill\.js\?v=[^"''\s<]+', 'cep-autofill.js?v=20260807-troca-turma-1'

if ($htmlNovo -eq $html) {
  if ($html -match 'src="\./cep-autofill\.js"') {
    $htmlNovo = $html -replace 'src="\./cep-autofill\.js"', 'src="./cep-autofill.js?v=20260807-troca-turma-1"'
  } elseif ($html -notmatch 'cep-autofill\.js') {
    $htmlNovo = $html -replace '(</body>)', '  <script src="./cep-autofill.js?v=20260807-troca-turma-1"></script>`r`n$1'
  }
}

Set-Content -Path $indexHtml -Value $htmlNovo -Encoding UTF8

Write-Host ""
Write-Host "Correção aplicada." -ForegroundColor Green
Write-Host "Arquivo atualizado: public\pages\alunos\cep-autofill.js"
Write-Host "Cache atualizado em: public\pages\alunos\index.html"
Write-Host "Backup criado em: $backupDir"
Write-Host ""
Write-Host "Depois, faça commit/push normalmente e teste com Ctrl+F5."
