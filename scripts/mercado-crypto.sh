#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/mercado-crypto.jsonl}"

npm run scrape -- \
  --rss "https://livecoins.com.br/feed/" \
  --rss "https://criptofacil.com/feed/" \
  --rss "https://www.infomoney.com.br/tudo-sobre/criptomoedas/feed/" \
  --out "$OUT_FILE"

echo "Extracao de mercado-crypto concluida: $OUT_FILE"
