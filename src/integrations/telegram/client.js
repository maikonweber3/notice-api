import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { config } from "../../config.js";

const TELEGRAM_API = "https://api.telegram.org";
const MESSAGE_LIMIT = 4096;
const CAPTION_LIMIT = 1024;

function botUrl(method) {
  const token = config.telegramBotToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  }
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

export function isTelegramConfigured() {
  return Boolean(config.telegramBotToken) && config.telegramChatIds.length > 0;
}

export function telegramNewsChatIds() {
  const id = (config.telegramNewsChatId || "").trim();
  return id ? [id] : [];
}

function clip(text, max) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

async function telegramCall(method, body, { form } = {}) {
  const response = form
    ? await fetch(botUrl(method), { method: "POST", body: form })
    : await fetch(botUrl(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const detail = payload.description || response.statusText || `HTTP ${response.status}`;
    throw new Error(`Telegram ${method}: ${detail}`);
  }
  return payload;
}

export async function sendTelegramMessage(chatId, text) {
  return telegramCall("sendMessage", {
    chat_id: chatId,
    text: clip(text, MESSAGE_LIMIT),
    disable_web_page_preview: true,
  });
}

export async function sendTelegramPhoto(chatId, photoPath, caption = "") {
  const bytes = await readFile(photoPath);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) {
    form.append("caption", clip(caption, CAPTION_LIMIT));
  }
  form.append(
    "photo",
    new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    basename(photoPath) || "chart.png"
  );
  return telegramCall("sendPhoto", null, { form });
}

export async function sendTelegramToChats({
  chatIds,
  text,
  photoPath = null,
} = {}) {
  const ids = (chatIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) {
    return { sent: 0, failed: 0, results: [], reason: "no_chat_ids" };
  }
  if (!config.telegramBotToken) {
    return { sent: 0, failed: 0, results: [], reason: "telegram_not_configured" };
  }

  const results = [];
  for (const chatId of ids) {
    try {
      if (photoPath) {
        await sendTelegramPhoto(chatId, photoPath, text);
        if (text && text.length > CAPTION_LIMIT) {
          await sendTelegramMessage(chatId, text);
        }
      } else {
        await sendTelegramMessage(chatId, text);
      }
      results.push({ chatId, ok: true });
    } catch (error) {
      results.push({ chatId, ok: false, error: error.message });
    }
  }

  return {
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}
