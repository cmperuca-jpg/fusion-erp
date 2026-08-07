$ErrorActionPreference = "Stop"
$index = "public/pages/financeiro/index.html"

if (!(Test-Path $index)) {
  throw "Execute este arquivo na raiz do projeto Fusion ERP."
}

$html = Get-Content $index -Raw -Encoding UTF8

# Remove referência antiga do mesmo CSS.
$html = [regex]::Replace(
  $html,
  '\s*<link[^>]+href="/pages/financeiro/recebimento-contraste\.css[^"]*"[^>]*>',
  ''
)

# Coloca a correção por último no head para vencer os temas globais.
$link = '  <link rel="stylesheet" href="/pages/financeiro/recebimento-contraste.css?v=20260807-campos-visiveis-final-1">'
$html = $html -replace '</head>', "$link`r`n</head>"

Set-Content $index $html -Encoding UTF8
Write-Host "Financeiro atualizado. CSS de contraste agora e o ultimo stylesheet do head."
