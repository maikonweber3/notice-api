#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/programacao.jsonl}"

npm run scrape -- \
  --rss "https://dev.to/feed" \
  --rss "https://www.freecodecamp.org/news/rss/" \
  --rss "https://www.smashingmagazine.com/feed/" \
  --rss "https://hnrss.org/frontpage" \
  --out "$OUT_FILE"

echo "Extracao de programacao concluida: $OUT_FILE"
