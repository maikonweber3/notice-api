import axios from "axios";
import { existsSync } from "node:fs";
import { config } from "../config.js";
import {
  sendTelegramToChats,
  isTelegramConfigured,
} from "../integrations/telegram/client.js";
import {
  getLatestBitcoinAnalysis,
  insertBitcoinAnalysis,
} from "../repositories/bitcoinAnalysesRepository.js";

function pickPlotPath(plotFiles) {
  const files = Array.isArray(plotFiles) ? plotFiles.filter(Boolean) : [];
  return (
    files.find((file) => String(file).endsWith("_analysis.png")) || files[0] || null
  );
}

function fallbackSummary(data) {
  const latest = data?.latest || {};
  const forecast = data?.price_forecast_linear || {};
  const lines = [
    `📊 ${data?.symbol || config.bitcoinSymbol} | ${data?.interval || config.bitcoinInterval}`,
    latest.close != null ? `💰 Atual: $${Number(latest.close).toFixed(2)}` : null,
    latest.RSI != null ? `RSI: ${Number(latest.RSI).toFixed(1)}` : null,
    forecast.predicted_close != null
      ? `🔮 Próx: $${Number(forecast.predicted_close).toFixed(2)}`
      : null,
    "⚠️ Educativo, não recomendação financeira.",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function fetchCryptoAnalysis({
  symbol = config.bitcoinSymbol,
  interval = config.bitcoinInterval,
  limit = config.bitcoinCandleLimit,
  plots = true,
} = {}) {
  const response = await axios.get(`${config.cryptoAnalyticUrl}/analyze`, {
    params: {
      symbol,
      interval,
      limit,
      plots,
      telegram: false,
    },
    timeout: config.cryptoAnalyticTimeoutMs,
    validateStatus: (status) => status < 500,
  });

  const data = response.data;
  if (!data?.ok) {
    throw new Error(data?.error || `crypto-analytic HTTP ${response.status}`);
  }
  return data;
}

export async function runBitcoinDailyAnalysis({ publish = true } = {}) {
  const data = await fetchCryptoAnalysis({ plots: true });
  const plotPath = pickPlotPath(data.plot_files);
  const telegramSummary = data.telegram_summary || fallbackSummary(data);

  const analysis = await insertBitcoinAnalysis({
    symbol: data.symbol || config.bitcoinSymbol,
    interval: data.interval || config.bitcoinInterval,
    payload: data,
    telegramSummary,
    plotPath,
  });

  let telegram = { skipped: true, reason: "publish_disabled" };
  if (publish) {
    if (!isTelegramConfigured()) {
      telegram = { skipped: true, reason: "telegram_not_configured" };
    } else {
      const photoPath = plotPath && existsSync(plotPath) ? plotPath : null;
      telegram = await sendTelegramToChats({
        chatIds: config.telegramChatIds,
        text: telegramSummary,
        photoPath,
      });
    }
  }

  return { analysis, telegram };
}

export async function getBitcoinLatest({ symbol, interval } = {}) {
  return getLatestBitcoinAnalysis({
    symbol: symbol || config.bitcoinSymbol,
    interval: interval || config.bitcoinInterval,
  });
}
