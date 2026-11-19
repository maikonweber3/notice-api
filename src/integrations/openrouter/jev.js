import { config } from "../../config.js";

export function openrouterOrigin() {
  const base = String(config.openrouterBaseUrl || "https://openrouter.ai/api/v1").replace(
    /\/$/,
    ""
  );
  if (base.endsWith("/api/v1")) return base.slice(0, -"/api/v1".length);
  if (base.endsWith("/api")) return base.slice(0, -"/api".length);
  try {
    return new URL(base).origin;
  } catch {
    return "https://openrouter.ai";
  }
}

export function jevDecisionsUrl() {
  return `${openrouterOrigin()}/api/alpha/decisions`;
}

export async function submitJevDecision({
  model,
  state,
  questions,
  sessionId,
  user,
  trace,
  provider,
}) {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY é obrigatório");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.jevTimeoutMs);

  const payload = {
    model,
    state,
    questions,
  };
  if (sessionId) payload.session_id = sessionId;
  if (user) payload.user = user;
  if (trace && typeof trace === "object") payload.trace = trace;
  if (provider && typeof provider === "object") payload.provider = provider;

  try {
    const response = await fetch(jevDecisionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "HTTP-Referer": "https://notice.muttercorp.com.br",
        "X-Title": "Notice API",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        data?.error?.message || data?.message || `OpenRouter HTTP ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw error;
    }

    if (!data?.answers || typeof data.answers !== "object") {
      throw new Error("Resposta inválida do Jev (sem answers)");
    }

    return {
      id: data.id || null,
      model: data.model || model,
      provider: data.provider || "TypeSafe",
      answers: data.answers,
      usage: data.usage || null,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Timeout na requisição Jev/OpenRouter");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
