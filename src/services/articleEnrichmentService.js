import { chatCompletion, isRateLimitError } from "../integrations/openrouter/client.js";
import { findArticlesPendingEnrichment, updateArticleBody } from "../repositories/articlesRepository.js";
import { config } from "../config.js";
import { ensureDefaultSources, runIngestion } from "./ingestionService.js";

const SYSTEM_PROMPT = `Você é redator de um portal de notícias em português do Brasil.
Escreva textos claros, envolventes e bem revisados para leitores gerais.
Use o título como eixo principal da narrativa.
Não invente fatos que não estejam no contexto fornecido.
Não use markdown, listas numeradas ou títulos extras.
Responda apenas com o texto final, em 2 ou 3 parágrafos curtos.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUserPrompt(article) {
  const lines = [
    `Título: ${article.title}`,
    `Categoria: ${article.category}`,
    `Fonte: ${article.sourceName || "Desconhecida"}`,
  ];

  if (article.summary) {
    lines.push(`Contexto (resumo original): ${article.summary}`);
  }

  lines.push(
    "",
    "Com base principalmente no título, escreva um texto interessante e bem escrito sobre esta notícia."
  );

  return lines.join("\n");
}

export async function generateArticleBody(article) {
  const { text, model, paid } = await chatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(article) },
    ],
    temperature: 0.65,
  });

  return { body: text, model, paid: Boolean(paid) };
}

function shouldStopBatch(error) {
  if (!isRateLimitError(error.message)) {
    return false;
  }

  const hasPaidFallback =
    config.openrouterAllowPaidFallback && Boolean(config.openrouterPaidFallbackModel);

  return !hasPaidFallback;
}

export async function runArticleEnrichment({
  category,
  limit = config.articleEnrichmentBatchSize,
  ensureIngestion = true,
  ensureSources = true,
} = {}) {
  if (ensureSources) {
    await ensureDefaultSources();
  }

  let ingestion = null;
  if (ensureIngestion) {
    ingestion = await runIngestion({ category });
  }

  const articles = await findArticlesPendingEnrichment({ category, limit });
  let processed = 0;
  let enriched = 0;
  const failures = [];
  const modelsUsed = new Set();
  let stoppedEarly = false;

  for (let index = 0; index < articles.length; index += 1) {
    const article = articles[index];

    if (index > 0 && config.articleEnrichmentDelayMs > 0) {
      await sleep(config.articleEnrichmentDelayMs);
    }

    processed += 1;
    try {
      const { body, model } = await generateArticleBody(article);
      await updateArticleBody(article.id, body);
      enriched += 1;
      modelsUsed.add(model);
    } catch (error) {
      failures.push({
        id: article.id,
        title: article.title,
        message: error.message,
      });

      if (shouldStopBatch(error)) {
        stoppedEarly = true;
        break;
      }
    }
  }

  return {
    ingestion,
    pendingBefore: articles.length,
    processed,
    enriched,
    modelsUsed: [...modelsUsed],
    failures,
    stoppedEarly,
    delayMs: config.articleEnrichmentDelayMs,
    paidFallbackConfigured: Boolean(config.openrouterPaidFallbackModel),
  };
}
