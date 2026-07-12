import { chatCompletion } from "../integrations/openrouter/client.js";
import { postTweet, isXConfigured } from "../integrations/x/client.js";
import { config } from "../config.js";
import {
  claimNextPending,
  enqueueXPost,
  getXPostById,
  getXPostQueueStats,
  markXPostFailed,
  markXPostPosted,
  resetStuckProcessing,
} from "../repositories/xPostQueueRepository.js";

const X_TWEET_MAX_CHARS = 280;
const X_TWEET_SAFE_CHARS = 275;

const SUMMARIZE_SYSTEM_PROMPT = `Você é um redator de impacto para o X (Twitter), em português do Brasil.
Sua missão: transformar o texto-fonte em um post que PARE o scroll e fale com uma multidão.

Estilo obrigatório:
- Criativo, expressivo e com personalidade — nunca genérico nem burocrático.
- Dirija-se ao público como massa: use "vocês", "a gente", perguntas retóricas ou chamadas diretas quando couber.
- Frases com ritmo: contraste, urgência, curiosidade ou indignação leve, conforme o assunto.
- Linguagem de quem comenta a notícia para milhares de pessoas ao vivo, não de quem redige release.
- Preserve apenas fatos presentes no texto; não invente dados, nomes ou conclusões.
- Proibido: emojis, emoticons, hashtags, markdown, aspas envolvendo o post inteiro, listas.
- Máximo absoluto de ${X_TWEET_SAFE_CHARS} caracteres (espaços e pontuação contam).
- Uma ou duas frases densas; cada palavra precisa justificar espaço.

Responda APENAS com o texto final do post, sem explicações.`;

function buildSummarizePrompt(sourceText) {
  return [
    "Reescreva o conteúdo abaixo para o X.",
    "Fale com energia para uma multidão. Seja memorável, direto e humano.",
    "Não use emojis.",
    "",
    "Texto-fonte:",
    sourceText,
  ].join("\n");
}

function stripEmojis(text) {
  return text
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTweetText(text) {
  let normalized = stripEmojis(text.trim().replace(/^["']|["']$/g, "")).replace(/\s+/g, " ");

  if (normalized.length > X_TWEET_SAFE_CHARS) {
    const slice = normalized.slice(0, X_TWEET_SAFE_CHARS - 1);
    const lastSpace = slice.lastIndexOf(" ");
    normalized =
      (lastSpace > X_TWEET_SAFE_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
  }

  return normalized;
}

export async function summarizeForX(sourceText) {
  const { text, model } = await chatCompletion({
    messages: [
      { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
      { role: "user", content: buildSummarizePrompt(sourceText) },
    ],
    maxTokens: 200,
    temperature: 0.88,
  });

  return {
    tweetText: normalizeTweetText(text),
    model,
  };
}

export async function queueXPost(sourceText) {
  const trimmed = sourceText.trim();
  if (!trimmed) {
    throw new Error("Texto não pode ser vazio");
  }
  if (trimmed.length > config.xPostMaxInputChars) {
    throw new Error(`Texto excede o limite de ${config.xPostMaxInputChars} caracteres`);
  }

  return enqueueXPost(trimmed);
}

export async function processNextXPost() {
  await resetStuckProcessing();

  const item = await claimNextPending();
  if (!item) {
    return { processed: false, reason: "empty_queue" };
  }

  if (!isXConfigured()) {
    await markXPostFailed(item.id, {
      errorMessage: "Credenciais X não configuradas",
    });
    return { processed: true, id: item.id, status: "failed", error: "X not configured" };
  }

  if (!config.openrouterApiKey) {
    await markXPostFailed(item.id, {
      errorMessage: "OPENROUTER_API_KEY não configurada",
    });
    return { processed: true, id: item.id, status: "failed", error: "OpenRouter not configured" };
  }

  let summarizedText = null;
  let model = null;

  try {
    const summary = await summarizeForX(item.sourceText);
    summarizedText = summary.tweetText;
    model = summary.model;

    const posted = await postTweet(summarizedText);

    await markXPostPosted(item.id, {
      summarizedText,
      xTweetId: posted.tweetId,
    });

    return {
      processed: true,
      id: item.id,
      status: "posted",
      xTweetId: posted.tweetId,
      summarizedText,
      charCount: summarizedText.length,
      model,
    };
  } catch (error) {
    await markXPostFailed(item.id, {
      summarizedText,
      errorMessage: error.message,
    });

    return {
      processed: true,
      id: item.id,
      status: "failed",
      summarizedText,
      model,
      error: error.message,
    };
  }
}

export async function runXPostWorker() {
  const result = await processNextXPost();
  return result;
}

export { getXPostById, getXPostQueueStats };
