# Migracao PlayFinal

## Estado da marca

- Marca nova: PlayFinal Arena.
- Dominio contratado: `www.playfinal.com.br`.
- E-mail operacional contratado: `contato@playfinal.com.br`.
- Provedor de e-mail: Google Workspace.

## Principio de migracao segura

1. Publicar primeiro em homologacao.
2. Validar links de cadastro, login, WhatsApp, e-mail e pagamentos.
3. So depois promover para producao.
4. Nao remover a estrutura antiga de VPS antes de confirmar rollback.

## Etapa 1 - Aplicacao

- Atualizar marca visual do frontend.
- Atualizar textos publicos, telao, paginas de cadastro e paineis.
- Atualizar favicon e assets visuais.
- Atualizar mensagens da API, e-mails e WhatsApp para PlayFinal Arena.
- Manter nomes internos de banco, PM2 e pastas de deploy ate a etapa de infraestrutura.

## Etapa 2 - Variaveis de ambiente na VPS

Atualizar nos ambientes correspondentes, sem versionar segredos:

```text
APP_URL=https://www.playfinal.com.br
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=PlayFinal <avisos@notificacoes.playfinal.com.br>
EMAIL_REPLY_TO=suporte@playfinal.com.br
SUPPORT_EMAIL=suporte@playfinal.com.br
```

Homologacao deve usar dominio proprio de teste quando definido. Se ainda nao houver subdominio PlayFinal de homologacao, manter o dominio atual de teste ate o DNS novo ser criado.

## Etapa 2.1 - E-mail humano e e-mail transacional

A arquitetura de e-mail da PlayFinal deve ser hibrida:

- Google Workspace / Gmail: caixas humanas, atendimento e respostas.
- Resend: envio automatico transacional da plataforma.

Caixas humanas no Google Workspace:

- `contato@playfinal.com.br`
- `suporte@playfinal.com.br`
- `financeiro@playfinal.com.br`
- `admin@playfinal.com.br`
- `comercial@playfinal.com.br`

Remetente automatico recomendado:

```text
From: PlayFinal <avisos@notificacoes.playfinal.com.br>
Reply-To: suporte@playfinal.com.br
```

Assim, a plataforma envia por API pelo Resend, mas qualquer resposta do usuario cai na caixa humana do suporte no Google Workspace.

## Etapa 3 - DNS e Nginx

- Apontar `www.playfinal.com.br` para a VPS.
- Criar/ajustar `server_name` no Nginx para o novo dominio.
- Emitir certificado TLS para `www.playfinal.com.br`.
- Validar `nginx -t`.
- Recarregar Nginx.

## Etapa 4 - Integracoes

- Google Workspace: manter MX principal do dominio para recebimento humano.
- Resend: validar dominio/subdominio de envio `notificacoes.playfinal.com.br`.
- DNS: nao misturar o MX do Google com o subdominio de envio transacional.
- Google Workspace: validar SPF, DKIM e DMARC do dominio principal.
- Resend: validar SPF/DKIM/DMARC ou registros equivalentes exigidos pelo painel do Resend para o subdominio.
- Evolution/WhatsApp: revisar nome da instancia, mensagens e links enviados.
- Mercado Pago: revisar nome dos itens, URLs de retorno e webhooks.

Eventos transacionais previstos para Resend:

- Confirmacao de cadastro.
- Recuperacao de senha.
- Confirmacao de inscricao no torneio.
- Pagamento aprovado ou recusado.
- Jogo agendado.
- Chamada de jogador.
- Aviso de WO.
- Resultado de partida.
- Atualizacao de chaveamento.
- Convite para organizador, operador ou arbitro.
- Comunicados automaticos da plataforma.

## Etapa 5 - Validacao

- `npm run build` no frontend.
- `node --check index.js`.
- Login.
- Cadastro de organizador.
- Cadastro de jogador.
- Link de validacao por e-mail.
- Link de validacao por WhatsApp.
- Criacao de torneio.
- Pagina publica.
- Telao.
- Modo arbitro.

## Pontos mantidos temporariamente

Os nomes abaixo podem continuar antigos durante a primeira publicacao para reduzir risco operacional:

- Pastas `/opt/promaster-arena` e `/var/www/promaster`.
- Processo PM2 `promaster-api`.
- Banco `promaster`.
- Backups em `/opt/promaster-backups`.

Esses nomes devem ser migrados somente em janela propria, com backup e plano de rollback.
