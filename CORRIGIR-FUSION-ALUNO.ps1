param(
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"
$file = Join-Path $Repo "modules/security/api-security.middleware.mjs"

if (-not (Test-Path $file)) {
  throw "Arquivo nao encontrado: $file"
}

$content = Get-Content $file -Raw -Encoding UTF8
$backup = "$file.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $file $backup -Force

$marker = '  ["POST", "/api/treinos/aluno-login"],'
$rules = @'
  ["POST", "/api/treinos/aluno-login"],
  ["POST", "/api/treinos/aluno-app/ativar"],
  ["POST", "/api/treinos/aluno-app/status"],
  ["POST", "/api/treinos/aluno-app/login"],
  ["POST", "/api/treinos/aluno-app/primeiro-acesso"],
  ["GET", "/api/treinos/aluno-app/me"],
  ["POST", "/api/treinos/aluno-app/logout"],
'@

if ($content -notmatch [regex]::Escape('/api/treinos/aluno-app/ativar')) {
  if (-not $content.Contains($marker)) { throw "Ponto de insercao das rotas nao encontrado." }
  $content = $content.Replace($marker, $rules.TrimEnd())
}

$old = @'
function hostRequisicao(req) {
  return String(
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    ""
  )
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

function redirecionarCanonicoPublico(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) return false;

  const destinoRota = destinoCanonicoPublico(req.path);
  const host = hostRequisicao(req);
  const www = host === "www.fusionsistema.com.br";

  if (!destinoRota && !www) return false;

  const caminho = destinoRota || req.originalUrl || req.url || "/";
  const destino = www
    ? `https://fusionsistema.com.br${caminho}`
    : caminho;

  res.setHeader("Cache-Control", "no-store");
  res.redirect(308, destino);
  return true;
}
'@

$new = @'
function redirecionarCanonicoPublico(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) return false;

  const destinoRota = destinoCanonicoPublico(req.path);
  if (!destinoRota) return false;

  res.setHeader("Cache-Control", "no-store");
  res.redirect(308, destinoRota);
  return true;
}
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
} elseif ($content -match 'hostRequisicao') {
  throw "A secao de dominio existe, mas esta diferente da versao validada. Nenhuma substituicao insegura foi feita."
}

Set-Content $file $content -Encoding UTF8 -NoNewline

Write-Host "Correcao aplicada."
Write-Host "Backup: $backup"
Write-Host ""
Write-Host "Revise com:"
Write-Host "  git diff -- modules/security/api-security.middleware.mjs"
Write-Host ""
Write-Host "Depois:"
Write-Host "  git add modules/security/api-security.middleware.mjs"
Write-Host '  git commit -m "fix: dominio canonico e acesso Fusion Aluno"'
Write-Host "  git push origin main"
