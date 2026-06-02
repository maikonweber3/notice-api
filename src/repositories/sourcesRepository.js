import { pool } from "../db/pool.js";

export async function upsertSources(sources) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const source of sources) {
      await client.query(
        `
        INSERT INTO sources (name, category, source_type, source_url, selector, active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (source_url, source_type, selector)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          updated_at = NOW(),
          active = TRUE
      `,
        [
          source.name,
          source.category,
          source.sourceType,
          source.sourceUrl,
          source.selector || "",
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSources({ active = true, category } = {}) {
  const clauses = [];
  const params = [];
  if (active !== undefined) {
    params.push(active);
    clauses.push(`active = $${params.length}`);
  }
  if (category) {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = `
    SELECT id, name, category, source_type AS "sourceType", source_url AS "sourceUrl", selector, active
    FROM sources
    ${where}
    ORDER BY category, name
  `;
  const result = await pool.query(query, params);
  return result.rows;
}
