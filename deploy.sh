#!/bin/bash
set -e

cd /opt/promaster-arena

git pull --ff-only origin main

npm install
npx prisma generate
npx prisma migrate deploy

cd apps/web
npm install
npm run build

sudo mkdir -p /var/www/promaster
sudo rm -rf /var/www/promaster/*
sudo cp -r dist/* /var/www/promaster/

pm2 restart promaster-api
sudo nginx -t
sudo systemctl reload nginx

echo "Deploy ProMaster Arena concluido"
