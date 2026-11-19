ALTER TABLE whatsapp_post_queue
  ADD COLUMN IF NOT EXISTS article_id BIGINT REFERENCES articles (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_post_queue_group_article
  ON whatsapp_post_queue (group_id, article_id)
  WHERE article_id IS NOT NULL;
