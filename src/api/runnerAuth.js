import { config } from "../config.js";

function extractRunnerToken(request) {
  const auth = request.headers.authorization;
  if (typeof auth === "string") {
    const trimmed = auth.trim();
    if (/^bearer\s+/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, "").trim();
    }
    return trimmed;
  }
  const header = request.headers["x-runner-token"];
  if (typeof header === "string") {
    return header.trim();
  }
  return null;
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
