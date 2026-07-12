import cron from "node-cron";
import { config } from "../config.js";
import { runXPostWorker } from "../services/xPostService.js";
import { pool } from "../db/pool.js";
import { isXConfigured } from "../integrations/x/client.js";

async function runOnce() {
  const result = await runXPostWorker();
  if (result.processed) {
    console.log(`[X CRON] Processado: ${JSON.stringify(result)}`);
  }
}

async function start() {
  if (!config.xPostWorkerEnabled) {
    console.log("X POST CRON desabilitado (X_POST_WORKER_ENABLED=false).");
    await pool.end();
    return;
  }

  if (!isXConfigured()) {
    console.log(
      "X POST CRON desabilitado: configure API_KEY_X, API_SECRET_X, X_ACCESS_TOKEN e X_ACCESS_TOKEN_SECRET."
    );
    await pool.end();
    return;
  }

  if (!config.openrouterApiKey) {
    console.log("X POST CRON desabilitado: OPENROUTER_API_KEY é obrigatória para resumir posts.");
    await pool.end();
    return;
  }

  console.log(`[X CRON] Agendado com expressao: ${config.xPostWorkerCron}`);

  if (config.xPostWorkerOnStart) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[X CRON] Falha na execução inicial:", error);
    }
  }

  cron.schedule(config.xPostWorkerCron, async () => {
    try {
      await runOnce();
    } catch (error) {
      console.error("[X CRON] Falha:", error);
    }
  });
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker X:", error);
  await pool.end();
  process.exit(1);
});
