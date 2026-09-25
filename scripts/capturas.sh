#!/usr/bin/env bash
# Regenerates the model screenshots used on the home page (assets/demos/<ramo>.webp).
# Needs the site served at BASE_URL (default http://127.0.0.1:8811) and cwebp installed.
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:8811}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT_DIR="$SITE_DIR/assets/demos"
MODELS=(cardapio bar cafe fisioterapia veterinaria pousada hotel barbearia planejados)
WEBP_QUALITY=78

mkdir -p "$OUT_DIR"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

for model in "${MODELS[@]}"; do
  if [[ ! -f "$SITE_DIR/demos/$model/index.html" ]]; then
    echo "skip $model: demos/$model/index.html does not exist yet"
    continue
  fi
  png="$tmp_dir/$model.png"
  # Reduced motion shows every page in its final state; the virtual time budget lets fonts and images settle.
  "$CHROME" --headless=new --hide-scrollbars --window-size=1440,900 \
    --force-prefers-reduced-motion --virtual-time-budget=6000 --screenshot="$png" "$BASE_URL/demos/$model/" >/dev/null 2>&1
  cwebp -quiet -q "$WEBP_QUALITY" "$png" -o "$OUT_DIR/$model.webp"
  echo "ok $model -> assets/demos/$model.webp"
done
