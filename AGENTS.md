# PlayFinal / antigo ProMaster Arena

Este e o mapa oficial do projeto para orientar o Codex.

## Repositorio Git
origin: https://github.com/nandoty865-byte/promaster-arena.git

## Pasta correta no PC
C:\Users\nando\Documents\Codex\2026-05-05\estou-desenvolvendo-junto-ao-chatgpt-plataforma\promaster-arena-working

## Branches
- homologacao: desenvolvimento/testes
- main: producao
- Nao trabalhar em projectless workspace
- Nao trabalhar em pasta troubleshooting sem .git

## VPS
Producao codigo fonte:
- /opt/promaster-arena
- branch: main

Homologacao codigo fonte:
- /opt/promaster-arena-homolog
- branch: homologacao

Pasta publica producao servida pelo Nginx:
- /var/www/promaster

Pasta publica homologacao:
- /var/www/promaster-homolog

## Build web
O build nao roda na raiz.
Comando correto:
npm --prefix apps/web run build

Pasta gerada:
apps/web/dist

## Deploy producao
1. cd /opt/promaster-arena
2. git fetch origin
3. git checkout main
4. git pull --ff-only origin main
5. npm --prefix apps/web install
6. npm --prefix apps/web run build
7. sudo cp -a /var/www/promaster "/var/www/promaster-backup-$(date +%Y%m%d-%H%M%S)"
8. sudo rsync -a --delete apps/web/dist/ /var/www/promaster/
9. sudo chown -R www-data:www-data /var/www/promaster
10. sudo nginx -t
11. sudo systemctl reload nginx

## Regras de seguranca
Antes de qualquer alteracao, sempre rodar:
- pwd
- git status
- git branch --show-current
- git log --oneline --decorate -5

Nunca rodar sem autorizacao:
- git reset --hard
- git clean -fd
- rm -rf
- deploy producao
- rsync para /var/www/promaster
