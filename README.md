# News Scraper Platform (Node.js)

Estrutura completa para coleta de noticias com:
- API REST (Fastify)
- Swagger (`/docs`)
- PostgreSQL (migrations e filtros)
- Worker de cron para ingestao automatica
- Scripts bash para coleta em JSONL

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Instalacao

```bash
npm install
cp .env.example .env
```

## Variaveis de ambiente

- `PORT`: porta da API (padrao `3000`)
- `DATABASE_URL`: conexao Postgres
- `USER_AGENT`: user agent para scraping
- `REQUEST_TIMEOUT_MS`: timeout de requests HTTP
- `CORS_ORIGIN`: origem permitida para frontend
- `CRON_ENABLED`: habilita worker cron (`true/false`)
- `CRON_EXPRESSION`: expressao cron (padrao `*/30 * * * *`)
- `ARTICLES_CLEANUP_ENABLED`: habilita limpeza automatica (`true/false`)
- `ARTICLES_MAX_PER_CATEGORY`: maximo de artigos por categoria (padrao `200`)
- `ARTICLES_MAX_AGE_DAYS`: remove artigos mais antigos que N dias (padrao `14`, use `0` para desativar)
- `RUNNER_TOKEN`: token obrigatorio para `POST /ingestion/run` e `POST /cleanup/run`

## Banco de dados

Execute migrations:

```bash
npm run db:migrate
```

Schema principal:
- `sources`: fontes por categoria/tipo/URL
- `articles`: noticias coletadas com deduplicacao por hash

## API REST + Swagger

Subir API:

```bash
npm run start
```

Swagger UI:
- `http://localhost:3000/docs`

Endpoints principais:
- `GET /health`
- `GET /sources?category=tecnologia&active=true`
- `GET /articles?category=esportes&page=1&limit=20`
- `GET /articles?category=entretenimento&page=1&limit=20`
- `GET /articles?category=investimentos&q=bitcoin&page=1&limit=20`
- `GET /articles?category=mercado-crypto&page=1&limit=20`
- `GET /articles/:id`
- `GET /stats`
- `POST /ingestion/run` (coleta manual; ao final executa limpeza de retencao)
- `POST /cleanup/run` (limpeza manual sem nova coleta)

Exemplo de ingestao manual (requer `RUNNER_TOKEN` no `.env`):

```bash
curl -X POST http://localhost:3000/ingestion/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer notice-runner-dev-token" \
  -d "{\"ensureSources\": true}"
```

Alternativa sem `Authorization`: header `X-Runner-Token: notice-runner-dev-token`.

## Worker Cron

Executa ingestao automatica com base na expressao `CRON_EXPRESSION`:

```bash
npm run worker:cron
```

## Scripts Bash (JSONL)

Mantidos para coleta rapida em arquivo:
- `./scripts/investimentos.sh [arquivo_saida]`
- `./scripts/tecnologia.sh [arquivo_saida]`
- `./scripts/programacao.sh [arquivo_saida]`
- `./scripts/esportes.sh [arquivo_saida]`
- `./scripts/entretenimento.sh [arquivo_saida]`
- `./scripts/mercado-crypto.sh [arquivo_saida]`
- `./scripts/tudo.sh [arquivo_saida]`
- `./scripts/extrair.sh <tema> [arquivo_saida]`

Exemplos:

```bash
bash ./scripts/extrair.sh investimentos
bash ./scripts/extrair.sh tecnologia ./data/minha-coleta.jsonl
bash ./scripts/extrair.sh mercado-crypto
```

## Retencao e limpeza

Para manter o banco pequeno e acelerar as queries, a API remove automaticamente:

1. Artigos com mais de `ARTICLES_MAX_AGE_DAYS` dias
2. Excesso acima de `ARTICLES_MAX_PER_CATEGORY` por categoria (mantém os mais recentes)

A limpeza roda após cada ingestão (cron e `POST /ingestion/run`). Para executar só a limpeza:

```bash
npm run db:cleanup
# ou
curl -X POST http://localhost:3000/cleanup/run
```

`GET /stats` retorna `total`, contagens por categoria e os limites configurados em `retention`.

## Integracao facilitada

- Frontend pode consumir diretamente `/articles` e `/stats`
- Filtros de API prontos para busca, categoria, periodo e paginacao
- Swagger serve como contrato para integracoes externas
- `POST /ingestion/run` permite automacao por webhook/CI/jobs

## Deploy rapido na VPS (Docker)

Subir stack completa:

```bash
docker compose up -d --build
```

Servicos:
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- PostgreSQL: `localhost:5432`
