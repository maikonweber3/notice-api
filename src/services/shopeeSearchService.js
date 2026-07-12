import { shopeeGraphql } from "../integrations/shopee/client.js";
import {
  CAMPAIGN_OFFERS_QUERY,
  PRODUCT_OFFERS_QUERY,
  SHOP_OFFERS_QUERY,
} from "../integrations/shopee/queries.js";
import { config } from "../config.js";
import {
  formatMappedOffer,
  mapCampaignOffer,
  mapProductOffer,
  mapShopOffer,
  upsertOffers,
} from "../repositories/shopeeOffersRepository.js";
import {
  buildSearchCacheKey,
  findOfferByExternalId,
  findOffersByExternalIds,
  getCatalogStats,
  getSearchCache,
  invalidateSearchCache,
  searchLocalOffers,
  touchSearchCache,
  upsertSearchCache,
} from "../repositories/shopeeSearchRepository.js";

const inflightSearches = new Map();

function withSingleflight(key, fn) {
  const existing = inflightSearches.get(key);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      inflightSearches.delete(key);
    });

  inflightSearches.set(key, promise);
  return promise;
}

function normalizeKeyword(keyword) {
  return String(keyword || "").trim();
}

function parseOptionalInt(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Parâmetro ${label} inválido`);
  }
  return parsed;
}

function clampLimit(limit) {
  const parsed = Number(limit ?? config.shopeeSearchDefaultLimit);
  if (!Number.isFinite(parsed)) {
    return config.shopeeSearchDefaultLimit;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), config.shopeeSearchMaxLimit);
}

function clampPage(page) {
  const parsed = Number(page || 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(Math.trunc(parsed), 1);
}

function parseBoolFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return defaultValue;
}

function assertKeyword(keyword) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    throw new Error("Parâmetro keyword é obrigatório para busca live.");
  }
  if (normalized.length > config.shopeeSearchMaxKeywordLength) {
    throw new Error(
      `keyword excede o máximo de ${config.shopeeSearchMaxKeywordLength} caracteres`
    );
  }
  return normalized;
}

async function fetchProductPage({ keyword, page, limit, sortType, listType }) {
  const data = await shopeeGraphql(PRODUCT_OFFERS_QUERY, {
    keyword,
    listType: listType ?? config.shopeeProductListType,
    sortType: sortType ?? config.shopeeProductSortType,
    page,
    limit,
  });

  const connection = data.productOfferV2;
  const nodes = connection?.nodes || [];
  // Live nunca marca featured — sync/banners controlam apresentação.
  const offers = nodes.map((node) =>
    mapProductOffer(node, {
      bannerPlacement: "default",
      featured: false,
    })
  );

  return {
    offers,
    hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    pageInfo: connection?.pageInfo || { page, limit, hasNextPage: false },
  };
}

async function fetchShopPage({ keyword, page, limit, sortType }) {
  const data = await shopeeGraphql(SHOP_OFFERS_QUERY, {
    keyword,
    sortType: sortType ?? 2,
    page,
    limit,
  });

  const connection = data.shopOfferV2;
  const nodes = connection?.nodes || [];
  const offers = nodes.map((node) =>
    mapShopOffer(node, {
      bannerPlacement: "sidebar",
      featured: false,
    })
  );

  return {
    offers,
    hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    pageInfo: connection?.pageInfo || { page, limit, hasNextPage: false },
  };
}

async function fetchCampaignPage({ keyword, page, limit, sortType }) {
  const data = await shopeeGraphql(CAMPAIGN_OFFERS_QUERY, {
    keyword,
    sortType: sortType ?? 2,
    page,
    limit,
  });

  const connection = data.shopeeOfferV2;
  const nodes = connection?.nodes || [];
  const offers = nodes.map((node) =>
    mapCampaignOffer(node, {
      bannerPlacement: "default",
      featured: false,
    })
  );

  return {
    offers,
    hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    pageInfo: connection?.pageInfo || { page, limit, hasNextPage: false },
  };
}

const FETCHERS = {
  product: fetchProductPage,
  shop: fetchShopPage,
  campaign: fetchCampaignPage,
};

async function resolveFromCache(cache, offerType) {
  const expectedIds = cache.externalIds || [];
  const items = await findOffersByExternalIds(offerType, expectedIds);

  // Cache incompleto (ofertas removidas/inativas) → invalida e força miss.
  if (items.length < expectedIds.length) {
    await invalidateSearchCache(cache.cacheKey);
    return null;
  }

  await touchSearchCache(cache.cacheKey);

  return {
    items,
    page: cache.page,
    limit: cache.pageLimit,
    hasNextPage: cache.hasNextPage,
    totalHint: cache.fetchedCount,
    source: "cache",
    cache: {
      key: cache.cacheKey,
      hitCount: (cache.hitCount || 0) + 1,
      fetchedAt: cache.fetchedAt,
      expiresAt: cache.expiresAt,
    },
    query: {
      type: offerType,
      keyword: cache.keyword,
      sortType: cache.sortType,
      listType: cache.listType,
    },
  };
}

async function fetchAndStoreLive({
  offerType,
  keyword,
  page,
  limit,
  sortType,
  listType,
  cacheKey,
}) {
  const fetchPage = FETCHERS[offerType];
  const { offers, hasNextPage, pageInfo } = await fetchPage({
    keyword,
    page,
    limit,
    sortType,
    listType,
  });

  await upsertOffers(offers, { preservePresentation: true });

  const externalIds = offers.map((offer) => offer.externalId);
  const items = await findOffersByExternalIds(offerType, externalIds);
  const responseItems =
    items.length === offers.length ? items : offers.map((offer) => formatMappedOffer(offer));

  let cacheMeta = null;
  if (config.shopeeSearchCacheTtlSeconds > 0) {
    cacheMeta = await upsertSearchCache({
      cacheKey,
      offerType,
      keyword,
      page,
      limit,
      sortType,
      listType,
      externalIds,
      hasNextPage,
      fetchedCount: offers.length,
      ttlSeconds: config.shopeeSearchCacheTtlSeconds,
      metadata: { pageInfo },
    });
  }

  return {
    items: responseItems,
    page,
    limit,
    hasNextPage,
    totalHint: offers.length,
    source: "live",
    cache: cacheMeta
      ? {
          key: cacheKey,
          hitCount: 0,
          fetchedAt: cacheMeta.fetchedAt,
          expiresAt: cacheMeta.expiresAt,
        }
      : null,
    query: {
      type: offerType,
      keyword,
      sortType,
      listType: listType ?? null,
    },
  };
}

/**
 * Busca live na Open API Shopee Affiliate, com cache Postgres.
 * Upsert preserva featured/banner_placement existentes.
 */
export async function searchShopeeLive(options = {}) {
  const offerType = options.type || "product";
  if (!FETCHERS[offerType]) {
    throw new Error(`Tipo inválido: ${offerType}. Use product, shop ou campaign.`);
  }

  const keyword = assertKeyword(options.keyword);
  const page = clampPage(options.page);
  const limit = clampLimit(options.limit);

  const sortType =
    options.sortType !== undefined && options.sortType !== null && options.sortType !== ""
      ? parseOptionalInt(options.sortType, "sortType")
      : offerType === "product"
        ? config.shopeeProductSortType
        : 2;

  const listType =
    offerType === "product"
      ? options.listType !== undefined && options.listType !== null && options.listType !== ""
        ? parseOptionalInt(options.listType, "listType")
        : config.shopeeProductListType
      : undefined;

  const refresh = parseBoolFlag(options.refresh, false);
  const cacheKey = buildSearchCacheKey({
    offerType,
    keyword,
    page,
    limit,
    sortType,
    listType,
  });

  return withSingleflight(`${cacheKey}:${refresh ? "1" : "0"}`, async () => {
    if (!refresh && config.shopeeSearchCacheTtlSeconds > 0) {
      const cached = await getSearchCache(cacheKey);
      if (cached) {
        const resolved = await resolveFromCache(cached, offerType);
        if (resolved) return resolved;
      }
    }

    return fetchAndStoreLive({
      offerType,
      keyword,
      page,
      limit,
      sortType,
      listType,
      cacheKey,
    });
  });
}

/**
 * Catálogo local eficiente (FTS + filtros). Não chama a Shopee.
 */
export async function searchShopeeCatalog(options = {}) {
  const page = clampPage(options.page);
  const limit = clampLimit(options.limit);
  const offset = (page - 1) * limit;

  const q = options.q || options.keyword;
  if (q && String(q).trim().length > config.shopeeSearchMaxKeywordLength) {
    throw new Error(
      `q/keyword excede o máximo de ${config.shopeeSearchMaxKeywordLength} caracteres`
    );
  }

  const { items, total } = await searchLocalOffers({
    q,
    offerType: options.type,
    placement: options.placement,
    featured: options.featured,
    minPrice: options.minPrice != null ? Number(options.minPrice) : undefined,
    maxPrice: options.maxPrice != null ? Number(options.maxPrice) : undefined,
    minCommission:
      options.minCommission != null ? Number(options.minCommission) : undefined,
    shopId: options.shopId != null ? Number(options.shopId) : undefined,
    categoryId: options.categoryId != null ? Number(options.categoryId) : undefined,
    sort: options.sort,
    limit,
    offset,
  });

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    source: "local",
    query: {
      q: q || null,
      type: options.type || null,
      sort: options.sort || "relevance",
    },
  };
}

/**
 * Resolve um item por externalId. Live só faz upsert do match exato.
 */
export async function getShopeeOfferByExternalId(externalId, options = {}) {
  const id = String(externalId || "").trim();
  if (!id) {
    throw new Error("externalId é obrigatório");
  }
  if (id.length > config.shopeeSearchMaxKeywordLength) {
    throw new Error("externalId inválido");
  }

  const offerType = options.type || undefined;
  const refresh = parseBoolFlag(options.refresh, false);
  const allowLive = parseBoolFlag(options.live, true);

  if (!refresh) {
    const local = await findOfferByExternalId(offerType, id);
    if (local) {
      return { item: local, source: "local" };
    }
  }

  if (!allowLive) {
    return { item: null, source: "local" };
  }

  const type = offerType || "product";
  if (!FETCHERS[type]) {
    throw new Error(`Tipo inválido: ${type}. Use product, shop ou campaign.`);
  }

  const limit = Math.min(config.shopeeSearchMaxLimit, 50);
  const fetchPage = FETCHERS[type];
  const { offers } = await fetchPage({
    keyword: id,
    page: 1,
    limit,
    sortType: type === "product" ? config.shopeeProductSortType : 2,
    listType: type === "product" ? config.shopeeProductListType : undefined,
  });

  const exact = offers.find((offer) => String(offer.externalId) === id);
  if (!exact) {
    return { item: null, source: "miss" };
  }

  await upsertOffers([exact], { preservePresentation: true });
  const stored = await findOfferByExternalId(type, id);
  return {
    item: stored || formatMappedOffer(exact),
    source: "live",
  };
}

export async function getShopeePlatformStats() {
  const catalog = await getCatalogStats();
  return {
    ...catalog,
    cacheTtlSeconds: config.shopeeSearchCacheTtlSeconds,
    liveRateLimitPerMin: config.shopeeLiveRateLimitPerMin,
  };
}
