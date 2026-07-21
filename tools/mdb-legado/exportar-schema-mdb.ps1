param(
  [Parameter(Mandatory=$true)]
  [string]$MdbPath,

  [string]$OutDir = ".\data\importacao\schema-mdb"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MdbPath)) {
  throw "MDB nao encontrado: $MdbPath"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$providers = @(
  "Microsoft.ACE.OLEDB.16.0",
  "Microsoft.ACE.OLEDB.12.0",
  "Microsoft.Jet.OLEDB.4.0"
)

$conn = $null
$providerUsado = $null

foreach ($provider in $providers) {
  try {
    $teste = New-Object System.Data.OleDb.OleDbConnection("Provider=$provider;Data Source=$MdbPath;Persist Security Info=False;")
    $teste.Open()
    $conn = $teste
    $providerUsado = $provider
    break
  } catch {
    if ($teste) { $teste.Dispose() }
  }
}

if (-not $conn) {
  $erro = [ordered]@{
    ok = $false
    mensagem = "Nenhum provider OLEDB Access esta instalado nesta maquina."
    providersTentados = $providers
    mdb = (Resolve-Path -LiteralPath $MdbPath).Path
    recomendacao = "Instalar Microsoft Access Database Engine e executar novamente."
  }
  $erro | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path (Join-Path $OutDir "erro-provider-access.json")
  throw $erro.mensagem
}

try {
  $tabelasSchema = $conn.GetSchema("Tables")
  $tabelas = @()
  foreach ($row in $tabelasSchema.Rows) {
    $nome = [string]$row["TABLE_NAME"]
    $tipo = [string]$row["TABLE_TYPE"]
    if ($nome.StartsWith("MSys")) { continue }
    if ($tipo -notin @("TABLE", "LINK")) { continue }
    $tabelas += [ordered]@{ nome = $nome; tipo = $tipo }
  }

  $colunas = @()
  foreach ($tabela in $tabelas) {
    $cols = $conn.GetSchema("Columns", @($null, $null, $tabela.nome, $null))
    foreach ($col in $cols.Rows) {
      $colunas += [ordered]@{
        tabela = $tabela.nome
        coluna = [string]$col["COLUMN_NAME"]
        ordinal = [int]$col["ORDINAL_POSITION"]
        tipoOleDb = [string]$col["DATA_TYPE"]
        tamanho = [string]$col["CHARACTER_MAXIMUM_LENGTH"]
        permiteNulo = [string]$col["IS_NULLABLE"]
      }
    }
  }

  $relatorio = [ordered]@{
    ok = $true
    provider = $providerUsado
    mdb = (Resolve-Path -LiteralPath $MdbPath).Path
    geradoEm = (Get-Date).ToString("s")
    totalTabelas = $tabelas.Count
    totalColunas = $colunas.Count
    tabelas = $tabelas
    colunas = $colunas
  }

  $relatorio | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path (Join-Path $OutDir "schema-mdb.json")
  $tabelas | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir "tabelas.csv")
  $colunas | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir "colunas.csv")

  Write-Output "Schema exportado em $OutDir"
} finally {
  $conn.Close()
  $conn.Dispose()
}
