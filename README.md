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
- `GET /articles?category=investimentos&q=bitcoin&page=1&limit=20`
- `GET /articles/:id`
- `GET /stats`
- `POST /ingestion/run` (executa coleta manual e persiste no banco)

Exemplo de ingestao manual:

```bash
curl -X POST http://localhost:3000/ingestion/run \
  -H "Content-Type: application/json" \
  -d "{\"ensureSources\": true}"
```

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
- `./scripts/tudo.sh [arquivo_saida]`
- `./scripts/extrair.sh <tema> [arquivo_saida]`

Exemplos:

```bash
bash ./scripts/extrair.sh investimentos
bash ./scripts/extrair.sh tecnologia ./data/minha-coleta.jsonl
```

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
