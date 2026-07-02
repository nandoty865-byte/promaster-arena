#!/bin/bash
set -euo pipefail

APP_DIR="/opt/promaster-arena"
WEB_DIR="$APP_DIR/apps/web"
PUBLIC_DIR="/var/www/promaster"
BRANCH="main"
BACKUP_SCRIPT="$APP_DIR/scripts/backup-vps-state.sh"
API_HEALTH_URL="http://localhost:3000/"
API_HEALTH_ATTEMPTS=20

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

if [ -f "$BACKUP_SCRIPT" ]; then
  bash "$BACKUP_SCRIPT" producao
else
  echo "Aviso: backup automatico indisponivel nesta versao do codigo."
fi

git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci
npx prisma generate
npx prisma migrate deploy

cd "$WEB_DIR"
npm ci
npm run build

mkdir -p "$PUBLIC_DIR"
rm -rf "$PUBLIC_DIR"/*
cp -r "$WEB_DIR"/dist/* "$PUBLIC_DIR"/

cd "$APP_DIR"
pm2 restart promaster-api --update-env
nginx -t
systemctl reload nginx

echo "Aguardando API responder..."
for attempt in $(seq 1 "$API_HEALTH_ATTEMPTS"); do
  if curl -fsS "$API_HEALTH_URL" > /dev/null; then
    echo "API online."
    break
  fi

  if [ "$attempt" -eq "$API_HEALTH_ATTEMPTS" ]; then
    echo "Deploy falhou: API nao respondeu em $API_HEALTH_ATTEMPTS segundos."
    pm2 status promaster-api || true
    exit 1
  fi

  sleep 1
done

echo "Deploy ProMaster Arena concluido a partir do branch main."
