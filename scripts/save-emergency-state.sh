#!/bin/bash
set -euo pipefail

APP_DIR="/opt/promaster-arena"
STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="emergencia-vps-$STAMP"

cd "$APP_DIR"

git checkout -b "$BRANCH"

git add \
  deploy.sh \
  index.js \
  package.json \
  package-lock.json \
  prisma/schema.prisma \
  prisma/migrations \
  apps/web/package.json \
  apps/web/package-lock.json \
  apps/web/src/App.tsx \
  apps/web/src/App.css

if git diff --cached --quiet; then
  echo "Nenhuma alteracao rastreavel para salvar."
else
  git commit -m "Salva estado emergencial da VPS $STAMP"
  git push origin HEAD:"$BRANCH"
  echo "Estado emergencial salvo no GitHub: $BRANCH"
fi

echo "Depois da emergencia, abra PR para main ou aplique a correcao novamente em main."
