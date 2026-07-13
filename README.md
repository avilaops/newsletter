# Ávila Ops Newsletters

Plataforma no-code para coletar notícias com n8n, montar newsletters, revisar o
e-mail renderizado e exigir aprovação humana antes de qualquer entrega.

## Fluxo protegido

```text
fonte -> coleta n8n -> conteúdo -> campanha -> revisão humana
      -> aprovação por hash -> audiência congelada -> fila -> n8n -> SMTP
```

- Uma edição posterior devolve a campanha para rascunho e invalida a aprovação.
- Destinatários são congelados por campanha e hash no enfileiramento.
- O worker só chama o n8n quando `DELIVERY_ENABLED=true`.
- Coleta e entrega usam segredos diferentes.
- A senha SMTP existe somente no cofre de credenciais do n8n.

## Executar localmente

Copie `.env.example` para `.env`, substitua todos os valores de exemplo e rode:

```powershell
docker compose up --build
```

Serviços locais:

- painel/API: `http://localhost:3000`
- n8n: `http://localhost:5678`
- PostgreSQL da plataforma: `localhost:5433`

O envio continua bloqueado por padrão. Os workflows importáveis e a ordem de
ativação ficam em `n8n/`.

## Validação

```powershell
npm run check
docker compose config --quiet
```

O `Dockerfile` executa as migrações antes de iniciar a API. Cada migração é
registrada em `schema_migrations` e pode ser reaplicada sem repetir alterações.

## Deploy no Render

`render.yaml` descreve a API, o n8n e dois bancos PostgreSQL isolados. O deploy
inicial mantém `DELIVERY_ENABLED=false`; o worker não deve ser publicado antes
da validação manual do workflow SMTP.

Os bancos gratuitos do Render são adequados somente para homologação e expiram
depois do período definido pelo provedor. Para produção contínua, migre as duas
URLs PostgreSQL para Neon ou selecione planos persistentes no Render.

## Templates legados

Os templates responsivos em `src/templates` continuam disponíveis para prévia.
Os comandos `templates:plan` e `templates:sync` são legados do MailerSend e não
participam da entrega n8n/SMTP.

Nunca grave tokens, senhas SMTP ou URLs com credenciais no Git.
