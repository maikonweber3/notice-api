CREATE TABLE IF NOT EXISTS x_post_queue (
  id BIGSERIAL PRIMARY KEY,
  source_text TEXT NOT NULL,
  summarized_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'posted', 'failed')),
  x_tweet_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_x_post_queue_status_created
  ON x_post_queue (status, created_at ASC);
