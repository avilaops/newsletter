**Com certeza eles armazenam dados**, mas não é possível confirmar publicamente qual banco usam — PostgreSQL, MongoDB, Firebase, Supabase etc.

O próprio aplicativo oferece histórico de leitura, hábitos, streaks, acompanhamento de livros, comunidade, notificações e uma home com curadoria por IA. Tudo isso exige armazenamento persistente no backend. 

Provavelmente existem pelo menos estes conjuntos de dados:

```text
Usuários
- conta e preferências
- assuntos favoritos
- dispositivos e tokens de notificação

Notícias
- título
- resumo
- URL original
- fonte
- imagem
- data de publicação
- categoria
- relevância
- nível de imparcialidade
- status de revisão

Comportamento
- notícia visualizada
- tempo de leitura
- curtidas e salvamentos
- compartilhamentos
- assuntos mais acessados

Hábitos e comunidade
- sequência de leitura
- hábitos concluídos
- livros cadastrados
- seguidores e amizades
- atividades da comunidade
```

## Como a automação provavelmente funciona

```text
RSS, APIs e sites
        ↓
Robô coleta as notícias
        ↓
IA identifica assunto e duplicidades
        ↓
Banco armazena notícia e metadados
        ↓
IA gera resumo e pontuação
        ↓
Equipe revisa conteúdo importante
        ↓
Backend entrega o feed ao aplicativo
        ↓
Sistema registra leitura e preferências
```

A notícia pode ser registrada inicialmente assim:

```json
{
  "title": "Mercado Livre anuncia nova ferramenta",
  "source": "Mercado Livre",
  "sourceUrl": "https://...",
  "publishedAt": "2026-07-12T14:30:00",
  "category": "marketplaces",
  "summary": "Resumo produzido pelo sistema...",
  "importanceScore": 87,
  "biasScore": 12,
  "status": "reviewed"
}
```

## Eles guardam a matéria inteira?

Possivelmente **não guardam integralmente todo conteúdo de outros portais**. O modelo mais seguro é armazenar:

- título;
- pequeno trecho;
- resumo próprio;
- URL da fonte;
- autor e veículo;
- imagem autorizada ou referência;
- classificação e análise da IA.

Já os textos produzidos pelo próprio The News podem ser armazenados integralmente no CMS ou banco deles.

## Arquitetura provável

Eles podem ter mais de um armazenamento:

```text
PostgreSQL
├── usuários
├── notícias
├── categorias
├── hábitos
├── comunidade
└── histórico de leitura

Redis
├── cache do feed
├── notícias em alta
└── filas de processamento

Armazenamento de arquivos
├── imagens
├── áudios
└── capas

Banco vetorial ou índice de busca
├── notícias semelhantes
├── detecção de duplicidades
└── pesquisa semântica
```

Portanto, **a automação não publica diretamente da internet para o aplicativo**. Ela coleta, processa e salva no banco; depois o aplicativo consulta uma API e exibe os registros. O site confirma que o app centraliza conteúdos do grupo e possui uma home de notícias com curadoria de IA. 

Para a Ávila Ops, eu usaria **PostgreSQL + pgvector**, n8n para coleta, Redis para filas/cache e um painel editorial para aprovar as notícias antes da publicação.
