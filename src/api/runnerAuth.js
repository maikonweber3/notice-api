import { config } from "../config.js";

function extractBearerOrHeader(request, extraHeader) {
  const auth = request.headers.authorization;
  if (typeof auth === "string") {
    const trimmed = auth.trim();
    if (/^bearer\s+/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, "").trim();
    }
    return trimmed;
  }
  const header = request.headers[extraHeader];
  if (typeof header === "string") {
    return header.trim();
  }
  return null;
}

function extractRunnerToken(request) {
  return extractBearerOrHeader(request, "x-runner-token");
}

export async function requireRunnerToken(request, reply) {
  if (!config.runnerToken) {
    return reply.code(503).send({ message: "Runner token not configured" });
  }

  const provided = extractRunnerToken(request);
  if (!provided || provided !== config.runnerToken) {
    return reply.code(401).send({ message: "Unauthorized" });
  }
}

export async function requireJevToken(request, reply) {
  if (!config.jevApiToken) {
    return reply.code(503).send({ message: "Jev token not configured" });
  }

  const provided = extractBearerOrHeader(request, "x-jev-token");
  const allowed = new Set([config.jevApiToken, config.runnerToken].filter(Boolean));
  if (!provided || !allowed.has(provided)) {
    return reply.code(401).send({ message: "Unauthorized" });
  }
}
