import { pruneArticles } from "../repositories/articlesRepository.js";
import { config } from "../config.js";

export async function runArticleCleanup(overrides = {}) {
  if (!config.cleanupEnabled && overrides.force !== true) {
    return { deleted: 0, skipped: true, reason: "cleanup_disabled" };
  }

  const maxPerCategory = overrides.maxPerCategory ?? config.articlesMaxPerCategory;
  const maxAgeDays = overrides.maxAgeDays ?? config.articlesMaxAgeDays;

  const result = await pruneArticles({ maxPerCategory, maxAgeDays });

  return {
    deleted: result.deleted,
    deletedByAge: result.deletedByAge,
    deletedByCount: result.deletedByCount,
    maxPerCategory,
    maxAgeDays,
  };
}
