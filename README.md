# Ávila Ops Newsletters

Templates responsivos para publicar conteúdo editorial pelo MailerSend. O projeto separa criação, revisão e sincronização; não contém um comando de envio de e-mail.

## Templates

- `editorial-analysis`: análise aprofundada, como o estudo de arquitetura do The News.
- `daily-digest`: resumo diário com várias notícias.
- `breaking-alert`: alerta curto para uma notícia prioritária.

Cada template tem uma versão HTML, uma versão texto e dados de exemplo em `src/sample-data`.

## Pré-visualizar e validar

```powershell
npm run build
npm run validate
```

As prévias são gravadas em `previews/` e ficam fora do Git.

## Sincronizar com o MailerSend

O comando padrão apenas mostra o plano e **não acessa a rede**:

```powershell
npm run templates:plan
```

Para criar ou atualizar templates remotos, um administrador deve fornecer um token separado com `Templates: Full access` e `Email: No access`, além de aprovar a sincronização em `config/approval.json`. Depois:

```powershell
$env:MAILERSEND_TEMPLATE_API_TOKEN = "token-restrito"
$env:MAILERSEND_DOMAIN_ID = "dominio-verificado"
npm run templates:sync
```

Templates criados no editor visual do MailerSend não podem ser atualizados pela API; a sincronização só atualiza templates cuja origem é a API.

## Trava de segurança

`config/approval.json` começa com todos os estados como `pending`. Não há implementação de `POST /v1/email` neste repositório. O envio deve ser acrescentado em um worker separado, com outra credencial, somente depois de aprovação administrativa vinculada à versão do template, hash do conteúdo e lista congelada de destinatários.

Nunca salve tokens em `env`, `.env`, código, dados de exemplo ou arquivos de aprovação. Esses nomes já estão ignorados pelo Git.
