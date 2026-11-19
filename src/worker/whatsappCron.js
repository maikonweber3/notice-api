import cron from "node-cron";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  enqueueNewsWithOffers,
  enqueueRankedOffersForGroups,
} from "../services/whatsappOfferService.js";

async function runOffers() {
  const result = await enqueueRankedOffersForGroups();
  console.log(`[WHATSAPP CRON] Ofertas 3h: ${JSON.stringify(result)}`);
}

async function runNews() {
  const result = await enqueueNewsWithOffers();
  console.log(`[WHATSAPP CRON] Notícias 3h: ${JSON.stringify(result)}`);
}

async function start() {
  if (!config.whatsappPublishEnabled && !config.whatsappNewsEnabled) {
    console.log("WHATSAPP CRON desabilitado.");
    await pool.end();
    return;
  }

  if (config.whatsappPublishEnabled) {
    console.log(`[WHATSAPP CRON] Ofertas: ${config.whatsappPublishCron}`);
    cron.schedule(config.whatsappPublishCron, async () => {
      try {
        await runOffers();
      } catch (error) {
        console.error("[WHATSAPP CRON] Falha ofertas:", error);
      }
    });
  }

  if (config.whatsappNewsEnabled) {
    console.log(
      `[WHATSAPP CRON] Notícias: ${config.whatsappNewsCron} → ${config.whatsappNewsGroupJid}`
    );
    cron.schedule(config.whatsappNewsCron, async () => {
      try {
        await runNews();
      } catch (error) {
        console.error("[WHATSAPP CRON] Falha notícias:", error);
      }
    });
  }
}

start().catch(async (error) => {
  console.error("Erro ao iniciar worker WhatsApp:", error);
  await pool.end();
  process.exit(1);
});
