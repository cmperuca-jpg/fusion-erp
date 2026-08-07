#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
HERE="$(cd "$(dirname "$0")" && pwd)"
HTML="$REPO/public/pages/alunos/prontuario.html"
CSS_REL="public/pages/alunos/prontuario-contraste-v2.css"
CSS="$REPO/$CSS_REL"
BACKUP="$REPO/backup-contraste-ficha-$(date +%Y%m%d-%H%M%S)"

test -f "$HTML" || { echo "Arquivo nao encontrado: public/pages/alunos/prontuario.html" >&2; exit 1; }

mkdir -p "$BACKUP/public/pages/alunos"
cp "$HTML" "$BACKUP/public/pages/alunos/prontuario.html"
cp "$HERE/$CSS_REL" "$CSS"

if ! grep -q 'prontuario-contraste-v2.css' "$HTML"; then
  python3 - "$HTML" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
link = '  <link rel="stylesheet" href="./prontuario-contraste-v2.css?v=20260807-1">'
target = '<link rel="stylesheet" href="/pages/_shared/fusion-area-clara.css?v=20260729-contraste-global-2">'
if target in s:
    s = s.replace(target, target + "\n" + link, 1)
else:
    s = s.replace("</head>", link + "\n</head>", 1)
p.write_text(s, encoding="utf-8")
PY
fi

echo "Contraste da ficha aplicado."
echo "Backup: $BACKUP"
