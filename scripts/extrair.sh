#!/usr/bin/env bash

set -euo pipefail

TEMA="${1:-tudo}"
OUT_FILE="${2:-}"

case "$TEMA" in
  investimentos)
    ./scripts/investimentos.sh "${OUT_FILE:-./data/investimentos.jsonl}"
    ;;
  tecnologia)
    ./scripts/tecnologia.sh "${OUT_FILE:-./data/tecnologia.jsonl}"
    ;;
  programacao)
    ./scripts/programacao.sh "${OUT_FILE:-./data/programacao.jsonl}"
    ;;
  esportes)
    ./scripts/esportes.sh "${OUT_FILE:-./data/esportes.jsonl}"
    ;;
  entretenimento)
    ./scripts/entretenimento.sh "${OUT_FILE:-./data/entretenimento.jsonl}"
    ;;
  tudo)
    ./scripts/tudo.sh "${OUT_FILE:-./data/noticias-tudo.jsonl}"
    ;;
  *)
    echo "Tema invalido: $TEMA"
    echo "Uso: ./scripts/extrair.sh [investimentos|tecnologia|programacao|esportes|entretenimento|tudo] [arquivo_saida]"
    exit 1
    ;;
esac
