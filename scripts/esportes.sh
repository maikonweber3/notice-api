#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/esportes.jsonl}"

npm run scrape -- \
  --rss "https://ge.globo.com/rss/ge/" \
  --rss "https://www.terra.com.br/esportes/rss.xml" \
  --rss "https://www.metropoles.com/esportes/feed/" \
  --out "$OUT_FILE"

echo "Extracao de esportes concluida: $OUT_FILE"
