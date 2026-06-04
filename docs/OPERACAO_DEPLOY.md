# Operacao e deploy do ProMaster Arena

## Fonte oficial

O branch oficial do projeto e `main` no GitHub.

Regras:

- Desenvolvimento deve entrar por branch e depois ser integrado ao `main`.
- A VPS nao deve ser editada diretamente em operacao normal.
- Deploy oficial sempre parte do `main`.
- Alteracao feita direto na VPS e considerada emergencia e precisa ser salva em branch proprio antes de continuar.
- Homologacao usa branch e deploy separados. Veja `docs/HOMOLOGACAO.md`.

## Deploy normal

Na VPS:

```bash
cd /opt/promaster-arena
./deploy.sh
```

Antes de atualizar o codigo, o deploy cria backup automatico em:

```text
/opt/promaster-backups/producao/
```

O backup inclui:

- dump do PostgreSQL;
- pasta `uploads`;
- `.env` local protegido no diretorio de backup;
- manifest com branch, commit e status do Git.

O script bloqueia o deploy se:

- a VPS nao estiver no branch `main`;
- houver alteracoes locais rastreadas;
- o `main` remoto exigir merge manual.

## Deploy emergencial

Use apenas quando a producao precisar de correcao imediata.

Antes de editar qualquer arquivo na VPS:

```bash
cd /opt/promaster-arena
./scripts/save-emergency-state.sh
```

Depois da correcao emergencial:

```bash
cd /opt/promaster-arena
node --check index.js
cd apps/web
npm run build
cd ../..
./scripts/save-emergency-state.sh
./deploy.sh
```

Depois da emergencia:

- abrir PR do branch `emergencia-vps-*` para `main`, ou
- reaplicar a correcao em um branch normal e integrar ao `main`.

## Backup manual

Quando quiser salvar o estado da VPS sem publicar nada:

```bash
cd /opt/promaster-arena
bash ./scripts/backup-vps-state.sh producao
```

Por padrao, backups com mais de 14 dias sao removidos. Para alterar:

```bash
KEEP_DAYS=30 bash ./scripts/backup-vps-state.sh producao
```

## Checklist antes de publicar

```bash
node --check index.js
npx prisma validate
cd apps/web
npm run build
```

## Checklist depois de publicar

```bash
pm2 status
curl -k https://localhost/api/
```

Teste no navegador:

- homepage;
- login;
- criar torneio;
- inscricao publica;
- painel do torneio;
- telao;
- modo arbitro.
