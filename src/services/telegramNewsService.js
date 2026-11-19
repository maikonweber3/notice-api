import { config } from "../config.js";
import {
  sendTelegramToChats,
  telegramNewsChatIds,
} from "../integrations/telegram/client.js";

export async function mirrorNewsToTelegram(text) {
  const chatIds = telegramNewsChatIds();
  if (!config.telegramBotToken || chatIds.length === 0) {
    return { sent: 0, skipped: true, reason: "telegram_news_not_configured" };
  }
  if (!text?.trim()) {
    return { sent: 0, skipped: true, reason: "empty_message" };
  }
  return sendTelegramToChats({ chatIds, text });
}
