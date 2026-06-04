import { shopeeGraphql } from "../integrations/shopee/client.js";
import {
  CAMPAIGN_OFFERS_QUERY,
  PRODUCT_OFFERS_QUERY,
  SHOP_OFFERS_QUERY,
} from "../integrations/shopee/queries.js";
import { config } from "../config.js";
import {
  createSyncRun,
  finishSyncRun,
  mapCampaignOffer,
  mapProductOffer,
  mapShopOffer,
  upsertOffers,
} from "../repositories/shopeeOffersRepository.js";

async function fetchAllPages(fetchPage) {
  let page = 1;
  let pagesFetched = 0;
  const allNodes = [];

  while (page <= config.shopeeSyncMaxPages) {
    const { nodes, hasNextPage } = await fetchPage(page);
    pagesFetched += 1;
    allNodes.push(...nodes);

    if (!hasNextPage || nodes.length === 0) {
      break;
    }

    page += 1;
  }

  return { nodes: allNodes, pagesFetched };
}

async function syncProductOffers(keyword, options = {}) {
  const { nodes, pagesFetched } = await fetchAllPages(async (page) => {
    const data = await shopeeGraphql(PRODUCT_OFFERS_QUERY, {
      keyword,
      listType: options.listType ?? config.shopeeProductListType,
      sortType: options.sortType ?? config.shopeeProductSortType,
      page,
      limit: config.shopeeSyncPageLimit,
    });

    const connection = data.productOfferV2;
    return {
      nodes: connection?.nodes || [],
      hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    };
  });

  const offers = nodes.map((node, index) =>
    mapProductOffer(node, {
      bannerPlacement: options.placement || "default",
      featured: index < config.shopeeFeaturedCount,
    })
  );

  const { upserted } = await upsertOffers(offers);
  return { pagesFetched, offersUpserted: upserted, fetched: nodes.length };
}

async function syncShopOffers(keyword, options = {}) {
  const { nodes, pagesFetched } = await fetchAllPages(async (page) => {
    const data = await shopeeGraphql(SHOP_OFFERS_QUERY, {
      keyword,
      sortType: options.sortType ?? 2,
      page,
      limit: config.shopeeSyncPageLimit,
    });

    const connection = data.shopOfferV2;
    return {
      nodes: connection?.nodes || [],
      hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    };
  });

  const offers = nodes.map((node) =>
    mapShopOffer(node, {
      bannerPlacement: options.placement || "sidebar",
      featured: false,
    })
  );

  const { upserted } = await upsertOffers(offers);
  return { pagesFetched, offersUpserted: upserted, fetched: nodes.length };
}

async function syncCampaignOffers(keyword, options = {}) {
  const { nodes, pagesFetched } = await fetchAllPages(async (page) => {
    const data = await shopeeGraphql(CAMPAIGN_OFFERS_QUERY, {
      keyword,
      sortType: options.sortType ?? 2,
      page,
      limit: config.shopeeSyncPageLimit,
    });

    const connection = data.shopeeOfferV2;
    return {
      nodes: connection?.nodes || [],
      hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
    };
  });

  const offers = nodes.map((node) =>
    mapCampaignOffer(node, {
      bannerPlacement: options.placement || "hero",
      featured: true,
    })
  );

  const { upserted } = await upsertOffers(offers);
  return { pagesFetched, offersUpserted: upserted, fetched: nodes.length };
}

export async function runShopeeSync(options = {}) {
  const keywords = options.keywords || config.shopeeSyncKeywords;
  const types = options.types || config.shopeeSyncTypes;
  const syncRun = await createSyncRun({ offerType: types.join(","), keyword: keywords.join(",") });

  let totalPages = 0;
  let totalUpserted = 0;
  const details = [];

  try {
    for (const keyword of keywords) {
      if (types.includes("product")) {
        const result = await syncProductOffers(keyword, options);
        totalPages += result.pagesFetched;
        totalUpserted += result.offersUpserted;
        details.push({ type: "product", keyword, ...result });
      }

      if (types.includes("shop")) {
        const result = await syncShopOffers(keyword, options);
        totalPages += result.pagesFetched;
        totalUpserted += result.offersUpserted;
        details.push({ type: "shop", keyword, ...result });
      }

      if (types.includes("campaign")) {
        const result = await syncCampaignOffers(keyword, options);
        totalPages += result.pagesFetched;
        totalUpserted += result.offersUpserted;
        details.push({ type: "campaign", keyword, ...result });
      }
    }

    await finishSyncRun(syncRun.id, {
      status: "success",
      pagesFetched: totalPages,
      offersUpserted: totalUpserted,
    });

    return {
      syncRunId: syncRun.id,
      status: "success",
      pagesFetched: totalPages,
      offersUpserted: totalUpserted,
      details,
    };
  } catch (error) {
    await finishSyncRun(syncRun.id, {
      status: "failed",
      pagesFetched: totalPages,
      offersUpserted: totalUpserted,
      errorMessage: error.message,
    });
    throw error;
  }
}
