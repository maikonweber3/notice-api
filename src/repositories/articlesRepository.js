import { pool } from "../db/pool.js";
import { toPlainTextOrNull } from "../utils/plainText.js";

function sanitizeArticle(row) {
  if (!row) return row;
  return {
    ...row,
    summary: toPlainTextOrNull(row.summary, { maxLength: 500 }),
    body: null,
    bodyGeneratedAt: null,
  };
}

export async function insertArticles(articles) {
  if (articles.length === 0) {
    return { inserted: 0 };
  }

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const article of articles) {
      const result = await client.query(
        `
        INSERT INTO articles (
          source_id, source_type, source_name, source_url, category, title, url, summary,
          published_at, collected_at, content_hash
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (content_hash) DO NOTHING
      `,
        [
          article.sourceId || null,
          article.sourceType,
          article.sourceName || null,
          article.sourceUrl,
          article.category,
          article.title,
          article.url || null,
          article.summary || null,
          article.publishedAt || null,
          article.collectedAt || new Date().toISOString(),
          article.contentHash,
        ]
      );
      inserted += result.rowCount;
    }
    await client.query("COMMIT");
    return { inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findArticles(filters) {
  const params = [];
  const clauses = [];

  if (filters.category) {
    params.push(filters.category);
    clauses.push(`category = $${params.length}`);
  }
  if (filters.sourceName) {
    params.push(filters.sourceName);
    clauses.push(`source_name = $${params.length}`);
  }
  if (filters.sourceType) {
    params.push(filters.sourceType);
    clauses.push(`source_type = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`COALESCE(published_at, collected_at) >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`COALESCE(published_at, collected_at) <= $${params.length}::timestamptz`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    clauses.push(`title ILIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(filters.limit);
  const limitParam = `$${params.length}`;
  params.push(filters.offset);
  const offsetParam = `$${params.length}`;

  const query = `
    SELECT
      id,
      source_type AS "sourceType",
      source_name AS "sourceName",
      source_url AS "sourceUrl",
      category,
      title,
      url,
      summary,
      body,
      body_generated_at AS "bodyGeneratedAt",
      published_at AS "publishedAt",
      collected_at AS "collectedAt"
    FROM articles
    ${where}
    ORDER BY COALESCE(published_at, collected_at) DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*)::int AS total FROM articles ${where}`, params.slice(0, -2)),
  ]);

  return {
    items: rowsResult.rows.map(sanitizeArticle),
    total: countResult.rows[0]?.total || 0,
  };
}

export async function getArticleById(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      source_type AS "sourceType",
      source_name AS "sourceName",
      source_url AS "sourceUrl",
      category,
      title,
      url,
      summary,
      body,
      body_generated_at AS "bodyGeneratedAt",
      published_at AS "publishedAt",
      collected_at AS "collectedAt"
    FROM articles
    WHERE id = $1
  `,
    [id]
  );
  return sanitizeArticle(result.rows[0] || null);
}

export async function pruneArticles({ maxPerCategory = 0, maxAgeDays = 0 } = {}) {
  let deletedByAge = 0;
  let deletedByCount = 0;

  if (maxAgeDays > 0) {
    const ageResult = await pool.query(
      `
      DELETE FROM articles
      WHERE COALESCE(published_at, collected_at) < NOW() - ($1::text || ' days')::interval
    `,
      [maxAgeDays]
    );
    deletedByAge = ageResult.rowCount;
  }

  if (maxPerCategory > 0) {
    const countResult = await pool.query(
      `
      DELETE FROM articles a
      USING (
        SELECT id
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY category
              ORDER BY COALESCE(published_at, collected_at) DESC, id DESC
            ) AS rn
          FROM articles
        ) ranked
        WHERE rn > $1
      ) excess
      WHERE a.id = excess.id
    `,
      [maxPerCategory]
    );
    deletedByCount = countResult.rowCount;
  }

  return {
    deleted: deletedByAge + deletedByCount,
    deletedByAge,
    deletedByCount,
  };
}

export async function findRecentArticlesForTheme({
  category,
  groupId,
  limit = 12,
  maxAgeHours = 36,
} = {}) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.source_type AS "sourceType",
      a.source_name AS "sourceName",
      a.source_url AS "sourceUrl",
      a.category,
      a.title,
      a.url,
      a.summary,
      a.body,
      a.body_generated_at AS "bodyGeneratedAt",
      a.published_at AS "publishedAt",
      a.collected_at AS "collectedAt"
    FROM articles a
    WHERE a.category = $1
      AND COALESCE(a.published_at, a.collected_at)
        >= NOW() - ($3::text || ' hours')::interval
      AND NOT EXISTS (
        SELECT 1
        FROM whatsapp_post_queue q
        WHERE q.article_id = a.id
          AND q.group_id = $2
          AND q.status IN ('pending', 'processing', 'posted')
      )
    ORDER BY
      (a.body IS NOT NULL) DESC,
      COALESCE(a.published_at, a.collected_at) DESC,
      a.id DESC
    LIMIT $4
  `,
    [category, groupId, maxAgeHours, limit]
  );
  return result.rows.map(sanitizeArticle);
}

export async function findEnrichedArticlesNotQueued({ groupId, limit = 3 } = {}) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.source_type AS "sourceType",
      a.source_name AS "sourceName",
      a.source_url AS "sourceUrl",
      a.category,
      a.title,
      a.url,
      a.summary,
      a.body,
      a.body_generated_at AS "bodyGeneratedAt",
      a.published_at AS "publishedAt",
      a.collected_at AS "collectedAt"
    FROM articles a
    WHERE a.body IS NOT NULL
      AND a.body_generated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM whatsapp_post_queue q
        WHERE q.article_id = a.id
          AND q.group_id = $1
          AND q.status IN ('pending', 'processing', 'posted')
      )
    ORDER BY a.body_generated_at DESC, a.id DESC
    LIMIT $2
  `,
    [groupId, limit]
  );
  return result.rows.map(sanitizeArticle);
}

export async function findRandomArticle({ maxAgeDays = 7 } = {}) {
  const result = await pool.query(
    `
    SELECT
      id,
      source_type AS "sourceType",
      source_name AS "sourceName",
      source_url AS "sourceUrl",
      category,
      title,
      url,
      summary,
      body,
      published_at AS "publishedAt",
      collected_at AS "collectedAt"
    FROM articles
    WHERE COALESCE(published_at, collected_at) >= NOW() - ($1::text || ' days')::interval
    ORDER BY RANDOM()
    LIMIT 1
  `,
    [maxAgeDays]
  );
  return sanitizeArticle(result.rows[0] || null);
}

export async function countArticles() {
  const result = await pool.query(`SELECT COUNT(*)::int AS total FROM articles`);
  return result.rows[0]?.total || 0;
}

export async function findArticlesPendingEnrichment({ category, limit = 10 } = {}) {
  const params = [];
  const clauses = ["body IS NULL"];

  if (category) {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const result = await pool.query(
    `
    SELECT
      id,
      source_type AS "sourceType",
      source_name AS "sourceName",
      source_url AS "sourceUrl",
      category,
      title,
      url,
      summary,
      published_at AS "publishedAt",
      collected_at AS "collectedAt"
    FROM articles
    WHERE ${clauses.join(" AND ")}
    ORDER BY COALESCE(published_at, collected_at) DESC, id DESC
    LIMIT ${limitParam}
  `,
    params
  );

  return result.rows.map(sanitizeArticle);
}

export async function updateArticleBody(id, body) {
  const result = await pool.query(
    `
    UPDATE articles
    SET body = $2, body_generated_at = NOW()
    WHERE id = $1
  `,
    [id, body]
  );
  return { updated: result.rowCount };
}

export async function getStats() {
  const [byCategory, bySource, totalResult] = await Promise.all([
    pool.query(`
      SELECT category, COUNT(*)::int AS count
      FROM articles
      GROUP BY category
      ORDER BY count DESC
    `),
    pool.query(`
      SELECT source_name AS "sourceName", COUNT(*)::int AS count
      FROM articles
      GROUP BY source_name
      ORDER BY count DESC
      LIMIT 20
    `),
    pool.query(`SELECT COUNT(*)::int AS total FROM articles`),
  ]);

  return {
    total: totalResult.rows[0]?.total || 0,
    byCategory: byCategory.rows,
    bySource: bySource.rows,
  };
}
