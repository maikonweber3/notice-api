import { config } from "../config.js";
import {
  getShopeeOfferByExternalId,
  getShopeePlatformStats,
  searchShopeeCatalog,
  searchShopeeLive,
} from "../services/shopeeSearchService.js";
import { createShopeeLiveGuards, parseQueryBool } from "./shopeeGuards.js";

function sendSearchError(reply, error) {
  const message = error?.message || "Erro na busca Shopee";
  const isClient =
    /obrigatório|inválido|keyword|Tipo inválido|externalId|excede o máximo/i.test(message);

  if (isClient) {
    reply.code(400);
    return { message };
  }

  // Evita vazar detalhes da Open API / stack no cliente.
  requestLog(reply, error);
  reply.code(502);
  return { message: "Falha ao consultar a Shopee Affiliate API" };
}

function requestLog(reply, error) {
  try {
    reply.request?.log?.error?.(error);
  } catch {
    // ignore
  }
}

export async function registerShopeeRoutes(app) {
  const liveGuards = createShopeeLiveGuards();
  const maxLimit = config.shopeeSearchMaxLimit;

  const liveQuerystring = {
    type: "object",
    required: ["keyword"],
    properties: {
      keyword: {
        type: "string",
        minLength: 1,
        maxLength: config.shopeeSearchMaxKeywordLength,
        description: "Termo de busca livre (categoria, produto, marca, etc.)",
      },
      page: { type: "number", minimum: 1 },
      limit: { type: "number", minimum: 1, maximum: maxLimit },
      sortType: {
        type: "integer",
        description: "Ordenação da Open API Shopee (product default 5)",
      },
      listType: {
        type: "integer",
        description: "listType da productOfferV2 (apenas products)",
      },
      refresh: {
        type: "boolean",
        description:
          "Ignora cache Postgres. Requer RUNNER_TOKEN quando SHOPEE_REFRESH_REQUIRE_TOKEN=true",
      },
    },
  };

  app.get("/shopee/products", {
    preHandler: liveGuards,
    schema: {
      tags: ["Shopee Affiliate"],
      description:
        "Busca live de produtos afiliados na Open API Shopee (sem sync). Resultados são cacheados e upsertados no catálogo Postgres sem alterar featured/placement.",
      querystring: liveQuerystring,
    },
  }, async (request, reply) => {
    try {
      return await searchShopeeLive({
        type: "product",
        keyword: request.query.keyword,
        page: request.query.page,
        limit: request.query.limit,
        sortType: request.query.sortType,
        listType: request.query.listType,
        refresh: request.query.refresh,
      });
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/shops", {
    preHandler: liveGuards,
    schema: {
      tags: ["Shopee Affiliate"],
      description: "Busca live de lojas afiliadas na Open API Shopee.",
      querystring: {
        type: "object",
        required: ["keyword"],
        properties: {
          keyword: {
            type: "string",
            minLength: 1,
            maxLength: config.shopeeSearchMaxKeywordLength,
          },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: maxLimit },
          sortType: { type: "integer" },
          refresh: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await searchShopeeLive({
        type: "shop",
        keyword: request.query.keyword,
        page: request.query.page,
        limit: request.query.limit,
        sortType: request.query.sortType,
        refresh: request.query.refresh,
      });
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/campaigns", {
    preHandler: liveGuards,
    schema: {
      tags: ["Shopee Affiliate"],
      description: "Busca live de campanhas/coleções afiliadas na Open API Shopee.",
      querystring: {
        type: "object",
        required: ["keyword"],
        properties: {
          keyword: {
            type: "string",
            minLength: 1,
            maxLength: config.shopeeSearchMaxKeywordLength,
          },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: maxLimit },
          sortType: { type: "integer" },
          refresh: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await searchShopeeLive({
        type: "campaign",
        keyword: request.query.keyword,
        page: request.query.page,
        limit: request.query.limit,
        sortType: request.query.sortType,
        refresh: request.query.refresh,
      });
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/search", {
    preHandler: liveGuards,
    schema: {
      tags: ["Shopee Affiliate"],
      description:
        "Busca unificada live. Informe type=product|shop|campaign e keyword livre.",
      querystring: {
        type: "object",
        required: ["keyword"],
        properties: {
          keyword: {
            type: "string",
            minLength: 1,
            maxLength: config.shopeeSearchMaxKeywordLength,
          },
          type: {
            type: "string",
            enum: ["product", "shop", "campaign"],
            default: "product",
          },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: maxLimit },
          sortType: { type: "integer" },
          listType: { type: "integer" },
          refresh: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await searchShopeeLive({
        type: request.query.type || "product",
        keyword: request.query.keyword,
        page: request.query.page,
        limit: request.query.limit,
        sortType: request.query.sortType,
        listType: request.query.listType,
        refresh: request.query.refresh,
      });
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/catalog", {
    schema: {
      tags: ["Shopee Affiliate"],
      description:
        "Busca eficiente apenas no Postgres (FTS português + trigram + filtros). Não chama a Shopee.",
      querystring: {
        type: "object",
        properties: {
          q: {
            type: "string",
            maxLength: config.shopeeSearchMaxKeywordLength,
            description: "Texto livre (título, loja ou externalId)",
          },
          keyword: {
            type: "string",
            maxLength: config.shopeeSearchMaxKeywordLength,
            description: "Alias de q",
          },
          type: { type: "string", enum: ["product", "shop", "campaign"] },
          placement: { type: "string" },
          featured: { type: "boolean" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          minCommission: {
            type: "number",
            description: "Taxa decimal (ex.: 0.05 = 5%)",
          },
          shopId: { type: "number" },
          categoryId: { type: "number" },
          sort: {
            type: "string",
            enum: ["relevance", "commission", "price_asc", "price_desc", "sales", "recent", "rank"],
          },
          page: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: maxLimit },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await searchShopeeCatalog({
        q: request.query.q,
        keyword: request.query.keyword,
        type: request.query.type,
        placement: request.query.placement,
        featured: parseQueryBool(request.query.featured),
        minPrice: request.query.minPrice,
        maxPrice: request.query.maxPrice,
        minCommission: request.query.minCommission,
        shopId: request.query.shopId,
        categoryId: request.query.categoryId,
        sort: request.query.sort,
        page: request.query.page,
        limit: request.query.limit,
      });
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/offers/:externalId", {
    schema: {
      tags: ["Shopee Affiliate"],
      description:
        "Recupera oferta por itemId/shopId/externalId. Prioriza catálogo local; live só faz upsert do match exato.",
      params: {
        type: "object",
        required: ["externalId"],
        properties: {
          externalId: {
            type: "string",
            maxLength: config.shopeeSearchMaxKeywordLength,
          },
        },
      },
      querystring: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["product", "shop", "campaign"] },
          live: {
            type: "boolean",
            description: "Se true (padrão), tenta Open API quando não achar local",
          },
          refresh: {
            type: "boolean",
            description: "Ignora hit local e força tentativa live (requer token se configurado)",
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const refresh = parseQueryBool(request.query.refresh) === true;
      const allowLive = parseQueryBool(request.query.live) !== false;

      if (!refresh) {
        const local = await getShopeeOfferByExternalId(request.params.externalId, {
          type: request.query.type,
          live: false,
          refresh: false,
        });
        if (local.item) {
          return local;
        }
        if (!allowLive) {
          reply.code(404);
          return {
            message: "Oferta não encontrada",
            externalId: request.params.externalId,
            source: "local",
          };
        }
      } else if (!allowLive) {
        reply.code(400);
        return { message: "refresh=true requer live=true" };
      }

      // Rate limit / auth só quando for chamar a Open API.
      await liveGuards(request, reply);
      if (reply.sent) return;

      const result = await getShopeeOfferByExternalId(request.params.externalId, {
        type: request.query.type,
        live: true,
        refresh,
      });

      if (!result.item) {
        reply.code(404);
        return {
          message: "Oferta não encontrada",
          externalId: request.params.externalId,
          source: result.source,
        };
      }

      return result;
    } catch (error) {
      return sendSearchError(reply, error);
    }
  });

  app.get("/shopee/stats", {
    schema: {
      tags: ["Shopee Affiliate"],
      description: "Estatísticas do catálogo local e do cache de buscas live (somente leitura).",
    },
  }, async () => getShopeePlatformStats());
}
