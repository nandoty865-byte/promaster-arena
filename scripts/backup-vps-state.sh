#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_NAME="${1:-${ENV_NAME:-producao}}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/promaster-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$ENV_NAME/$STAMP"
ENV_FILE="$APP_DIR/.env"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT/$ENV_NAME" "$BACKUP_DIR" 2>/dev/null || true

cd "$APP_DIR"

{
  echo "ambiente=$ENV_NAME"
  echo "data=$STAMP"
  echo "app_dir=$APP_DIR"
  echo "branch=$(git branch --show-current 2>/dev/null || echo desconhecido)"
  echo "commit=$(git rev-parse HEAD 2>/dev/null || echo desconhecido)"
  echo
  echo "status_git:"
  git status --short 2>/dev/null || true
} > "$BACKUP_DIR/manifest.txt"

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_DIR/env.backup"
  chmod 600 "$BACKUP_DIR/env.backup" 2>/dev/null || true
fi

DATABASE_URL=""
if [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DATABASE_URL="${DATABASE_URL%\"}"
  DATABASE_URL="${DATABASE_URL#\"}"
  DATABASE_URL="${DATABASE_URL%\'}"
  DATABASE_URL="${DATABASE_URL#\'}"
fi

if [ -n "$DATABASE_URL" ] && command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" --format=custom --file="$BACKUP_DIR/database.dump"
else
  echo "Backup do banco ignorado: DATABASE_URL ausente ou pg_dump nao encontrado." >> "$BACKUP_DIR/manifest.txt"
fi

if [ -d "$APP_DIR/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads.tar.gz" -C "$APP_DIR" uploads
else
  echo "Backup de uploads ignorado: pasta uploads nao encontrada." >> "$BACKUP_DIR/manifest.txt"
fi

if [ -d "$APP_DIR/apps/web/dist" ]; then
  tar -czf "$BACKUP_DIR/web-dist.tar.gz" -C "$APP_DIR/apps/web" dist
fi

chmod -R go-rwx "$BACKUP_DIR" 2>/dev/null || true

if [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] && [ "$KEEP_DAYS" -gt 0 ]; then
  find "$BACKUP_ROOT/$ENV_NAME" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -print -exec rm -rf {} \; || true
fi

echo "Backup salvo em $BACKUP_DIR"
