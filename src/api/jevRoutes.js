import { requireJevToken } from "./runnerAuth.js";
import {
  defaultJevModel,
  isJevAvailable,
  JevClientError,
  runJevDecision,
} from "../services/jevService.js";

function sendJevError(reply, error) {
  const status =
    Number(error?.statusCode) || (error instanceof JevClientError ? error.statusCode : 502);
  const safeStatus = status >= 400 && status < 600 ? status : 502;
  if (safeStatus >= 500) {
    reply.request?.log?.error?.(error);
  }
  reply.code(safeStatus);
  return { message: error?.message || "Falha ao consultar o Jev" };
}

export async function registerJevRoutes(app) {
  app.get("/jev", {
    schema: {
      tags: ["Jev"],
      description:
        "Status do proxy Jev (TypeSafe via OpenRouter Decisions). Jev não gera texto: responde perguntas tipadas (noul, choice, score) sobre um state.",
    },
  }, async () => ({
    available: isJevAvailable(),
    model: defaultJevModel(),
    endpoint: "POST /jev/decisions",
    docs: "https://openrouter.ai/~typesafe/jev-latest",
    types: ["noul", "choice", "score"],
  }));

  app.post("/jev/decisions", {
    preHandler: requireJevToken,
    schema: {
      tags: ["Jev"],
      security: [{ jevToken: [] }],
      description:
        "Proxy autenticado do Jev via OpenRouter Decisions API. Use o token Jev (Authorization: Bearer … ou X-Jev-Token). A chave OpenRouter fica no servidor.",
      body: {
        type: "object",
        required: ["state", "questions"],
        additionalProperties: false,
        properties: {
          state: {
            description: "Conteúdo a avaliar: string, objeto ou array",
          },
          questions: {
            type: "object",
            additionalProperties: true,
            description:
              "Mapa nome → pergunta. Cada pergunta precisa de type (noul|choice|score) e instructions.",
          },
          model: {
            type: "string",
            description: "Padrão JEV_MODEL (~typesafe/jev-latest). Só modelos typesafe/jev*.",
          },
          sessionId: { type: "string", maxLength: 256 },
          session_id: { type: "string", maxLength: 256 },
          user: { type: "string", maxLength: 256 },
          trace: { type: "object" },
          provider: { type: "object" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await runJevDecision(request.body || {});
    } catch (error) {
      return sendJevError(reply, error);
    }
  });
}
