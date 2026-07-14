# Workflows n8n

O n8n é um executor interno. Operadores usam o painel Ávila Ops; somente um
administrador acessa o editor do n8n para a configuração inicial.

## Credenciais obrigatórias

- `Porkbun SMTP`: SMTP com TLS/STARTTLS, configurada no cofre de credenciais do n8n.
- `Ávila Platform`: Header Auth com `Authorization: Bearer <N8N_INGEST_TOKEN>`.

Nunca coloque senhas nos arquivos de workflow. O segredo de entrega é lido da
variável `N8N_WEBHOOK_SECRET` no servidor.

## Ordem de ativação

1. Importe `collect-rss.json` e `deliver-approved-email.json`.
2. Selecione as credenciais nos nós marcados.
3. Execute cada workflow manualmente com dados de teste.
4. Confirme que a coleta cria somente um artigo ao repetir o mesmo item.
5. Confirme que a entrega rejeita um segredo incorreto.
6. Ative primeiro a coleta.
7. Ative a entrega, configure o webhook na plataforma e só então altere
   `DELIVERY_ENABLED=true`.
