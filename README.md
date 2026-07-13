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

Para criar ou atualizar templates remotos, use um token separado com `Templates: Full access` e `Email: No access`. `MAILERSEND_DOMAIN_ID` é opcional; quando informado, associa e limita a busca dos templates ao domínio. Depois:

```powershell
$env:MAILERSEND_TEMPLATE_API_TOKEN = "token-restrito"
$env:MAILERSEND_DOMAIN_ID = "dominio-verificado"
npm run templates:sync
```

Templates criados no editor visual do MailerSend não podem ser atualizados pela API; a sincronização só atualiza templates cuja origem é a API.

## Revisão e aprovação no MailerSend

Depois da sincronização, revise os três templates no painel. A API não possui um estado de aprovação individual de template: `Get approved` é a aprovação da conta no MailerSend e deve ser solicitada somente depois da revisão visual.

O assunto de cada mensagem está documentado em `src/templates/catalog.json`, mas não é enviado pelo endpoint de templates; confirme-o no fluxo de envio futuro.

## Trava de segurança

Não há implementação nem comando para `POST /v1/email` neste repositório. Um eventual envio deve ser acrescentado em um worker separado, com outra credencial, somente depois de aprovação da conta, aprovação administrativa do envio, hash do conteúdo e lista congelada de destinatários.

Guarde tokens somente em variáveis de ambiente ou no `.env` local ignorado pelo Git. Nunca os coloque em código, dados de exemplo ou arquivos versionados.
