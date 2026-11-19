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
- `GET /articles?category=games&page=1&limit=20`
- `GET /articles?category=cinema&page=1&limit=20`
- `GET /articles/:id`
- `GET /stats`
- `GET /jev` (status do proxy Jev)
- `POST /jev/decisions` (decisões estruturadas Jev via OpenRouter; requer `JEV_API_TOKEN`)
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

## Jev (OpenRouter Decisions)

O Jev não é um modelo de chat: ele responde perguntas tipadas sobre um `state` (string, objeto ou array) e devolve probabilidades calibradas.

Tipos:
- `noul`: sim/não (probabilidade 0–1)
- `choice`: escolhe uma opção nomeada
- `score`: posição numa rubrica ordenada

Token de uso: `JEV_API_TOKEN` (defina no .env). Header `Authorization: Bearer …` ou `X-Jev-Token`.

```bash
curl -X POST http://localhost:3002/jev/decisions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JEV_API_TOKEN" \
  -d '{
    "state": "Help! Meus pagamentos falham há 3 dias.",
    "questions": {
      "is_urgent": {
        "type": "noul",
        "instructions": "A mensagem transmite urgência?",
        "true": "Explicitamente urgente",
        "false": "Sem urgência"
      },
      "team": {
        "type": "choice",
        "instructions": "Qual time deve atender?",
        "billing": "Pagamentos, faturas, reembolsos",
        "technical": "Bugs, instabilidade, integrações",
        "sales": "Preço, upgrade, contas novas"
      }
    }
  }'
```

Variáveis: `JEV_API_TOKEN`, `JEV_MODEL` (padrão `~typesafe/jev-latest`) e `JEV_TIMEOUT_MS` (padrão `60000`). Usa a mesma `OPENROUTER_API_KEY`.

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
- `./scripts/games.sh [arquivo_saida]`
- `./scripts/cinema.sh [arquivo_saida]`
- `./scripts/tudo.sh [arquivo_saida]`
- `./scripts/extrair.sh <tema> [arquivo_saida]`

Exemplos:

```bash
bash ./scripts/extrair.sh investimentos
bash ./scripts/extrair.sh tecnologia ./data/minha-coleta.jsonl
bash ./scripts/extrair.sh mercado-crypto
bash ./scripts/extrair.sh games
bash ./scripts/extrair.sh cinema
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

## Bitcoin diario + Telegram (News MutterCorp)

O notice-api orquestra a analise de BTC do `app-python-signals/crypto-analytic` e publica no Telegram.

1. Suba o FastAPI (PM2 `crypto-analytic` na porta `8765`, ou `uvicorn app:app --host 127.0.0.1 --port 8765` na pasta `crypto-analytic`).
2. No `.env` do notice-api (mesmo bot do signals):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_IDS=@btcusdtprevisao` (mesmo destino do relatório horário de performance da VPS)
   - `TELEGRAM_NEWS_CHAT_ID=@btcusdtprevisao` (se vazio, reutiliza o chat de observabilidade)
3. `npm run db:migrate` cria a tabela `bitcoin_analyses`.
4. Worker: `npm run worker:bitcoin` (08:00 `America/Sao_Paulo`) ou PM2 `notice-bitcoin-worker`.
5. Manual: `POST /bitcoin/run` (mesmo `RUNNER_TOKEN`). Leitura: `GET /bitcoin/latest`.

Notícias enfileiradas para WhatsApp também são espelhadas nesse mesmo chat Telegram.

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

## Vulnerabilidades (CVEs)

Worker `notice-cve-worker` (`src/worker/vulnCron.js`, cron `VULN_SYNC_CRON`, padrão a cada 2h) sincroniza:

- **NVD CVE API 2.0** — incremental por `lastModStartDate/lastModEndDate` (cursor em `vuln_sync_state`), respeita rate limit (6,5s entre páginas sem chave; `NVD_API_KEY` opcional).
- **CISA KEV** (JSON oficial) — marca `kev=true`, datas, ação requerida e uso por ransomware.
- **GitHub Security Advisories** (`/advisories`, reviewed) — inclui advisories sem CVE (chave GHSA).

Tabela `vulnerabilities` (migration 010): dedupe por `vuln_id`, merge entre fontes (CVSS da NVD tem prioridade), `update_count` registra atualizações.

Endpoints: `GET /vulnerabilities` (q, severity=CRITICAL,HIGH, kev, source, minScore, sort=modified|published|score|kev), `GET /vulnerabilities/stats`, `GET /vulnerabilities/:id`, `POST /vulnerabilities/sync` (runner token).

Sync manual: `npm run vulns:sync [nvd|kev|ghsa]`. Frontend: `/vulnerabilidades`.

Notícias de segurança (RSS) entram na categoria `seguranca`; novas categorias: `ia`, `economia`, `brasil`, `mundo`, `ciencia`.
