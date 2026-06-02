import {
  findArticles,
  getArticleById,
  getStats,
} from "../repositories/articlesRepository.js";
import { listSources } from "../repositories/sourcesRepository.js";
import { ensureDefaultSources, runIngestion } from "../services/ingestionService.js";

function parsePagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function registerRoutes(app) {
  app.get("/health", {
    schema: {
      tags: ["System"],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
  }, async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  app.get("/sources", {
    schema: {
      tags: ["Sources"],
      querystring: {
        type: "object",
        properties: {
          category: { type: "string" },
          active: { type: "boolean" },
        },
      },
    },
  }, async (request) => {
    const active = request.query.active ?? true;
    const items = await listSources({ active, category: request.query.category });
    return { items };
  });

  app.get("/articles", {
    schema: {
      tags: ["Articles"],
      querystring: {
        type: "object",
        properties: {
          category: { type: "string" },
          sourceName: { type: "string" },
          sourceType: { type: "string", enum: ["rss", "html"] },
          q: { type: "string" },
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (request) => {
    const { page, limit, offset } = parsePagination(request.query);
    const { items, total } = await findArticles({
      category: request.query.category,
      sourceName: request.query.sourceName,
      sourceType: request.query.sourceType,
      q: request.query.q,
      from: request.query.from,
      to: request.query.to,
      limit,
      offset,
    });

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  });

  app.get("/articles/:id", {
    schema: {
      tags: ["Articles"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const item = await getArticleById(request.params.id);
    if (!item) {
      reply.code(404);
      return { message: "Not found" };
    }
    return item;
  });

  app.get("/stats", {
    schema: {
      tags: ["Stats"],
    },
  }, async () => getStats());

  app.post("/ingestion/run", {
    schema: {
      tags: ["Ingestion"],
      body: {
        type: "object",
        properties: {
          category: { type: "string" },
          ensureSources: { type: "boolean" },
        },
      },
    },
  }, async (request) => {
    if (request.body?.ensureSources ?? true) {
      await ensureDefaultSources();
    }
    const result = await runIngestion({ category: request.body?.category });
    return result;
  });
}
