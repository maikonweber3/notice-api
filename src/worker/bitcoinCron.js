import cron from "node-cron";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { runBitcoinDailyAnalysis } from "../services/bitcoinDailyService.js";

async function runOnce() {
  const result = await runBitcoinDailyAnalysis({ publish: true });
  console.log(
    `[BITCOIN CRON] id=${result.analysis?.id} telegram=${JSON.stringify(result.telegram)}`
  );
}

async function start() {
  if (!config.bitcoinAnalysisEnabled) {
    console.log("BITCOIN CRON desabilitado (BITCOIN_ANALYSIS_ENABLED=false).");
    await pool.end();
    return;
  }

  console.log(
    `[BITCOIN CRON] ${config.bitcoinAnalysisCron} (${config.bitcoinAnalysisTimezone}) → ${config.cryptoAnalyticUrl}`
  );

  cron.schedule(
    config.bitcoinAnalysisCron,
    async () => {
      try {
        await runOnce();
      } catch (error) {
        console.error("[BITCOIN CRON] Falha:", error);
      }
    },
    { timezone: config.bitcoinAnalysisTimezone }
  );
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker Bitcoin:", error);
  await pool.end();
  process.exit(1);
});
