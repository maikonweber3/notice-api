import { pool } from "../db/pool.js";
import { runShopeeSync } from "../services/shopeeSyncService.js";

async function main() {
  try {
    const result = await runShopeeSync();
    console.log(`[SHOPEE SYNC] Concluido: ${JSON.stringify(result)}`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("[SHOPEE SYNC] Falha:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
