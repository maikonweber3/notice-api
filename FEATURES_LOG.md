# FEATURES_LOG — Notice (news.muttercorp.com.br)

Log completo também em frontend/FEATURES_LOG.md.

## 2026-11-24 — Categoria Animes + One Piece / spoilers (branch `feature/animes`)
- 21 feeds RSS novos na categoria `animes` (PT-BR e EN), com cobertura forte de One Piece (inclusive spoilers de capítulo).
- API: `GET /articles` aceita `topic=one-piece` (ou `onePiece=true`) e `spoiler=true`. Cada item ganha `isOnePiece` e `isSpoiler` (calculados na leitura, sem migration).
- Ingestão evita duplicar a mesma URL na mesma categoria (feeds geral + tag).
- Fontes que falharam no teste (Reddit, Crunchyroll News, Omelete, Sportskeeda, WorstGen, Nitter/RSShub, Fandom) não foram adicionadas.
- Backups (2026-11-24 16:24 America/Sao_Paulo): `/root/backups/notice-api/env-20261124-202438.bak`, `frontend-env-20261124-202438.bak`, `notice_api-20261124-202438.dump`, `frontend-next-20261124-202438/`, `frontend-src-20261124-202438.tgz`, `api-prev-commit-20261124-202438.txt` (eb64f7f), `frontend-prev-commit-20261124-202438.txt` (64060c4).
- **Rollback**: restaurar o dump se necessário; no frontend, `cd /apps/production/notice-api/frontend && git checkout main && rm -rf .next && cp -a /root/backups/notice-api/frontend-next-20261124-202438 .next && pm2 restart notice-frontend --update-env && pm2 save`. Na API, `cd /apps/production/notice-api && git checkout master && pm2 restart notice-api notice-worker --update-env && pm2 save`.


## 2026-11-23 — Feeds RSS / JSON Feed (branch `feature/rss-feeds`, repo noticia-api, commit `65de2ee`)
- **Feed geral**: `/feed.xml` (RSS 2.0) e `/feed.json` (JSON Feed 1.1) — 50 notícias mais recentes de todas as categorias.
- **Por categoria** (14): `/categoria/<slug>/feed.xml` e `/categoria/<slug>/feed.json` (slug inválido → 404).
- **CVEs**: `/vulnerabilidades/feed.xml` com filtros `?severity=CRITICAL,HIGH` e `?kev=1` (exploradas ativamente, CISA KEV), título com severidade/CVSS/KEV.
- Itens apontam para a página da notícia no Notice e trazem a fonte original (`<source>`, `dc:creator`, `external_url`). XML escapado e sem caracteres de controle; `Cache-Control: s-maxage=600`; 503 com `Retry-After` se a API cair.
- Página **`/feeds`** (lista todos os feeds com botões RSS / JSON / Copiar link), link "Feeds RSS / JSON" no rodapé, `/feeds` no sitemap.
- **Autodescoberta**: `<link rel="alternate" type="application/rss+xml|application/feed+json">` nas páginas de categoria, raiz e `/vulnerabilidades` (Feedly/Inoreader detectam colando a URL do site).
- Só frontend (Next route handlers usando a API pública existente); sem mudança de schema/API.
- Backups: `/root/backups/notice-api/env-20261123-140032.bak`, `frontend-env-20261123-140032.bak`, `notice_api-20261123-140032.dump`, `frontend-next-20261123-140032/` (build anterior), `frontend-src-next-20261123-140032.tgz`, `frontend-prev-commit-20261123-140032.txt` (7b62e85).
- **Rollback**: `cd /apps/production/notice-api/frontend && git checkout main && npm run build && pm2 restart notice-frontend --update-env && pm2 save` (rápido, sem rebuild: `rm -rf .next && cp -a /root/backups/notice-api/frontend-next-20261123-140032 .next && git checkout main && pm2 restart notice-frontend`).

