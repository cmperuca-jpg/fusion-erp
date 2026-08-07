from pathlib import Path
import re
import sys

ROOT = Path.cwd()

financeiro_js = ROOT / "public/pages/financeiro/financeiro.js"
financeiro_html = ROOT / "public/pages/financeiro/index.html"

if not financeiro_js.exists():
    raise SystemExit("ERRO: public/pages/financeiro/financeiro.js não encontrado. Execute na raiz do Fusion ERP.")

texto = financeiro_js.read_text(encoding="utf-8")

alvo = """<button class="btn-light" ${jaPago || programado ? "disabled" : ""} onclick="baixarLancamento('${escapeHtml(item.id)}')">${item.tipo === "pagar" ? "Pagar" : "Receber"}</button>"""
novo = """<button class="btn-light" ${jaPago ? "disabled" : ""} onclick="baixarLancamento('${escapeHtml(item.id)}')" ${programado ? 'title="Título programado: recebimento antecipado permitido"' : ""}>${item.tipo === "pagar" ? "Pagar" : "Receber"}</button>"""

qtd = texto.count(alvo)
if qtd != 1:
    raise SystemExit(f"ERRO: trecho de Receber programado esperado 1 vez, encontrado {qtd}. Arquivo diferente da versão analisada.")

texto = texto.replace(alvo, novo, 1)
financeiro_js.write_text(texto, encoding="utf-8")

if financeiro_html.exists():
    html = financeiro_html.read_text(encoding="utf-8")
    html2, n = re.subn(
        r'/pages/financeiro/financeiro\.js\?v=[^"]+',
        '/pages/financeiro/financeiro.js?v=20260807-programado-antecipacao-2',
        html,
        count=1
    )
    if n == 1:
        financeiro_html.write_text(html2, encoding="utf-8")
    else:
        print("AVISO: versão do financeiro.js não foi localizada no index.html; o JS foi corrigido mesmo assim.")

print("OK: Financeiro corrigido.")
print("- Programado continua com status Programado.")
print("- Não entra como pago/aberto indevidamente.")
print("- Botão Receber fica habilitado para antecipação.")
print("- Vencimento/Cancelar continuam protegidos enquanto estiver Programado.")
