import { pool } from "../db/pool.js";

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

  return { items: rowsResult.rows, total: countResult.rows[0]?.total || 0 };
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
      published_at AS "publishedAt",
      collected_at AS "collectedAt"
    FROM articles
    WHERE id = $1
  `,
    [id]
  );
  return result.rows[0] || null;
}

export async function getStats() {
  const [byCategory, bySource] = await Promise.all([
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
  ]);

  return {
    byCategory: byCategory.rows,
    bySource: bySource.rows,
  };
}
