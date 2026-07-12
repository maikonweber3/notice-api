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
  --rss "https://ge.globo.com/rss/ge/" \
  --rss "https://www.terra.com.br/esportes/rss.xml" \
  --rss "https://www.metropoles.com/esportes/feed/" \
  --rss "https://gshow.globo.com/rss/gshow/" \
  --rss "https://www.metropoles.com/entretenimento/feed/" \
  --rss "https://www.terra.com.br/diversao/rss.xml" \
  --rss "https://livecoins.com.br/feed/" \
  --rss "https://criptofacil.com/feed/" \
  --rss "https://www.infomoney.com.br/tudo-sobre/criptomoedas/feed/" \
  --out "$OUT_FILE"

echo "Extracao completa concluida: $OUT_FILE"
