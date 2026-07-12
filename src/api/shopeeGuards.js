import { config } from "../config.js";
import { requireRunnerToken } from "./runnerAuth.js";

const buckets = new Map();

function getClientKey(request) {
  return (
    request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    request.ip ||
    "unknown"
  );
}

function takeToken(key, limitPerMin) {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limitPerMin) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.windowStart)) / 1000));
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limitPerMin - bucket.count };
}

/** Limpa buckets antigos periodicamente para evitar crescimento infinito. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart >= 60_000) {
      buckets.delete(key);
    }
  }
}, 60_000).unref?.();

export function parseQueryBool(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
}

/**
 * Rate limit para rotas live da Shopee.
 * Opcionalmente exige RUNNER_TOKEN em todas as lives ou só em refresh=true.
 */
export function createShopeeLiveGuards() {
  return async function shopeeLiveGuards(request, reply) {
    if (config.shopeeLiveRequireToken) {
      const authResult = await requireRunnerToken(request, reply);
      if (authResult || reply.sent) return authResult;
    }

    const refresh = parseQueryBool(request.query?.refresh) === true;
    if (refresh && config.shopeeRefreshRequireToken) {
      const authResult = await requireRunnerToken(request, reply);
      if (authResult || reply.sent) return authResult;
    }

    const decision = takeToken(getClientKey(request), config.shopeeLiveRateLimitPerMin);
    if (!decision.allowed) {
      reply.header("Retry-After", String(decision.retryAfterSec));
      return reply.code(429).send({
        message: "Rate limit exceeded for Shopee live search",
        retryAfterSec: decision.retryAfterSec,
      });
    }
  };
}
