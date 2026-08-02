#!/usr/bin/env bash

set -euo pipefail

OUT_FILE="${1:-./data/games.jsonl}"

npm run scrape -- \
  --rss "https://br.ign.com/feed.xml" \
  --rss "https://criticalhits.com.br/feed/" \
  --rss "https://feeds.feedburner.com/Voxel" \
  --rss "https://www.eurogamer.pt/feed" \
  --out "$OUT_FILE"

echo "Extracao de games concluida: $OUT_FILE"
