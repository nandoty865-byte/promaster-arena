# Automacao de desenvolvimento

Este documento registra o primeiro passo para reduzir verificacoes manuais no PlayFinal.

## Automacao criada

O workflow `.github/workflows/ci.yml` roda em:

- pull requests para `homologacao` e `main`;
- pushes em `homologacao` e `main`;
- execucao manual pelo GitHub Actions.

Ele verifica:

- sintaxe da API com `node --check index.js`;
- schema Prisma com `npx prisma validate`;
- build do frontend com `npm --prefix apps/web run build`;
- lint do frontend em modo informativo.

O lint esta como informativo porque atualmente existem erros antigos no frontend. Assim, a automacao ja mostra o problema sem bloquear deploys ate a limpeza gradual.

## Deploy automatico de homologacao

O workflow `.github/workflows/deploy-homologacao.yml` publica a homologacao quando o workflow de verificacoes termina com sucesso na branch `homologacao`.

Ele tambem pode ser executado manualmente pelo GitHub Actions.

Enquanto os segredos SSH nao estiverem cadastrados, o workflow apenas registra um aviso e ignora o deploy.

Segredos necessarios no GitHub:

- `HOMOLOG_SSH_HOST`: IP ou host da VPS;
- `HOMOLOG_SSH_USER`: usuario SSH;
- `HOMOLOG_SSH_KEY`: chave privada SSH;
- `HOMOLOG_APP_DIR`: normalmente `/opt/promaster-arena-homolog`.

Com esses segredos, o deploy de homologacao pode executar:

```bash
cd /opt/promaster-arena-homolog
./deploy-staging.sh
```

Producao deve continuar com aprovacao manual antes de rodar `./deploy.sh`.

## Como cadastrar os segredos

No GitHub:

1. Abrir o repositorio.
2. Entrar em `Settings`.
3. Entrar em `Secrets and variables` > `Actions`.
4. Criar os segredos listados acima.

O usuario SSH precisa conseguir acessar a VPS e rodar o `deploy-staging.sh` com as permissoes necessarias para:

- atualizar o repositorio em `/opt/promaster-arena-homolog`;
- instalar dependencias;
- rodar migrations;
- copiar o build para `/var/www/promaster-homolog`;
- reiniciar o PM2;
- validar e recarregar o Nginx.

## Entraves conhecidos

- `npm --prefix apps/web run lint` ainda falha com erros existentes.
- O CI usa uma `DATABASE_URL` temporaria apenas para validar o schema Prisma.
- Deploy automatico por SSH depende de chave instalada no GitHub e autorizada na VPS.
- Se o usuario SSH nao tiver permissao para PM2, Nginx ou `/var/www/promaster-homolog`, o deploy de homologacao vai falhar.
- Uploads ainda ficam na pasta `uploads` da VPS, entao backups continuam maiores ate migrar arquivos para R2/CDN.

## Segredos de integracoes

As chaves de API da plataforma devem ser cadastradas em `SuperAdmin > Integracoes`.

Campos sensiveis como `apiKey`, `secret`, `token`, `password`, `private` e `credential` sao criptografados antes de salvar no banco e voltam para a tela apenas mascarados.

Variavel recomendada no `.env` da VPS:

```text
INTEGRATION_ENCRYPTION_KEY=gerar-uma-chave-longa-e-exclusiva
```

Essa chave mestra nao deve ser cadastrada na tela da plataforma. Ela precisa ficar no `.env` da VPS e no backup seguro do ambiente.
