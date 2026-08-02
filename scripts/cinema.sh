#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/cinema.jsonl}"

npm run scrape -- \
  --rss "https://www.metropoles.com/entretenimento/cinema/feed/" \
  --rss "https://cinepop.com.br/feed/" \
  --rss "https://rss.uol.com.br/feed/cinema.xml" \
  --rss "https://www.rollingstone.com/tv-movies/feed/" \
  --out "$OUT_FILE"

echo "Extracao de cinema concluida: $OUT_FILE"
