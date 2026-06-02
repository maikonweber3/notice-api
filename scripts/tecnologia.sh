#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/tecnologia.jsonl}"

npm run scrape -- \
  --rss "https://tecnoblog.net/feed/" \
  --rss "https://canaltech.com.br/rss/" \
  --rss "https://www.theverge.com/rss/index.xml" \
  --rss "https://techcrunch.com/feed/" \
  --out "$OUT_FILE"

echo "Extracao de tecnologia concluida: $OUT_FILE"
