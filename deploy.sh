#!/bin/bash
cd /opt/promaster-arena

git pull origin main

npm install

cd apps/web
npm install
npm run build

rm -rf /var/www/promaster/*
cp -r dist/* /var/www/promaster/

systemctl restart nginx

echo "Deploy ProMaster Arena concluído"
