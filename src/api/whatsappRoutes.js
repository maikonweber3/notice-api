import { requireRunnerToken } from "./runnerAuth.js";
import {
  getInstanceRow,
  getSessionSnapshot,
  listWhatsAppGroups,
  startSession,
  stopSession,
} from "../integrations/whatsapp/gateway.js";
import {
  deleteOfferGroup,
  listOfferGroups,
  listPublicOfferGroups,
  updateOfferGroup,
} from "../repositories/offerGroupsRepository.js";
import { findRankedOffers, refreshOfferRankScores } from "../services/offerRankService.js";
import {
  drainWhatsAppQueue,
  getWhatsAppQueueStats,
  publishNewsNow,
  publishNow,
  registerGroupFromWhatsApp,
} from "../services/whatsappOfferService.js";

function parsePagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function registerWhatsAppRoutes(app) {
  app.get("/offers/ranking", {
    schema: {
      tags: ["Ofertas"],
      description: "Melhores ofertas Shopee pelo ranking Notice (vendas, desconto, avaliação, comissão)",
      querystring: {
        type: "object",
        properties: {
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: 50 },
          minScore: { type: "number" },
        },
      },
    },
  }, async (request) => {
    const { page, limit, offset } = parsePagination(request.query);
    const { items, total } = await findRankedOffers({
      limit,
      offset,
      minScore: Number(request.query.minScore || 0),
    });
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  });

  app.get("/offer-groups", {
    schema: {
      tags: ["Ofertas"],
      description: "Grupos de WhatsApp que recebem as melhores ofertas Shopee",
    },
  }, async () => {
    const items = await listPublicOfferGroups();
    return { items };
  });

  app.get("/whatsapp/session", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => {
    const row = await getInstanceRow();
    return { ...row, ...getSessionSnapshot() };
  });

  app.post("/whatsapp/session/start", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => startSession());

  app.delete("/whatsapp/session", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => {
    await stopSession({ logout: true });
    return { status: "disconnected" };
  });

  app.get("/whatsapp/groups", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => {
    const items = await listWhatsAppGroups();
    return { items };
  });

  app.get("/whatsapp/offer-groups", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => {
    const items = await listOfferGroups();
    return { items };
  });

  app.post("/whatsapp/offer-groups", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["WhatsApp"],
      body: {
        type: "object",
        required: ["jid"],
        properties: {
          jid: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          postsPerRun: { type: "number" },
          minRankScore: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const group = await registerGroupFromWhatsApp(request.body);
      reply.code(201);
      return group;
    } catch (error) {
      reply.code(400);
      return { message: error.message };
    }
  });

  app.patch("/whatsapp/offer-groups/:id", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async (request, reply) => {
    const group = await updateOfferGroup(request.params.id, request.body || {});
    if (!group) {
      reply.code(404);
      return { message: "Not found" };
    }
    return group;
  });

  app.delete("/whatsapp/offer-groups/:id", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async (request, reply) => {
    const ok = await deleteOfferGroup(request.params.id);
    if (!ok) {
      reply.code(404);
      return { message: "Not found" };
    }
    return { deleted: true };
  });

  app.get("/whatsapp/posts/stats", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => {
    const byStatus = await getWhatsAppQueueStats();
    return { byStatus };
  });

  app.post("/whatsapp/rank/refresh", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => refreshOfferRankScores());

  app.post("/whatsapp/publish", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["WhatsApp"],
      description: "Enfileira o ranking atual e publica nos grupos de ofertas",
    },
  }, async () => publishNow());

  app.post("/whatsapp/news/publish", {
    preHandler: requireRunnerToken,
    schema: {
      hide: true,
      tags: ["WhatsApp"],
      description: "Publica uma notícia aleatória + ofertas no grupo MutterCorp",
    },
  }, async () => publishNewsNow());

  app.post("/whatsapp/posts/process", {
    preHandler: requireRunnerToken,
    schema: { hide: true, tags: ["WhatsApp"] },
  }, async () => drainWhatsAppQueue({ max: 20 }));
}
