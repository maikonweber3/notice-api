import { scrapeRss } from "../scrapers/rssScraper.js";
import { scrapeHtml } from "../scrapers/htmlScraper.js";
import { computeArticleHash } from "../utils/hash.js";
import { insertArticles } from "../repositories/articlesRepository.js";
import { deactivateSources, listSources, upsertSources } from "../repositories/sourcesRepository.js";
import { defaultSources, retiredSources } from "../sources/catalog.js";
import { toPlainTextOrNull } from "../utils/plainText.js";
import { runArticleCleanup } from "./cleanupService.js";

export async function ensureDefaultSources() {
  await upsertSources(defaultSources);
  await deactivateSources(retiredSources);
}

export async function runIngestion({ category } = {}) {
  const sources = await listSources({ active: true, category });
  let processedSources = 0;
  let collected = 0;
  let inserted = 0;
  const failures = [];

  for (const source of sources) {
    try {
      let rows = [];
      if (source.sourceType === "rss") {
        rows = await scrapeRss(source.sourceUrl);
      } else {
        rows = await scrapeHtml(source.sourceUrl, source.selector || "article h2, h2, h3");
      }

      const normalized = rows.map((item) => ({
        sourceId: source.id,
        sourceType: source.sourceType,
        sourceName: source.name,
        sourceUrl: source.sourceUrl,
        category: source.category,
        title: item.title,
        url: item.link || null,
        summary: toPlainTextOrNull(item.summary, { maxLength: 500 }),
        publishedAt: item.publishedAt || null,
        collectedAt: item.collectedAt,
        contentHash: computeArticleHash({
          title: item.title,
          link: item.link || "",
          sourceUrl: source.sourceUrl,
          category: source.category,
        }),
      }));

      const result = await insertArticles(normalized);
      processedSources += 1;
      collected += normalized.length;
      inserted += result.inserted;
    } catch (error) {
      failures.push({ source: source.sourceUrl, message: error.message });
    }
  }

  const ingestion = {
    processedSources,
    collected,
    inserted,
    failures,
  };

  const cleanup = await runArticleCleanup();

  return { ...ingestion, cleanup };
}
