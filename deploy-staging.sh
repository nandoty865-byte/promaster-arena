#!/bin/bash
set -euo pipefail

APP_DIR="/opt/promaster-arena-homolog"
WEB_DIR="$APP_DIR/apps/web"
PUBLIC_DIR="/var/www/promaster-homolog"
BRANCH="homologacao"
PM2_APP="promaster-api-homolog"
API_PORT="3001"
BACKUP_SCRIPT="$APP_DIR/scripts/backup-vps-state.sh"
API_HEALTH_URL="http://localhost:${API_PORT}/"
API_HEALTH_ATTEMPTS=20

cd "$APP_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Deploy bloqueado: arquivo .env nao encontrado em $APP_DIR."
  echo "Crie o .env de homologacao antes do primeiro deploy."
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "Deploy bloqueado: branch atual '$CURRENT_BRANCH'. Homologacao usa apenas '$BRANCH'."
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Deploy bloqueado: existem alteracoes locais rastreadas na homologacao."
  git status --short
  exit 1
fi

if [ -f "$BACKUP_SCRIPT" ]; then
  bash "$BACKUP_SCRIPT" homologacao
else
  echo "Aviso: backup automatico indisponivel nesta versao do codigo."
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
export PORT="$API_PORT"

if pm2 describe "$PM2_APP" > /dev/null; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start index.js --name "$PM2_APP"
fi

nginx -t
systemctl reload nginx

echo "Aguardando API de homologacao responder..."
for attempt in $(seq 1 "$API_HEALTH_ATTEMPTS"); do
  if curl -fsS "$API_HEALTH_URL" > /dev/null; then
    echo "API de homologacao online."
    break
  fi

  if [ "$attempt" -eq "$API_HEALTH_ATTEMPTS" ]; then
    echo "Deploy de homologacao falhou: API nao respondeu em $API_HEALTH_ATTEMPTS segundos."
    pm2 status "$PM2_APP" || true
    exit 1
  fi

  sleep 1
done

echo "Deploy de homologacao concluido a partir do branch $BRANCH."
