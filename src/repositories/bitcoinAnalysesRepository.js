import { pool } from "../db/pool.js";

export async function insertBitcoinAnalysis({
  symbol,
  interval,
  payload,
  telegramSummary,
  plotPath,
}) {
  const result = await pool.query(
    `
    INSERT INTO bitcoin_analyses (
      symbol, interval, payload, telegram_summary, plot_path
    )
    VALUES ($1, $2, $3::jsonb, $4, $5)
    RETURNING
      id,
      symbol,
      interval,
      payload,
      telegram_summary AS "telegramSummary",
      plot_path AS "plotPath",
      generated_at AS "generatedAt"
    `,
    [symbol, interval, JSON.stringify(payload ?? {}), telegramSummary || null, plotPath || null]
  );
  return result.rows[0];
}

export async function getLatestBitcoinAnalysis({ symbol, interval } = {}) {
  const filters = [];
  const params = [];
  if (symbol) {
    params.push(symbol);
    filters.push(`symbol = $${params.length}`);
  }
  if (interval) {
    params.push(interval);
    filters.push(`interval = $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await pool.query(
    `
    SELECT
      id,
      symbol,
      interval,
      payload,
      telegram_summary AS "telegramSummary",
      plot_path AS "plotPath",
      generated_at AS "generatedAt"
    FROM bitcoin_analyses
    ${where}
    ORDER BY generated_at DESC
    LIMIT 1
    `,
    params
  );
  return result.rows[0] || null;
}
