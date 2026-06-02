/**
 * Converte summaries com HTML já gravados no banco para texto plano.
 * Uso: node scripts/sanitize-summaries.js
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { toPlainTextOrNull } from "../src/utils/plainText.js";

dotenv.config();

async function main() {
  const { rows } = await pool.query(
    `SELECT id, summary FROM articles WHERE summary IS NOT NULL AND summary ~ '<[a-z]'`
  );

  let updated = 0;
  for (const row of rows) {
    const plain = toPlainTextOrNull(row.summary, { maxLength: 500 });
    if (plain === row.summary) continue;
    await pool.query("UPDATE articles SET summary = $1 WHERE id = $2", [plain, row.id]);
    updated += 1;
  }

  console.log(`Artigos com HTML: ${rows.length}, atualizados: ${updated}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
