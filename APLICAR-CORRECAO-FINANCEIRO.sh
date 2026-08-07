#!/usr/bin/env bash
set -e
INDEX="public/pages/financeiro/index.html"
test -f "$INDEX" || { echo "Execute na raiz do Fusion ERP."; exit 1; }

python3 - "$INDEX" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
s = re.sub(
    r'\s*<link[^>]+href="/pages/financeiro/recebimento-contraste\.css[^"]*"[^>]*>',
    '',
    s
)
link = '  <link rel="stylesheet" href="/pages/financeiro/recebimento-contraste.css?v=20260807-campos-visiveis-final-1">'
s = s.replace('</head>', link + '\n</head>')
p.write_text(s, encoding="utf-8")
PY

echo "Financeiro atualizado. CSS de contraste agora e o ultimo stylesheet do head."
