CREATE TABLE IF NOT EXISTS shopee_offers (
  id BIGSERIAL PRIMARY KEY,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('product', 'shop', 'campaign')),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  offer_link TEXT NOT NULL,
  original_link TEXT,
  price_min NUMERIC(12, 2),
  price_max NUMERIC(12, 2),
  price_discount_rate INTEGER,
  commission_rate NUMERIC(8, 4),
  commission NUMERIC(12, 2),
  sales INTEGER,
  rating_star NUMERIC(3, 2),
  shop_id BIGINT,
  shop_name TEXT,
  category_id BIGINT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  banner_placement TEXT NOT NULL DEFAULT 'default',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offer_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_shopee_offers_active ON shopee_offers (active, featured);
CREATE INDEX IF NOT EXISTS idx_shopee_offers_type ON shopee_offers (offer_type);
CREATE INDEX IF NOT EXISTS idx_shopee_offers_placement ON shopee_offers (banner_placement);
CREATE INDEX IF NOT EXISTS idx_shopee_offers_synced_at ON shopee_offers (synced_at DESC);

CREATE TABLE IF NOT EXISTS shopee_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  offer_type TEXT,
  keyword TEXT,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  offers_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopee_sync_runs_started_at ON shopee_sync_runs (started_at DESC);
