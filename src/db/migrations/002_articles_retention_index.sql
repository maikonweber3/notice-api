CREATE INDEX IF NOT EXISTS idx_articles_category_recency
  ON articles (category, COALESCE(published_at, collected_at) DESC);
