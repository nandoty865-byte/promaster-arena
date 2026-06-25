# Migracao PlayFinal

Mapa limpo para continuar a migracao do antigo ProMaster Arena para PlayFinal Arena.

## Estado atual

- Textos publicos e codigo de interface: sem ocorrencias de marca ProMaster encontradas depois da limpeza dos assets legados.
- Scripts e documentacao operacional ainda usam `promaster` em paths, PM2, repo e instrucoes de deploy. Isso e esperado por enquanto.
- Arquivo antigo `promaster-referencias.txt`: removido por estar poluido com referencias repetidas a ele mesmo.
- Branch de trabalho para novas alteracoes: `homologacao`.

## Pendencias encontradas

Arquivos versionados com nome legado:

- `prisma/migrations/20260426215233_init_promaster/migration.sql`

Arquivos operacionais com nome legado que devem ser mantidos por enquanto:

- `AGENTS.md`
- `deploy.sh`
- `deploy-staging.sh`
- `docs/OPERACAO_DEPLOY.md`

## Etapas concluidas nesta revisao

- Removido `promaster-referencias.txt`, que estava fora do Git e poluido com referencias repetidas.
- Removidos assets publicos legados sem uso:
  - `apps/web/public/promaster-hero-broadcast.png`
  - `apps/web/public/promaster-logo.jpeg`
  - `apps/web/public/promaster-logo-novo.png`
  - `apps/web/public/promaster-telao-reference.png`
- Removida configuracao Apache legada sem uso:
  - `apps/web/promaster.conf`

## Classificacao segura

### Manter por historico

- `prisma/migrations/20260426215233_init_promaster/migration.sql`

Motivo:

- Migration ja aplicada deve permanecer imutavel.
- Renomear migrations antigas pode quebrar historico do Prisma em bancos existentes.

## Itens que devem continuar com nome promaster por enquanto

Infraestrutura operacional ainda usa esses nomes:

- Repositorio Git: `promaster-arena`
- VPS producao: `/opt/promaster-arena`
- VPS homologacao: `/opt/promaster-arena-homolog`
- Publico producao: `/var/www/promaster`
- Publico homologacao: `/var/www/promaster-homolog`
- PM2 producao: `promaster-api`
- PM2 homologacao: `promaster-api-homolog`

Arquivos relacionados:

- `AGENTS.md`
- `deploy.sh`
- `deploy-staging.sh`
- `docs/OPERACAO_DEPLOY.md`

Regra segura:

- Nao renomear paths, PM2, repo ou scripts de deploy junto com ajustes visuais.
- Renomear infraestrutura somente em uma janela propria, com backup e plano de rollback.

## Proximo passo recomendado

1. Manter migration antiga sem alterar.
2. Depois abrir uma etapa separada para eventual renomeacao operacional de paths/PM2.

## Comandos de auditoria

```bash
git grep -n -i -E "promaster|pro master|pro-master" -- .
rg --files -g "*promaster*" -g "*ProMaster*" -g "!node_modules" -g "!apps/web/dist" -g "!.git" -g "!*.log" -g "!*.err.log"
```
