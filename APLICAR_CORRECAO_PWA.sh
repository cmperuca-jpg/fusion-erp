#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
MARKER="FUSION_PWA_SCROLL_FIX_20260807"
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP="$REPO/backup-pwa-scroll-$(date +%Y%m%d-%H%M%S)"

CSS_PATCH="$HERE/patches/append-fusion-pwa-scroll.css"
JS_PATCH="$HERE/patches/append-fusion-pwa-scroll.js"

CSS_FILES=(
  "public/assets/pwa/fusion-pwa-mobile.css"
  "public/assets/css/fusion-mobile-final.css"
)
JS_FILES=(
  "public/assets/pwa/fusion-pwa-install.js"
  "public/assets/js/fusion-mobile-final.js"
)

mkdir -p "$BACKUP"

backup_file() {
  local rel="$1"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp "$REPO/$rel" "$BACKUP/$rel"
}

append_if_needed() {
  local rel="$1"
  local patch="$2"
  test -f "$REPO/$rel" || { echo "Arquivo ausente: $rel" >&2; exit 1; }
  if grep -q "$MARKER" "$REPO/$rel"; then
    echo "Já corrigido: $rel"
    return
  fi
  backup_file "$rel"
  printf '\n' >> "$REPO/$rel"
  cat "$patch" >> "$REPO/$rel"
  echo "Corrigido: $rel"
}

for f in "${CSS_FILES[@]}"; do append_if_needed "$f" "$CSS_PATCH"; done
for f in "${JS_FILES[@]}"; do append_if_needed "$f" "$JS_PATCH"; done

SW="$REPO/public/fusion-sw-sistema.js"
test -f "$SW" || { echo "Arquivo ausente: public/fusion-sw-sistema.js" >&2; exit 1; }
if grep -Eq 'fusion-sistema-v280|fusion-sistema-v281-scroll' "$SW"; then
  backup_file "public/fusion-sw-sistema.js"
  cp "$HERE/public/fusion-sw-sistema.js" "$SW"
  echo "Service Worker atualizado."
else
  echo "AVISO: Service Worker diferente da versão lida; compare manualmente."
fi

echo
echo "Correção aplicada. Backup em: $BACKUP"
echo "Depois faça deploy, feche o PWA e abra novamente."
