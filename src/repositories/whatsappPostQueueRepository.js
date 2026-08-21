import { pool } from "../db/pool.js";

export async function enqueueWhatsAppPost({
  groupId,
  offerId,
  rankPosition,
  rankScore,
  messageText,
  imageUrl,
}) {
  const result = await pool.query(
    `
    INSERT INTO whatsapp_post_queue (
      group_id, offer_id, rank_position, rank_score, message_text, image_url
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      group_id AS "groupId",
      offer_id AS "offerId",
      rank_position AS "rankPosition",
      rank_score AS "rankScore",
      message_text AS "messageText",
      image_url AS "imageUrl",
      status,
      created_at AS "createdAt"
  `,
    [groupId, offerId, rankPosition, rankScore, messageText, imageUrl || null]
  );
  return result.rows[0];
}

export async function wasOfferPostedRecently(groupId, offerId, cooldownHours) {
  if (!offerId) return false;
  const result = await pool.query(
    `
    SELECT 1
    FROM whatsapp_post_queue
    WHERE group_id = $1
      AND offer_id = $2
      AND status IN ('pending', 'processing', 'posted')
      AND created_at > NOW() - ($3::text || ' hours')::interval
    LIMIT 1
  `,
    [groupId, offerId, cooldownHours]
  );
  return result.rowCount > 0;
}

/** Mesma oferta em qualquer grupo no período — não repetir. */
export async function wasOfferPostedRecentlyAnywhere(offerId, cooldownHours) {
  if (!offerId) return false;
  const result = await pool.query(
    `
    SELECT 1
    FROM whatsapp_post_queue
    WHERE offer_id = $1
      AND status IN ('pending', 'processing', 'posted')
      AND created_at > NOW() - ($2::text || ' hours')::interval
    LIMIT 1
  `,
    [offerId, cooldownHours]
  );
  return result.rowCount > 0;
}

export async function reserveOffersCooldown(groupId, offerIds) {
  const ids = [...new Set((offerIds || []).filter(Boolean))];
  for (const offerId of ids) {
    await pool.query(
      `
      INSERT INTO whatsapp_post_queue (
        group_id, offer_id, message_text, status, posted_at
      )
      VALUES ($1, $2, '[cooldown]', 'posted', NOW())
    `,
      [groupId, offerId]
    );
  }
}

export async function claimNextWhatsAppPost() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const next = await client.query(`
      SELECT
        q.id,
        q.group_id AS "groupId",
        q.offer_id AS "offerId",
        q.message_text AS "messageText",
        q.image_url AS "imageUrl",
        g.whatsapp_jid AS "whatsappJid",
        g.name AS "groupName"
      FROM whatsapp_post_queue q
      JOIN offer_groups g ON g.id = q.group_id
      WHERE q.status = 'pending'
        AND g.active = TRUE
        AND q.message_text <> '[cooldown]'
      ORDER BY q.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    const row = next.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `
      UPDATE whatsapp_post_queue
      SET status = 'processing', processed_at = NOW()
      WHERE id = $1
    `,
      [row.id]
    );
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markWhatsAppPosted(id, { externalId }) {
  await pool.query(
    `
    UPDATE whatsapp_post_queue
    SET status = 'posted',
        external_id = $2,
        posted_at = NOW(),
        error_message = NULL
    WHERE id = $1
  `,
    [id, externalId]
  );
}

export async function markWhatsAppFailed(id, errorMessage) {
  await pool.query(
    `
    UPDATE whatsapp_post_queue
    SET status = 'failed', error_message = $2
    WHERE id = $1
  `,
    [id, errorMessage]
  );
}

export async function resetStuckWhatsAppPosts(maxAgeMinutes = 15) {
  const result = await pool.query(
    `
    UPDATE whatsapp_post_queue
    SET status = 'pending', processed_at = NULL
    WHERE status = 'processing'
      AND processed_at < NOW() - ($1::text || ' minutes')::interval
  `,
    [maxAgeMinutes]
  );
  return result.rowCount;
}

export async function getWhatsAppQueueStats() {
  const result = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM whatsapp_post_queue
    GROUP BY status
    ORDER BY status
  `);
  return result.rows;
}
