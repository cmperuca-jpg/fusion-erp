$ErrorActionPreference = "Stop"
if (Get-Command py -ErrorAction SilentlyContinue) {
  py ".\APLICAR_CORRECAO.py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python ".\APLICAR_CORRECAO.py"
} else {
  throw "Python não encontrado. Instale Python ou envie o financeiro.js para receber o arquivo completo já corrigido."
}
