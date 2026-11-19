import cron from "node-cron";
import { config } from "../config.js";
import { runVulnerabilitySync } from "../services/vulnerabilitySyncService.js";
import { pool } from "../db/pool.js";

async function runOnce(label) {
  const t = Date.now();
  const result = await runVulnerabilitySync();
  console.log(`[VULN] ${label} concluido em ${Math.round((Date.now() - t) / 1000)}s: ${JSON.stringify(result)}`);
}

async function start() {
  if (!config.vulnSyncEnabled) {
    console.log("Sync de vulnerabilidades desabilitado (VULN_SYNC_ENABLED=false).");
    await pool.end();
    return;
  }
  console.log(`[VULN] Agendado com expressao: ${config.vulnSyncCron}`);
  cron.schedule(config.vulnSyncCron, () => {
    runOnce("cron").catch((error) => console.error("[VULN] Falha:", error));
  });
  if (config.vulnSyncOnStart) {
    runOnce("start").catch((error) => console.error("[VULN] Falha no start:", error));
  }
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker de vulnerabilidades:", error);
  await pool.end();
  process.exit(1);
});
