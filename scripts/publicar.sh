#!/usr/bin/env bash
# Publishes the last commit, never the working tree: files that exist only on
# this Mac (untracked demos, briefings, test results) cannot reach the site.
#   scripts/publicar.sh <branch>        main = production, anything else = preview
#   scripts/publicar.sh <branch> --dry  only builds the folder and prints its path
set -euo pipefail

BRANCH="${1:?usage: scripts/publicar.sh <branch> [--dry]}"
DRY_RUN="${2:-}"
PROJECT="tarciodiniz"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
NOT_PUBLIC=(README.md package.json package-lock.json .gitignore scripts functions)

shopt -s nullglob dotglob
OUT="$(mktemp -d)"
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$OUT"
mkdir "$OUT/public"
for entry in "$OUT"/*; do
  name="$(basename "$entry")"
  [[ "$name" == "public" || "$name" == "functions" ]] && continue
  if [[ " ${NOT_PUBLIC[*]} " == *" $name "* ]]; then
    rm -rf "$entry"
  else
    mv "$entry" "$OUT/public/"
  fi
done

echo "commit $(git -C "$REPO_ROOT" rev-parse --short HEAD) montado em $OUT"
if [[ "$DRY_RUN" == "--dry" ]]; then
  exit 0
fi

cd "$OUT"
npx wrangler pages deploy public --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
