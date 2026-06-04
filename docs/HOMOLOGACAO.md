# Ambiente de homologacao

Objetivo: testar novas versoes em `teste.promasterarena.com.br` sem tocar na producao.

## Ambientes

| Ambiente | Dominio | Branch | Pasta app | Pasta web | API | PM2 | Banco |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Producao | `app.promasterarena.com.br` | `main` | `/opt/promaster-arena` | `/var/www/promaster` | `3000` | `promaster-api` | `promaster` |
| Homologacao | `teste.promasterarena.com.br` | `homologacao` | `/opt/promaster-arena-homolog` | `/var/www/promaster-homolog` | `3001` | `promaster-api-homolog` | `promaster_homolog` |

## Regras

- Producao publica somente pelo branch `main`.
- Homologacao publica somente pelo branch `homologacao`.
- Homologacao usa banco separado.
- Homologacao usa `.env` proprio.
- Nao usar tokens de pagamento reais na homologacao, salvo quando o teste exigir.
- E-mails e WhatsApp de homologacao devem ser enviados apenas para contatos de teste.

## DNS

Criar registros `A` apontando para o IP da VPS:

```text
app.promasterarena.com.br    A    IP_DA_VPS
teste.promasterarena.com.br  A    IP_DA_VPS
```

## Branch de homologacao

Uma vez no computador local:

```bash
git checkout main
git pull origin main
git checkout -b homologacao
git push -u origin homologacao
```

Depois, toda funcao nova entra primeiro em `homologacao`. Quando aprovada, abre PR para `main`.

## Banco de homologacao

Na VPS:

```bash
sudo -u postgres createdb promaster_homolog
```

Se usar usuario e senha especificos, criar tambem o usuario PostgreSQL e ajustar a `DATABASE_URL` do `.env`.

## Primeira instalacao na VPS

```bash
cd /opt
git clone git@github.com:nandoty865-byte/promaster-arena.git promaster-arena-homolog
cd /opt/promaster-arena-homolog
git checkout homologacao
cp .env.example .env 2>/dev/null || touch .env
nano .env
```

Variaveis minimas do `.env` de homologacao:

```text
NODE_ENV=staging
PORT=3001
APP_URL=https://teste.promasterarena.com.br
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/promaster_homolog
JWT_SECRET=trocar-por-chave-forte-de-homologacao
```

Adicionar tambem as chaves de Resend, Evolution, Mercado Pago sandbox e demais integracoes quando forem testadas.

## Nginx

Criar `/etc/nginx/sites-available/promaster-homologacao`:

```nginx
server {
    listen 80;
    server_name teste.promasterarena.com.br;

    root /var/www/promaster-homolog;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/promaster-homologacao /etc/nginx/sites-enabled/promaster-homologacao
sudo nginx -t
sudo systemctl reload nginx
```

Certificado:

```bash
sudo certbot --nginx -d teste.promasterarena.com.br
```

## Deploy de homologacao

Na VPS:

```bash
cd /opt/promaster-arena-homolog
chmod +x deploy-staging.sh
./deploy-staging.sh
pm2 save
```

Antes de atualizar a homologacao, o deploy cria backup automatico em:

```text
/opt/promaster-backups/homologacao/
```

Validacao:

```bash
pm2 status
curl -k https://teste.promasterarena.com.br/api/
```

Resposta esperada:

```text
ProMaster Arena API online
```

## Fluxo recomendado

1. Desenvolver em branch de feature.
2. Abrir PR para `homologacao`.
3. Publicar `teste.promasterarena.com.br`.
4. Testar login, criacao de torneio, inscricao publica, telao, arbitro e pagamentos.
5. Quando aprovado, abrir PR de `homologacao` para `main`.
6. Publicar producao com `./deploy.sh`.
