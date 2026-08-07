#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP="$REPO/backup-pwa-3apps-$(date +%Y%m%d-%H%M%S)"

FILES=(
  "public/fusion-sw-sistema.js"
  "public/fusion-sw-aluno.js"
  "public/fusion-sw-professor.js"
  "public/manifest-sistema.webmanifest"
  "public/manifest-aluno.webmanifest"
  "public/manifest-professor.webmanifest"
  "public/assets/pwa/fusion-pwa-install.js"
  "public/assets/pwa/fusion-pwa-mobile.css"
  "public/assets/css/fusion-mobile-final.css"
  "public/assets/css/fusion-mobile-first.css"
  "public/assets/js/fusion-mobile-final.js"
  "public/assets/css/fusion-app.css"
  "public/assets/css/fusion-menu-global.css"
  "public/assets/css/fusion-premium-final.css"
  "public/assets/js/fusion-layout.js"
  "public/pages/_shared/fusion-area-clara.css"
)

mkdir -p "$BACKUP"

for rel in "${FILES[@]}"; do
  src="$HERE/$rel"
  dst="$REPO/$rel"

  test -f "$src" || { echo "Arquivo ausente no pacote: $rel" >&2; exit 1; }

  if test -f "$dst"; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$dst" "$BACKUP/$rel"
  else
    mkdir -p "$(dirname "$dst")"
  fi

  cp "$src" "$dst"
  echo "Atualizado: $rel"
done

echo
echo "Correção aplicada. Backup: $BACKUP"
echo "Faça deploy e feche/reabra os três PWAs."
