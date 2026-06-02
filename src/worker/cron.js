import cron from "node-cron";
import { config } from "../config.js";
import { ensureDefaultSources, runIngestion } from "../services/ingestionService.js";
import { countArticles } from "../repositories/articlesRepository.js";
import { pool } from "../db/pool.js";

async function runOnce() {
  await ensureDefaultSources();
  const result = await runIngestion();
  const total = await countArticles();
  console.log(`[CRON] Concluido: ${JSON.stringify(result)} | artigos no banco: ${total}`);
}

async function start() {
  if (!config.cronEnabled) {
    console.log("CRON desabilitado (CRON_ENABLED=false).");
    await pool.end();
    return;
  }

  await ensureDefaultSources();
  console.log(`[CRON] Agendado com expressao: ${config.cronExpression}`);

  cron.schedule(config.cronExpression, async () => {
    try {
      await runOnce();
    } catch (error) {
      console.error("[CRON] Falha:", error);
    }
  });
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker cron:", error);
  await pool.end();
  process.exit(1);
});
