#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/noticias-tudo.jsonl}"

npm run scrape -- \
  --rss "https://www.infomoney.com.br/feed/" \
  --rss "https://valor.globo.com/rss/" \
  --rss "https://exame.com/feed/" \
  --rss "https://tecnoblog.net/feed/" \
  --rss "https://canaltech.com.br/rss/" \
  --rss "https://www.theverge.com/rss/index.xml" \
  --rss "https://techcrunch.com/feed/" \
  --rss "https://dev.to/feed" \
  --rss "https://www.freecodecamp.org/news/rss/" \
  --rss "https://www.smashingmagazine.com/feed/" \
  --rss "https://hnrss.org/frontpage" \
  --out "$OUT_FILE"

echo "Extracao completa concluida: $OUT_FILE"
