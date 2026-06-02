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
};
