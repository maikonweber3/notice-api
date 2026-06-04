import { config } from "../config.js";

function extractRunnerToken(request) {
  const auth = request.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const header = request.headers["x-runner-token"];
  if (typeof header === "string") {
    return header.trim();
  }
  return null;
}

export async function requireRunnerToken(request, reply) {
  if (!config.runnerToken) {
    reply.code(503);
    return { message: "Runner token not configured" };
  }

  const provided = extractRunnerToken(request);
  if (!provided || provided !== config.runnerToken) {
    reply.code(401);
    return { message: "Unauthorized" };
  }
}
