import dotenv from "dotenv";

dotenv.config();

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  userAgent:
    process.env.USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 15000),
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  cronEnabled: String(process.env.CRON_ENABLED || "true").toLowerCase() === "true",
  cronExpression: process.env.CRON_EXPRESSION || "*/30 * * * *",
  cleanupEnabled: String(process.env.ARTICLES_CLEANUP_ENABLED || "true").toLowerCase() === "true",
  articlesMaxPerCategory: Math.max(Number(process.env.ARTICLES_MAX_PER_CATEGORY || 200), 0),
  articlesMaxAgeDays: Math.max(Number(process.env.ARTICLES_MAX_AGE_DAYS || 14), 0),
  runnerToken: process.env.RUNNER_TOKEN || "",
  shopeeAppId: process.env.SHOPEE_APP_ID || process.env.AppID || "",
  shopeeSecret: process.env.SHOPEE_SECRET || process.env.SHOP_PASSWORD || "",
  shopeeSyncKeywords: (process.env.SHOPEE_SYNC_KEYWORDS || "oferta,promocao,desconto")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean),
  shopeeSyncTypes: (process.env.SHOPEE_SYNC_TYPES || "product,campaign")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean),
  shopeeSyncPageLimit: Math.min(Math.max(Number(process.env.SHOPEE_SYNC_PAGE_LIMIT || 50), 1), 500),
  shopeeSyncMaxPages: Math.max(Number(process.env.SHOPEE_SYNC_MAX_PAGES || 3), 1),
  shopeeProductListType: Number(process.env.SHOPEE_PRODUCT_LIST_TYPE || 1),
  shopeeProductSortType: Number(process.env.SHOPEE_PRODUCT_SORT_TYPE || 5),
  shopeeFeaturedCount: Math.max(Number(process.env.SHOPEE_FEATURED_COUNT || 5), 0),
  shopeeSyncEnabled: String(process.env.SHOPEE_SYNC_ENABLED || "true").toLowerCase() === "true",
  shopeeSyncCron: process.env.SHOPEE_SYNC_CRON || "0 */6 * * *",
  shopeeSyncOnStart: String(process.env.SHOPEE_SYNC_ON_START || "false").toLowerCase() === "true",
  shopeeSearchCacheTtlSeconds: Math.max(
    Number(process.env.SHOPEE_SEARCH_CACHE_TTL_SECONDS || 900),
    0
  ),
  shopeeSearchDefaultLimit: Math.min(
    Math.max(Number(process.env.SHOPEE_SEARCH_DEFAULT_LIMIT || 20), 1),
    100
  ),
  shopeeSearchMaxLimit: Math.min(
    Math.max(Number(process.env.SHOPEE_SEARCH_MAX_LIMIT || 50), 1),
    100
  ),
  shopeeSearchMaxKeywordLength: Math.min(
    Math.max(Number(process.env.SHOPEE_SEARCH_MAX_KEYWORD_LENGTH || 120), 1),
    500
  ),
  shopeeLiveRateLimitPerMin: Math.max(
    Number(process.env.SHOPEE_LIVE_RATE_LIMIT_PER_MIN || 60),
    1
  ),
  shopeeLiveRequireToken: String(process.env.SHOPEE_LIVE_REQUIRE_TOKEN || "false").toLowerCase() === "true",
  shopeeRefreshRequireToken:
    String(process.env.SHOPEE_REFRESH_REQUIRE_TOKEN || "true").toLowerCase() === "true",
  openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  openrouterModel: process.env.OPENROUTER_MODEL || "",
  openrouterPaidFallbackModel: process.env.OPENROUTER_PAID_FALLBACK_MODEL || "",
  openrouterAllowPaidFallback:
    String(process.env.OPENROUTER_ALLOW_PAID_FALLBACK || "true").toLowerCase() === "true",
  openrouterMaxTokens: Math.min(Math.max(Number(process.env.OPENROUTER_MAX_TOKENS || 1024), 128), 8192),
  openrouterFreeModels: (
    process.env.OPENROUTER_FREE_MODELS ||
    "poolside/laguna-xs.2:free,liquid/lfm-2.5-1.2b-instruct:free,liquid/lfm-2.5-1.2b-thinking:free"
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
  jevModel: process.env.JEV_MODEL || "~typesafe/jev-latest",
  jevTimeoutMs: Math.max(Number(process.env.JEV_TIMEOUT_MS || 60_000), 5_000),
  jevApiToken: process.env.JEV_API_TOKEN || "",
  articleEnrichmentBatchSize: Math.min(
    Math.max(Number(process.env.ARTICLE_ENRICHMENT_BATCH_SIZE || 3), 1),
    50
  ),
  articleEnrichmentDelayMs: Math.max(
    Number(process.env.ARTICLE_ENRICHMENT_DELAY_MS || 12000),
    0
  ),
  articleEnrichmentEnabled:
    String(process.env.ARTICLE_ENRICHMENT_ENABLED || "false").toLowerCase() === "true",
  xApiKey: process.env.API_KEY_X || process.env.X_API_KEY || "",
  xApiSecret: process.env.API_SECRET_X || process.env.X_API_SECRET || "",
  xBearerToken: (() => {
    const raw = process.env.X_BEARER_TOKEN || "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })(),
  xAccessToken: process.env.X_ACCESS_TOKEN || "",
  xAccessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
  xPostMaxInputChars: Math.min(
    Math.max(Number(process.env.X_POST_MAX_INPUT_CHARS || 3000), 1),
    3000
  ),
  xPostWorkerEnabled: String(process.env.X_POST_WORKER_ENABLED || "true").toLowerCase() === "true",
  xPostWorkerCron: process.env.X_POST_WORKER_CRON || "*/2 * * * *",
  xPostWorkerOnStart: String(process.env.X_POST_WORKER_ON_START || "false").toLowerCase() === "true",
  whatsappSessionDir: process.env.WHATSAPP_SESSION_DIR || "./data/whatsapp-sessions",
  whatsappQrTtlMs: Math.max(Number(process.env.WHATSAPP_QR_TTL_MS || 60_000), 5_000),
  whatsappReconnectDelayMs: Math.max(
    Number(process.env.WHATSAPP_RECONNECT_DELAY_MS || 5000),
    1000
  ),
  whatsappPublishEnabled:
    String(process.env.WHATSAPP_PUBLISH_ENABLED || "true").toLowerCase() === "true",
  whatsappPublishCron: process.env.WHATSAPP_PUBLISH_CRON || "0 */3 * * *",
  whatsappPublishOnStart:
    String(process.env.WHATSAPP_PUBLISH_ON_START || "false").toLowerCase() === "true",
  whatsappNewsEnabled:
    String(process.env.WHATSAPP_NEWS_ENABLED || "true").toLowerCase() === "true",
  whatsappNewsCron: process.env.WHATSAPP_NEWS_CRON || "0 */3 * * *",
  whatsappNewsGroupJid:
    process.env.WHATSAPP_NEWS_GROUP_JID || "120363428120577436@g.us",
  whatsappNewsSiteUrl: (
    process.env.WHATSAPP_NEWS_SITE_URL || "https://news.muttercorp.com.br"
  ).replace(/\/$/, ""),
  whatsappNewsOffers: Math.min(
    Math.max(Number(process.env.WHATSAPP_NEWS_OFFERS || 0), 0),
    5
  ),
  whatsappNewsPerRun: 1,
  whatsappNewsLookbackHours: Math.min(
    Math.max(Number(process.env.WHATSAPP_NEWS_LOOKBACK_HOURS || 36), 6),
    168
  ),
  whatsappNewsThemes: parseCsv(
    process.env.WHATSAPP_NEWS_THEMES ||
      "tecnologia,investimentos,games,esportes,entretenimento,cinema,programacao,mercado-crypto"
  ),
  whatsappPostsPerRun: Math.min(
    Math.max(Number(process.env.WHATSAPP_POSTS_PER_RUN || 2), 1),
    20
  ),
  whatsappOfferCooldownHours: Math.max(
    Number(process.env.WHATSAPP_OFFER_COOLDOWN_HOURS || 48),
    1
  ),
  whatsappDrainMs: Math.max(Number(process.env.WHATSAPP_DRAIN_MS || 15_000), 5_000),
  telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),
  telegramNewsChatId: (
    process.env.TELEGRAM_NEWS_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    parseCsv(process.env.TELEGRAM_CHAT_IDS || "@btcusdtprevisao")[0] ||
    ""
  ).trim(),
  telegramChatIds: [
    ...new Set([
      ...parseCsv(
        process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "@btcusdtprevisao"
      ),
      (
        process.env.TELEGRAM_NEWS_CHAT_ID ||
        process.env.TELEGRAM_CHAT_ID ||
        ""
      ).trim(),
    ].filter(Boolean)),
  ],
  bitcoinAnalysisEnabled:
    String(process.env.BITCOIN_ANALYSIS_ENABLED || "true").toLowerCase() === "true",
  bitcoinAnalysisCron: process.env.BITCOIN_ANALYSIS_CRON || "0 8 * * *",
  bitcoinAnalysisTimezone: process.env.BITCOIN_ANALYSIS_TIMEZONE || "America/Sao_Paulo",
  bitcoinSymbol: (process.env.BITCOIN_SYMBOL || "BTCUSDT").trim(),
  bitcoinInterval: (process.env.BITCOIN_INTERVAL || "1d").trim(),
  bitcoinCandleLimit: Math.min(
    Math.max(Number(process.env.BITCOIN_CANDLE_LIMIT || 500), 50),
    1000
  ),
  cryptoAnalyticUrl: (
    process.env.CRYPTO_ANALYTIC_URL || "http://127.0.0.1:8765"
  ).replace(/\/$/, ""),
  cryptoAnalyticTimeoutMs: Math.max(
    Number(process.env.CRYPTO_ANALYTIC_TIMEOUT_MS || 180_000),
    10_000
  ),
};
