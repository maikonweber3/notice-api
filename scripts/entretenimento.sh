#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/entretenimento.jsonl}"

npm run scrape -- \
  --rss "https://gshow.globo.com/rss/gshow/" \
  --rss "https://www.metropoles.com/entretenimento/feed/" \
  --rss "https://www.terra.com.br/diversao/rss.xml" \
  --out "$OUT_FILE"

echo "Extracao de entretenimento concluida: $OUT_FILE"
