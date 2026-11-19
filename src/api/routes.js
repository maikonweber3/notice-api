import {
  findArticles,
  getArticleById,
  getStats,
} from "../repositories/articlesRepository.js";
import { listSources } from "../repositories/sourcesRepository.js";
import { config } from "../config.js";
import { ensureDefaultSources, runIngestion } from "../services/ingestionService.js";
import { runArticleCleanup } from "../services/cleanupService.js";
import { countArticles } from "../repositories/articlesRepository.js";
import {
  findBanners,
  getBannerById,
  getFeaturedBanners,
  getSyncStats,
} from "../repositories/shopeeOffersRepository.js";
import { runShopeeSync } from "../services/shopeeSyncService.js";
import {
  getXPostById,
  getXPostQueueStats,
  queueXPost,
  runXPostWorker,
} from "../services/xPostService.js";
import { requireRunnerToken } from "./runnerAuth.js";
import { registerShopeeRoutes } from "./shopeeRoutes.js";
import { registerWhatsAppRoutes } from "./whatsappRoutes.js";
import { registerJevRoutes } from "./jevRoutes.js";
import { registerVulnRoutes } from "./vulnRoutes.js";
import {
  getBitcoinLatest,
  runBitcoinDailyAnalysis,
} from "../services/bitcoinDailyService.js";

function parsePagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function registerRoutes(app) {
  await registerShopeeRoutes(app);
  await registerWhatsAppRoutes(app);
  await registerJevRoutes(app);
  await registerVulnRoutes(app);

  app.get("/bitcoin/latest", {
    schema: {
      tags: ["Bitcoin"],
      description: "Última análise diária de Bitcoin gerada pelo notice-api",
    },
  }, async (request, reply) => {
    const item = await getBitcoinLatest({
      symbol: request.query?.symbol,
      interval: request.query?.interval,
    });
    if (!item) {
      reply.code(404);
      return { message: "Nenhuma análise de Bitcoin encontrada" };
    }
    return item;
  });

  app.post("/bitcoin/run", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["Bitcoin"],
      security: [{ runnerToken: [] }],
      description: "Dispara análise diária de Bitcoin (crypto-analytic) e publica no Telegram",
    },
  }, async () => runBitcoinDailyAnalysis({ publish: true }));

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
  }, async () => {
    const stats = await getStats();
    return {
      ...stats,
      retention: {
        cleanupEnabled: config.cleanupEnabled,
        maxPerCategory: config.articlesMaxPerCategory,
        maxAgeDays: config.articlesMaxAgeDays,
      },
    };
  });

  app.post("/cleanup/run", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["Cleanup"],
      security: [{ runnerToken: [] }],
      body: {
        type: "object",
        properties: {
          maxPerCategory: { type: "number", minimum: 0 },
          maxAgeDays: { type: "number", minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const before = await countArticles();
    const cleanup = await runArticleCleanup({
      force: true,
      maxPerCategory: request.body?.maxPerCategory,
      maxAgeDays: request.body?.maxAgeDays,
    });
    const after = await countArticles();
    return { before, after, cleanup };
  });

  app.post("/ingestion/run", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["Ingestion"],
      security: [{ runnerToken: [] }],
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

  // Rotas X — internas (RUNNER_TOKEN); ocultas do Swagger público
  app.post("/x/posts/queue", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["X"],
      security: [{ runnerToken: [] }],
      description:
        "Enfileira texto (até 3000 caracteres) para resumo via LLM e publicação no X",
      body: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string", minLength: 1, maxLength: 3000 },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            id: { type: "number" },
            status: { type: "string" },
            sourceTextLength: { type: "number" },
            createdAt: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const item = await queueXPost(request.body.text);
      reply.code(201);
      return {
        id: item.id,
        status: item.status,
        sourceTextLength: item.sourceText.length,
        createdAt: item.createdAt,
      };
    } catch (error) {
      reply.code(400);
      return { message: error.message };
    }
  });

  app.get("/x/posts/:id", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["X"],
      security: [{ runnerToken: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const item = await getXPostById(request.params.id);
    if (!item) {
      reply.code(404);
      return { message: "Not found" };
    }
    return item;
  });

  app.get("/x/posts/stats/queue", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["X"],
      security: [{ runnerToken: [] }],
    },
  }, async () => {
    const byStatus = await getXPostQueueStats();
    return { byStatus };
  });

  app.post("/x/posts/process", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["X"],
      security: [{ runnerToken: [] }],
      description: "Processa manualmente o próximo item da fila (mesmo fluxo do worker)",
    },
  }, async () => runXPostWorker());

  app.get("/banners", {
    schema: {
      tags: ["Banners"],
      description: "Lista ofertas Shopee formatadas para banners digitais no frontend",
      querystring: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["product", "shop", "campaign"] },
          placement: { type: "string" },
          featured: { type: "boolean" },
          q: { type: "string" },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (request) => {
    const { page, limit, offset } = parsePagination(request.query);
    const { items, total } = await findBanners({
      offerType: request.query.type,
      placement: request.query.placement,
      featured: request.query.featured,
      q: request.query.q,
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

  app.get("/banners/featured", {
    schema: {
      tags: ["Banners"],
      description: "Banners em destaque para carrossel ou hero section",
      querystring: {
        type: "object",
        properties: {
          placement: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
      },
    },
  }, async (request) => {
    const limit = Math.min(Math.max(Number(request.query.limit || 5), 1), 20);
    const items = await getFeaturedBanners(limit, request.query.placement);
    return { items, limit, placement: request.query.placement || null };
  });

  app.get("/banners/stats/sync", {
    schema: {
      tags: ["Banners"],
      description: "Status da última sincronização de ofertas Shopee",
    },
  }, async () => getSyncStats());

  app.get("/banners/:id", {
    schema: {
      tags: ["Banners"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const item = await getBannerById(request.params.id);
    if (!item) {
      reply.code(404);
      return { message: "Not found" };
    }
    return item;
  });

  app.post("/banners/sync", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["Banners"],
      security: [{ runnerToken: [] }],
      description: "Dispara sincronização manual de ofertas Shopee",
      body: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: { type: "string" },
          },
          types: {
            type: "array",
            items: { type: "string", enum: ["product", "shop", "campaign"] },
          },
        },
      },
    },
  }, async (request) => {
    const result = await runShopeeSync({
      keywords: request.body?.keywords,
      types: request.body?.types,
    });
    return result;
  });
}
