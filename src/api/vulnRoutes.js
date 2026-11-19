import {
  findVulnerabilities,
  getVulnerability,
  getVulnerabilityStats,
} from "../repositories/vulnerabilitiesRepository.js";
import { runVulnerabilitySync } from "../services/vulnerabilitySyncService.js";
import { requireRunnerToken } from "./runnerAuth.js";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE", "UNKNOWN"];

function parseSeverity(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SEVERITIES.includes(s));
}

export async function registerVulnRoutes(app) {
  app.get("/vulnerabilities", {
    schema: {
      tags: ["Vulnerabilities"],
      description: "CVEs/advisories (NVD, CISA KEV, GitHub Advisories). Ordenado por última modificação.",
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", description: "CVE-ID, GHSA-ID ou texto (vendor, produto, descrição)" },
          severity: { type: "string", description: "CSV: CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN" },
          kev: { type: "boolean", description: "Só exploradas ativamente (CISA KEV)" },
          source: { type: "string", enum: ["nvd", "kev", "ghsa"] },
          minScore: { type: "number", minimum: 0, maximum: 10 },
          from: { type: "string", format: "date-time" },
          sort: { type: "string", enum: ["modified", "published", "score", "kev"] },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (request) => {
    const page = Math.max(Number(request.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(request.query.limit || 20), 1), 100);
    const { items, total } = await findVulnerabilities({
      q: request.query.q,
      severity: parseSeverity(request.query.severity),
      kev: request.query.kev === true || request.query.kev === "true",
      source: request.query.source,
      minScore: request.query.minScore,
      from: request.query.from,
      sort: request.query.sort,
      limit,
      offset: (page - 1) * limit,
    });
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  });

  app.get("/vulnerabilities/stats", {
    schema: { tags: ["Vulnerabilities"], description: "Contagem por severidade, KEV e estado do sync" },
  }, async () => getVulnerabilityStats());

  app.get("/vulnerabilities/:id", {
    schema: {
      tags: ["Vulnerabilities"],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  }, async (request, reply) => {
    const item = await getVulnerability(request.params.id);
    if (!item) {
      reply.code(404);
      return { message: "Vulnerabilidade não encontrada" };
    }
    return item;
  });

  app.post("/vulnerabilities/sync", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["Vulnerabilities"],
      security: [{ runnerToken: [] }],
      body: {
        type: "object",
        properties: { sources: { type: "array", items: { type: "string", enum: ["nvd", "kev", "ghsa"] } } },
      },
    },
  }, async (request) => runVulnerabilitySync({ sources: request.body?.sources }));
}
