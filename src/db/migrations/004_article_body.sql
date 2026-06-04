ALTER TABLE articles ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS body_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_body_generated_at
  ON articles (body_generated_at DESC NULLS LAST);
