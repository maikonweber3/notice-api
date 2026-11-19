CREATE TABLE IF NOT EXISTS bitcoin_analyses (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  payload JSONB NOT NULL,
  telegram_summary TEXT,
  plot_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitcoin_analyses_generated_at
  ON bitcoin_analyses (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitcoin_analyses_symbol_interval
  ON bitcoin_analyses (symbol, interval, generated_at DESC);
