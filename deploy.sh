#!/bin/bash
set -euo pipefail

APP_DIR="/opt/promaster-arena"
WEB_DIR="$APP_DIR/apps/web"
PUBLIC_DIR="/var/www/promaster"
BRANCH="main"

cd "$APP_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "Deploy bloqueado: branch atual '$CURRENT_BRANCH'. O deploy oficial usa apenas '$BRANCH'."
  echo "Use scripts/save-emergency-state.sh antes de qualquer correcao emergencial na VPS."
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Deploy bloqueado: existem alteracoes locais rastreadas na VPS."
  echo "Salve em um branch de emergencia antes: ./scripts/save-emergency-state.sh"
  git status --short
  exit 1
fi

git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm install
npx prisma generate
npx prisma migrate deploy

cd "$WEB_DIR"
npm install
npm run build

mkdir -p "$PUBLIC_DIR"
rm -rf "$PUBLIC_DIR"/*
cp -r "$WEB_DIR"/dist/* "$PUBLIC_DIR"/

cd "$APP_DIR"
pm2 restart promaster-api --update-env
nginx -t
systemctl reload nginx

curl -fsS http://localhost:3000/ > /dev/null

echo "Deploy ProMaster Arena concluido a partir do branch main."
