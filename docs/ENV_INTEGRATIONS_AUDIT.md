# Auditoria de variáveis e integrações

## Resumo
- Data e hora da auditoria: 2026-07-14 01:34:10 -03:00
- Arquivos analisados: .env.local, .env.production
- Quantidade total de variáveis encontradas: 65 declarações em arquivos de ambiente; 58 nomes únicos
- Quantidade total de ferramentas identificadas: 12
- Quantidade de ferramentas referenciadas no código: 4
- Quantidade de ferramentas com conectividade validada: 2
- Quantidade de variáveis não utilizadas: 24
- Quantidade de variáveis ausentes: 7
- Quantidade de inconsistências encontradas: 31
- Total de ferramentas testadas: 2
- Total de ferramentas funcionais: 2

## Ferramentas disponíveis

| Ferramenta | Variáveis relacionadas | Ambiente | Referenciada no código | Arquivos de referência | Teste realizado | Status |
|---|---|---|---|---|---|---|
| Avila Newsletters API | ADMIN_API_TOKEN, APP_BIND_ADDRESS, APP_PORT, DELIVERY_ENABLED, HOST, PORT, WORKER_LOCK_TIMEOUT_MS, WORKER_POLL_MS | .env.production | Sim | docker-compose.yml, render.yaml, README.md, n8n\README.md, src\platform\config.mjs, src\platform\server.mjs, src\platform\run-worker.mjs, src\platform\worker.mjs, test\delivery\worker.test.mjs | docker compose config; npm run check | Conectividade validada |
| PostgreSQL plataforma | DATABASE_URL, POSTGRES_BIND_ADDRESS, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER | .env.local, .env.production | Sim | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\migrate.mjs, src\platform\run-worker.mjs, src\platform\server.mjs | docker compose config; npm run check | Conectividade validada |
| n8n | DB_POSTGRESDB_DATABASE, DB_POSTGRESDB_HOST, DB_POSTGRESDB_PASSWORD, DB_POSTGRESDB_PORT, DB_POSTGRESDB_USER, DB_TYPE, GENERIC_TIMEZONE, N8N_BIND_ADDRESS, N8N_DELIVERY_WEBHOOK_URL, N8N_ENCRYPTION_KEY, N8N_INGEST_TOKEN, N8N_PORT, N8N_POSTGRES_DB, N8N_POSTGRES_PASSWORD, N8N_POSTGRES_USER, N8N_SECURE_COOKIE, N8N_WEBHOOK_SECRET, PLATFORM_API_URL, SMTP_FROM_EMAIL, TZ | .env.production | Sim | docker-compose.yml, render.yaml, n8n\README.md, n8n\workflows\collect-rss.json, n8n\workflows\deliver-approved-email.json, src\platform\config.mjs, src\platform\run-worker.mjs, src\platform\server.mjs | docker compose config; npm run check | Conectividade validada |
| MailerSend legado | MAILERSEND_DOMAIN_ID, MAILERSEND_TEMPLATE_API_TOKEN | Ausente dos arquivos analisados | Sim | scripts\sync-mailersend-templates.mjs | Não realizado | Referenciada, mas não configurada |
| Render | RENDER_API_KEY, RENDER_DEPLOY_HOOK, NODE_ENV | .env.local; NODE_ENV apenas em render.yaml | Sim, apenas em configuração | render.yaml | Não realizado | Teste não seguro ou não disponível |
| Cloudflare | CLOUDFLARE_API_GLOBAL_KEY, CLOUDFLARE_TOKEN, CLOUDFLARE_WORKER_AI | .env.production | Não | - | Não realizado | Configurada, mas não referenciada |
| Medusa | ADMIN_CORS, AUTH_CORS, COOKIE_SECRET, JWT_SECRET, NEXT_PUBLIC_MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, STORE_CORS | .env.local, .env.production | Não | - | Não realizado | Configurada, mas não referenciada |
| Neon | NEON_API_KEY_PROD | .env.local, .env.production | Não | - | Não realizado | Configurada, mas não referenciada |
| PayPal | PAYPAL_ID, PAYPAL_TOKEN_API | .env.production | Não | - | Não realizado | Configurada, mas não referenciada |
| Redis | REDIS_PORT, REDIS_URL | .env.local | Não | - | Não realizado | Configurada, mas não referenciada |
| X/Twitter | X_BEARER_DEVELOPMENT_TOKEN, X_BEARER_PRODUCTION_TOKEN, X_CONSUMER_DEVELOPMENT_KEY, X_CONSUMER_PRODUCTION_KEY, X_SECRET_DEVELOPMENT_KEY, X_SECRET_PRODUCTION_KEY | .env.local | Não | - | Não realizado | Configurada, mas não referenciada |
| Gravatar | GRAVATAR | .env.production | Não | - | Não realizado | Configurada, mas não referenciada |

## Inventário de variáveis

| Variável | Arquivo de origem | Ferramenta | Referenciada | Quantidade de referências | Arquivos | Situação |
|---|---|---|---|---:|---|---|
| ADMIN_API_TOKEN | .env.production | Avila Newsletters API | Sim | 4 | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\server.mjs | Referenciada e utilizada |
| ADMIN_CORS | .env.local | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| APP_BIND_ADDRESS | .env.production | Avila Newsletters API | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| APP_PORT | .env.production | Avila Newsletters API | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| AUTH_CORS | .env.local | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| CLOUDFLARE_API_GLOBAL_KEY | .env.production | Cloudflare | Não | 0 | - | Declarada, mas não encontrada no código |
| CLOUDFLARE_TOKEN | .env.production | Cloudflare | Não | 0 | - | Declarada, mas não encontrada no código |
| CLOUDFLARE_WORKER_AI | .env.production | Cloudflare | Não | 0 | - | Declarada, mas não encontrada no código |
| COOKIE_SECRET | .env.local | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| DATABASE_URL | .env.production | PostgreSQL plataforma | Sim | 9 | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\migrate.mjs, src\platform\run-worker.mjs, src\platform\server.mjs | Referenciada e utilizada |
| DB_POSTGRESDB_DATABASE | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DB_POSTGRESDB_HOST | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DB_POSTGRESDB_PASSWORD | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DB_POSTGRESDB_PORT | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DB_POSTGRESDB_USER | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DB_TYPE | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| DELIVERY_ENABLED | .env.production | Avila Newsletters API | Sim | 16 | docker-compose.yml, README.md, n8n\README.md, render.yaml, src\platform\config.mjs, src\platform\run-worker.mjs, src\platform\server.mjs, src\platform\worker.mjs, test\delivery\worker.test.mjs | Referenciada e utilizada |
| GENERIC_TIMEZONE | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| GRAVATAR | .env.production | Gravatar | Não | 0 | - | Declarada, mas não encontrada no código |
| HOST | .env.production | Avila Newsletters API | Sim | 7 | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\server.mjs | Referenciada e utilizada |
| JWT_SECRET | .env.local | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| N8N_BIND_ADDRESS | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_DELIVERY_WEBHOOK_URL | .env.production | n8n | Sim | 7 | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\run-worker.mjs | Referenciada e utilizada |
| N8N_ENCRYPTION_KEY | .env.production | n8n | Sim | 2 | docker-compose.yml, render.yaml | Referenciada apenas em configuração |
| N8N_INGEST_TOKEN | .env.production | n8n | Sim | 9 | docker-compose.yml, n8n\README.md, n8n\workflows\collect-rss.json, render.yaml, src\platform\config.mjs, src\platform\server.mjs | Referenciada e utilizada |
| N8N_PORT | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_POSTGRES_DB | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_POSTGRES_PASSWORD | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_POSTGRES_USER | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_SECURE_COOKIE | .env.production | n8n | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| N8N_WEBHOOK_SECRET | .env.production | n8n | Sim | 9 | docker-compose.yml, n8n\README.md, n8n\workflows\deliver-approved-email.json, render.yaml, src\platform\config.mjs, src\platform\run-worker.mjs | Referenciada e utilizada |
| NEON_API_KEY_PROD | .env.local, .env.production | Neon | Não | 0 | - | Declarada, mas não encontrada no código |
| NEXT_PUBLIC_MEDUSA_BACKEND_URL | .env.local, .env.production | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY | .env.local, .env.production | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| PAYPAL_ID | .env.production | PayPal | Não | 0 | - | Declarada, mas não encontrada no código |
| PAYPAL_TOKEN_API | .env.production | PayPal | Não | 0 | - | Declarada, mas não encontrada no código |
| PLATFORM_API_URL | .env.production | n8n | Sim | 4 | docker-compose.yml, n8n\workflows\collect-rss.json, render.yaml | Referenciada apenas em configuração |
| PORT | .env.production | Avila Newsletters API | Sim | 9 | docker-compose.yml, render.yaml, src\platform\config.mjs, src\platform\server.mjs, src\templates\breaking-alert.txt | Referenciada e utilizada |
| POSTGRES_BIND_ADDRESS | .env.production | PostgreSQL plataforma | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| POSTGRES_DB | .env.local, .env.production | PostgreSQL plataforma | Sim | 4 | docker-compose.yml | Referenciada apenas em configuração |
| POSTGRES_PASSWORD | .env.local, .env.production | PostgreSQL plataforma | Sim | 2 | docker-compose.yml | Referenciada apenas em configuração |
| POSTGRES_PORT | .env.local, .env.production | PostgreSQL plataforma | Sim | 1 | docker-compose.yml | Referenciada apenas em configuração |
| POSTGRES_USER | .env.local, .env.production | PostgreSQL plataforma | Sim | 4 | docker-compose.yml | Referenciada apenas em configuração |
| REDIS_PORT | .env.local | Redis | Não | 0 | - | Declarada, mas não encontrada no código |
| REDIS_URL | .env.local | Redis | Não | 0 | - | Declarada, mas não encontrada no código |
| RENDER_API_KEY | .env.local | Render | Não | 0 | - | Declarada, mas não encontrada no código |
| RENDER_DEPLOY_HOOK | .env.local | Render | Não | 0 | - | Declarada, mas não encontrada no código |
| SMTP_FROM_EMAIL | .env.production | n8n | Sim | 3 | docker-compose.yml, n8n\workflows\deliver-approved-email.json, render.yaml | Referenciada apenas em configuração |
| STORE_CORS | .env.local | Medusa | Não | 0 | - | Declarada, mas não encontrada no código |
| TZ | .env.production | n8n | Sim | 6 | docker-compose.yml, pnpm-lock.yaml, render.yaml | Referenciada apenas em configuração |
| WORKER_LOCK_TIMEOUT_MS | .env.production | Avila Newsletters API | Sim | 3 | docker-compose.yml, src\platform\config.mjs, src\platform\run-worker.mjs | Referenciada e utilizada |
| WORKER_POLL_MS | .env.production | Avila Newsletters API | Sim | 4 | docker-compose.yml, src\platform\config.mjs, src\platform\run-worker.mjs | Referenciada e utilizada |
| X_BEARER_DEVELOPMENT_TOKEN | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |
| X_BEARER_PRODUCTION_TOKEN | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |
| X_CONSUMER_DEVELOPMENT_KEY | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |
| X_CONSUMER_PRODUCTION_KEY | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |
| X_SECRET_DEVELOPMENT_KEY | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |
| X_SECRET_PRODUCTION_KEY | .env.local | X/Twitter | Não | 0 | - | Declarada, mas não encontrada no código |

## Variáveis usadas no código e ausentes no ambiente

- MAILERSEND_TEMPLATE_API_TOKEN: referenciada em scripts\sync-mailersend-templates.mjs e ausente em .env.local/.env.production.
- MAILERSEND_DOMAIN_ID: referenciada em scripts\sync-mailersend-templates.mjs e ausente em .env.local/.env.production.
- NODE_ENV: declarada em render.yaml e ausente em .env.local/.env.production.
- DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: declarada em render.yaml e ausente em .env.local/.env.production.
- N8N_HOST: declarada em render.yaml e ausente em .env.local/.env.production.
- N8N_PROTOCOL: declarada em render.yaml e ausente em .env.local/.env.production.
- WEBHOOK_URL: declarada em render.yaml e ausente em .env.local/.env.production.
- N8N_EDITOR_BASE_URL: declarada em render.yaml e ausente em .env.local/.env.production.

Observação: API_BASE em public\app.js é uma constante de frontend, não variável de ambiente.

## Variáveis declaradas e aparentemente não utilizadas

Referências dinâmicas podem não ser detectadas por busca textual.

- ADMIN_CORS (.env.local)
- AUTH_CORS (.env.local)
- CLOUDFLARE_API_GLOBAL_KEY (.env.production)
- CLOUDFLARE_TOKEN (.env.production)
- CLOUDFLARE_WORKER_AI (.env.production)
- COOKIE_SECRET (.env.local)
- GRAVATAR (.env.production)
- JWT_SECRET (.env.local)
- NEON_API_KEY_PROD (.env.local, .env.production)
- NEXT_PUBLIC_MEDUSA_BACKEND_URL (.env.local, .env.production)
- NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (.env.local, .env.production)
- PAYPAL_ID (.env.production)
- PAYPAL_TOKEN_API (.env.production)
- REDIS_PORT (.env.local)
- REDIS_URL (.env.local)
- RENDER_API_KEY (.env.local)
- RENDER_DEPLOY_HOOK (.env.local)
- STORE_CORS (.env.local)
- X_BEARER_DEVELOPMENT_TOKEN (.env.local)
- X_BEARER_PRODUCTION_TOKEN (.env.local)
- X_CONSUMER_DEVELOPMENT_KEY (.env.local)
- X_CONSUMER_PRODUCTION_KEY (.env.local)
- X_SECRET_DEVELOPMENT_KEY (.env.local)
- X_SECRET_PRODUCTION_KEY (.env.local)

## Comparação local versus produção

- Variáveis existentes apenas no ambiente local: ADMIN_CORS, AUTH_CORS, COOKIE_SECRET, JWT_SECRET, REDIS_PORT, REDIS_URL, RENDER_API_KEY, RENDER_DEPLOY_HOOK, STORE_CORS, X_BEARER_DEVELOPMENT_TOKEN, X_BEARER_PRODUCTION_TOKEN, X_CONSUMER_DEVELOPMENT_KEY, X_CONSUMER_PRODUCTION_KEY, X_SECRET_DEVELOPMENT_KEY, X_SECRET_PRODUCTION_KEY.
- Variáveis existentes apenas em produção: ADMIN_API_TOKEN, APP_BIND_ADDRESS, APP_PORT, CLOUDFLARE_API_GLOBAL_KEY, CLOUDFLARE_TOKEN, CLOUDFLARE_WORKER_AI, DATABASE_URL, DB_POSTGRESDB_DATABASE, DB_POSTGRESDB_HOST, DB_POSTGRESDB_PASSWORD, DB_POSTGRESDB_PORT, DB_POSTGRESDB_USER, DB_TYPE, DELIVERY_ENABLED, GENERIC_TIMEZONE, GRAVATAR, HOST, N8N_BIND_ADDRESS, N8N_DELIVERY_WEBHOOK_URL, N8N_ENCRYPTION_KEY, N8N_INGEST_TOKEN, N8N_PORT, N8N_POSTGRES_DB, N8N_POSTGRES_PASSWORD, N8N_POSTGRES_USER, N8N_SECURE_COOKIE, N8N_WEBHOOK_SECRET, PAYPAL_ID, PAYPAL_TOKEN_API, PLATFORM_API_URL, PORT, POSTGRES_BIND_ADDRESS, SMTP_FROM_EMAIL, TZ, WORKER_LOCK_TIMEOUT_MS, WORKER_POLL_MS.
- Variáveis duplicadas entre ambientes: NEON_API_KEY_PROD, NEXT_PUBLIC_MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER.
- Diferenças de nomenclatura: POSTGRES_* configura o banco da plataforma; N8N_POSTGRES_* e DB_POSTGRESDB_* configuram o banco usado pelo n8n.
- Valores secretos não foram comparados nem documentados.

## Testes de conectividade

| Ferramenta | Endpoint mascarado | Método HTTP | Código de resposta | Resultado resumido | Data do teste |
|---|---|---|---:|---|---|
| Docker Compose | compose config local | N/A | 0 | Configuração interpolada com .env.production sem erro. | 2026-07-14 01:34:10 -03:00 |
| Testes locais | node:test local | N/A | 0 | npm run check validou 3 templates e 18 testes passaram. | 2026-07-14 01:34:10 -03:00 |

## Recomendações

- Revisar se as credenciais de Medusa, Redis, Render, Cloudflare, PayPal, Neon e X/Twitter pertencem mesmo a este projeto; hoje elas parecem sobrar nos arquivos analisados.
- Declarar ou remover o caminho legado do MailerSend: scripts\sync-mailersend-templates.mjs exige MAILERSEND_TEMPLATE_API_TOKEN e MAILERSEND_DOMAIN_ID, mas o README informa que esse fluxo é legado.
- Se render.yaml for a fonte de produção, alinhar variáveis presentes apenas no blueprint Render com a documentação local: NODE_ENV, DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED, N8N_HOST, N8N_PROTOCOL, WEBHOOK_URL e N8N_EDITOR_BASE_URL.
- Manter validação tipada centralizada em src\platform\config.mjs para variáveis consumidas pela aplicação e pelo worker.
- Validar manualmente Cloudflare, Render, PayPal, Neon e X/Twitter antes de considerar essas integrações funcionais; a presença de variável não confirma integração ativa.

## Histórico de auditorias

- 2026-07-14 01:34:10 -03:00: auditoria atualizada antes da execução local; validações seguras docker compose config e npm run check passaram.
- 2026-07-13 09:58:46 -03:00: auditoria atualizada após refatoração de hardcodes, geração criptográfica de segredos ausentes e validação local.
