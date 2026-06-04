import { config } from "../../config.js";

const DEFAULT_FREE_MODELS = [
  "poolside/laguna-xs.2:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
];

function uniqueModels(models) {
  const seen = new Set();
  return models.filter((model) => {
    if (!model || seen.has(model)) return false;
    seen.add(model);
    return true;
  });
}

export function buildModelChain(preferredModel) {
  const chain = [];

  if (preferredModel) {
    chain.push(preferredModel);
  } else if (config.openrouterModel) {
    chain.push(config.openrouterModel);
  }

  const freeModels =
    config.openrouterFreeModels.length > 0 ? config.openrouterFreeModels : DEFAULT_FREE_MODELS;

  for (const model of freeModels) {
    chain.push(model);
  }

  if (config.openrouterAllowPaidFallback && config.openrouterPaidFallbackModel) {
    chain.push(config.openrouterPaidFallbackModel);
  }

  return uniqueModels(chain);
}

export function isRateLimitError(message = "") {
  return /rate limit/i.test(message);
}

function extractMessageContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  return "";
}

async function requestCompletion(candidate, { messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "HTTP-Referer": "https://notice-api.local",
        "X-Title": "Notice API",
      },
      body: JSON.stringify({
        model: candidate,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `OpenRouter HTTP ${response.status}`;
      return { ok: false, message, rateLimited: isRateLimitError(message) };
    }

    const text = extractMessageContent(data);
    if (!text) {
      return { ok: false, message: "Resposta vazia do modelo", rateLimited: false };
    }

    return {
      ok: true,
      text,
      model: candidate,
      usage: data.usage || null,
      paid: !candidate.endsWith(":free"),
    };
  } catch (error) {
    const message =
      error.name === "AbortError" ? "Timeout na requisição OpenRouter" : error.message;
    return { ok: false, message, rateLimited: isRateLimitError(message) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatCompletion({
  messages,
  model,
  maxTokens = config.openrouterMaxTokens,
  temperature = 0.7,
}) {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY é obrigatório");
  }

  const models = buildModelChain(model);
  if (models.length === 0) {
    throw new Error("Nenhum modelo OpenRouter configurado");
  }

  const errors = [];
  let sawRateLimit = false;

  for (const candidate of models) {
    const result = await requestCompletion(candidate, { messages, maxTokens, temperature });

    if (result.ok) {
      return {
        text: result.text,
        model: result.model,
        usage: result.usage,
        paid: result.paid,
      };
    }

    errors.push({ model: candidate, message: result.message });
    if (result.rateLimited) {
      sawRateLimit = true;
    }
  }

  const details = errors.map((entry) => `${entry.model}: ${entry.message}`).join("; ");
  const prefix = sawRateLimit
    ? "Limite de requisições OpenRouter atingido"
    : "Todos os modelos falharam";
  throw new Error(`${prefix}. ${details}`);
}
