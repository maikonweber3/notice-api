import dotenv from "dotenv";

dotenv.config();

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
  articleEnrichmentBatchSize: Math.min(
    Math.max(Number(process.env.ARTICLE_ENRICHMENT_BATCH_SIZE || 3), 1),
    50
  ),
  articleEnrichmentDelayMs: Math.max(
    Number(process.env.ARTICLE_ENRICHMENT_DELAY_MS || 12000),
    0
  ),
  articleEnrichmentEnabled:
    String(process.env.ARTICLE_ENRICHMENT_ENABLED || "true").toLowerCase() === "true",
};
