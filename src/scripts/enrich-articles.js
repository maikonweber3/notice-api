import { pool } from "../db/pool.js";
import { runArticleEnrichment } from "../services/articleEnrichmentService.js";

async function main() {
  const category = process.argv[2] || undefined;
  const limit = Number(process.argv[3] || 10);

  try {
    const result = await runArticleEnrichment({
      category,
      limit,
      ensureIngestion: true,
      ensureSources: true,
    });
    console.log(`[ENRICH] Concluido: ${JSON.stringify(result, null, 2)}`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("[ENRICH] Falha:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
