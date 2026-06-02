#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/investimentos.jsonl}"

npm run scrape -- \
  --rss "https://www.infomoney.com.br/feed/" \
  --rss "https://valor.globo.com/rss/" \
  --rss "https://exame.com/feed/" \
  --out "$OUT_FILE"

echo "Extracao de investimentos concluida: $OUT_FILE"
