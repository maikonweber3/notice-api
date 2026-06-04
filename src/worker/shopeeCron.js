import cron from "node-cron";
import { config } from "../config.js";
import { runShopeeSync } from "../services/shopeeSyncService.js";
import { getSyncStats } from "../repositories/shopeeOffersRepository.js";
import { pool } from "../db/pool.js";

async function runOnce() {
  const result = await runShopeeSync();
  const stats = await getSyncStats();
  console.log(
    `[SHOPEE CRON] Concluido: ${JSON.stringify(result)} | ofertas ativas: ${stats.activeOffers}`
  );
}

async function start() {
  if (!config.shopeeSyncEnabled) {
    console.log("SHOPEE CRON desabilitado (SHOPEE_SYNC_ENABLED=false).");
    await pool.end();
    return;
  }

  if (!config.shopeeAppId || !config.shopeeSecret) {
    console.log("SHOPEE CRON desabilitado: SHOPEE_APP_ID e SHOPEE_SECRET são obrigatórios.");
    await pool.end();
    return;
  }

  console.log(`[SHOPEE CRON] Agendado com expressao: ${config.shopeeSyncCron}`);

  if (config.shopeeSyncOnStart) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[SHOPEE CRON] Falha na sync inicial:", error);
    }
  }

  cron.schedule(config.shopeeSyncCron, async () => {
    try {
      await runOnce();
    } catch (error) {
      console.error("[SHOPEE CRON] Falha:", error);
    }
  });
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker Shopee:", error);
  await pool.end();
  process.exit(1);
});
