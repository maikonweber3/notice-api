ALTER TABLE shopee_offers
  ADD COLUMN IF NOT EXISTS rank_score NUMERIC(12, 4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shopee_offers_rank_score
  ON shopee_offers (active, rank_score DESC);

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id TEXT PRIMARY KEY,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected')),
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO whatsapp_instances (id)
VALUES ('notice')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS offer_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  whatsapp_jid TEXT NOT NULL UNIQUE,
  invite_link TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  posts_per_run INTEGER NOT NULL DEFAULT 3
    CHECK (posts_per_run >= 1 AND posts_per_run <= 20),
  min_rank_score NUMERIC(12, 4) NOT NULL DEFAULT 0,
  last_posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_groups_active
  ON offer_groups (active, last_posted_at);

CREATE TABLE IF NOT EXISTS whatsapp_post_queue (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES offer_groups (id) ON DELETE CASCADE,
  offer_id BIGINT REFERENCES shopee_offers (id) ON DELETE SET NULL,
  rank_position INTEGER,
  rank_score NUMERIC(12, 4),
  message_text TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'posted', 'failed')),
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_post_queue_status
  ON whatsapp_post_queue (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_post_queue_group_offer
  ON whatsapp_post_queue (group_id, offer_id, created_at DESC);
