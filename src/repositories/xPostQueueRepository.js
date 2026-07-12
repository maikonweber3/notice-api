import { pool } from "../db/pool.js";

export async function enqueueXPost(sourceText) {
  const result = await pool.query(
    `
    INSERT INTO x_post_queue (source_text, status)
    VALUES ($1, 'pending')
    RETURNING
      id,
      source_text AS "sourceText",
      status,
      created_at AS "createdAt"
  `,
    [sourceText]
  );
  return result.rows[0];
}

export async function getXPostById(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      source_text AS "sourceText",
      summarized_text AS "summarizedText",
      status,
      x_tweet_id AS "xTweetId",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      processed_at AS "processedAt",
      posted_at AS "postedAt"
    FROM x_post_queue
    WHERE id = $1
  `,
    [id]
  );
  return result.rows[0] || null;
}

export async function claimNextPending() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const next = await client.query(`
      SELECT id, source_text AS "sourceText"
      FROM x_post_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
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
      UPDATE x_post_queue
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

export async function markXPostPosted(id, { summarizedText, xTweetId }) {
  await pool.query(
    `
    UPDATE x_post_queue
    SET
      status = 'posted',
      summarized_text = $2,
      x_tweet_id = $3,
      posted_at = NOW(),
      error_message = NULL
    WHERE id = $1
  `,
    [id, summarizedText, xTweetId]
  );
}

export async function markXPostFailed(id, { summarizedText, errorMessage }) {
  await pool.query(
    `
    UPDATE x_post_queue
    SET
      status = 'failed',
      summarized_text = COALESCE($2, summarized_text),
      error_message = $3
    WHERE id = $1
  `,
    [id, summarizedText || null, errorMessage]
  );
}

export async function resetStuckProcessing(maxAgeMinutes = 15) {
  const result = await pool.query(
    `
    UPDATE x_post_queue
    SET status = 'pending', processed_at = NULL
    WHERE status = 'processing'
      AND processed_at < NOW() - ($1::text || ' minutes')::interval
  `,
    [maxAgeMinutes]
  );
  return result.rowCount;
}

export async function getXPostQueueStats() {
  const result = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM x_post_queue
    GROUP BY status
    ORDER BY status
  `);
  return result.rows;
}
