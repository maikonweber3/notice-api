-- Extensões para busca eficiente de ofertas afiliadas
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Documento de busca full-text (português) sobre título + loja
ALTER TABLE shopee_offers
  ADD COLUMN IF NOT EXISTS search_document tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(shop_name, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_shopee_offers_search_document
  ON shopee_offers USING gin (search_document);

CREATE INDEX IF NOT EXISTS idx_shopee_offers_title_trgm
  ON shopee_offers USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_shopee_offers_shop_name_trgm
  ON shopee_offers USING gin (shop_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_shopee_offers_external_id
  ON shopee_offers (external_id);

CREATE INDEX IF NOT EXISTS idx_shopee_offers_active_commission
  ON shopee_offers (commission_rate DESC NULLS LAST)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_shopee_offers_active_price
  ON shopee_offers (price_min ASC NULLS LAST)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_shopee_offers_active_sales
  ON shopee_offers (sales DESC NULLS LAST)
  WHERE active = TRUE;

-- Cache de páginas de busca live na Open API Shopee Affiliate
CREATE TABLE IF NOT EXISTS shopee_search_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('product', 'shop', 'campaign')),
  keyword TEXT NOT NULL,
  page INTEGER NOT NULL CHECK (page >= 1),
  page_limit INTEGER NOT NULL CHECK (page_limit >= 1),
  sort_type INTEGER,
  list_type INTEGER,
  external_ids TEXT[] NOT NULL DEFAULT '{}',
  has_next_page BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'live',
  hit_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopee_search_cache_expires
  ON shopee_search_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_shopee_search_cache_lookup
  ON shopee_search_cache (offer_type, keyword, page, page_limit);

CREATE INDEX IF NOT EXISTS idx_shopee_search_cache_keyword_trgm
  ON shopee_search_cache USING gin (keyword gin_trgm_ops);
