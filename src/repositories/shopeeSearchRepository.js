import crypto from "crypto";
import { pool } from "../db/pool.js";
import { formatBanner } from "./shopeeOffersRepository.js";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildSearchCacheKey({
  offerType,
  keyword,
  page,
  limit,
  sortType,
  listType,
}) {
  const normalized = [
    offerType,
    String(keyword || "").trim().toLowerCase(),
    Number(page) || 1,
    Number(limit) || 20,
    sortType ?? "",
    listType ?? "",
  ].join("|");

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export async function getSearchCache(cacheKey) {
  const result = await pool.query(
    `
    SELECT
      id,
      cache_key AS "cacheKey",
      offer_type AS "offerType",
      keyword,
      page,
      page_limit AS "pageLimit",
      sort_type AS "sortType",
      list_type AS "listType",
      external_ids AS "externalIds",
      has_next_page AS "hasNextPage",
      fetched_count AS "fetchedCount",
      source,
      hit_count AS "hitCount",
      metadata,
      fetched_at AS "fetchedAt",
      expires_at AS "expiresAt"
    FROM shopee_search_cache
    WHERE cache_key = $1
      AND expires_at > NOW()
  `,
    [cacheKey]
  );

  return result.rows[0] || null;
}

export async function touchSearchCache(cacheKey) {
  await pool.query(
    `
    UPDATE shopee_search_cache
    SET hit_count = hit_count + 1,
        updated_at = NOW()
    WHERE cache_key = $1
  `,
    [cacheKey]
  );
}

export async function invalidateSearchCache(cacheKey) {
  await pool.query(`DELETE FROM shopee_search_cache WHERE cache_key = $1`, [cacheKey]);
}

export async function upsertSearchCache({
  cacheKey,
  offerType,
  keyword,
  page,
  limit,
  sortType,
  listType,
  externalIds,
  hasNextPage,
  fetchedCount,
  ttlSeconds,
  metadata = {},
}) {
  const result = await pool.query(
    `
    INSERT INTO shopee_search_cache (
      cache_key, offer_type, keyword, page, page_limit,
      sort_type, list_type, external_ids, has_next_page,
      fetched_count, source, metadata, fetched_at, expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8::text[], $9,
      $10, 'live', $11::jsonb, NOW(), NOW() + make_interval(secs => $12::int)
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      external_ids = EXCLUDED.external_ids,
      has_next_page = EXCLUDED.has_next_page,
      fetched_count = EXCLUDED.fetched_count,
      sort_type = EXCLUDED.sort_type,
      list_type = EXCLUDED.list_type,
      metadata = EXCLUDED.metadata,
      source = 'live',
      fetched_at = NOW(),
      expires_at = NOW() + make_interval(secs => $12::int),
      updated_at = NOW()
    RETURNING
      id,
      cache_key AS "cacheKey",
      expires_at AS "expiresAt",
      fetched_at AS "fetchedAt"
  `,
    [
      cacheKey,
      offerType,
      keyword,
      page,
      limit,
      sortType ?? null,
      listType ?? null,
      externalIds,
      hasNextPage,
      fetchedCount,
      JSON.stringify(metadata),
      Math.max(Number(ttlSeconds) || 0, 0),
    ]
  );

  return result.rows[0];
}

export async function purgeExpiredSearchCache() {
  const result = await pool.query(
    `DELETE FROM shopee_search_cache WHERE expires_at <= NOW()`
  );
  return result.rowCount;
}

const OFFER_SELECT = `
  id,
  offer_type AS "offerType",
  external_id AS "externalId",
  title,
  image_url AS "imageUrl",
  offer_link AS "offerLink",
  original_link AS "originalLink",
  price_min AS "priceMin",
  price_max AS "priceMax",
  price_discount_rate AS "priceDiscountRate",
  commission_rate AS "commissionRate",
  commission,
  sales,
  rating_star AS "ratingStar",
  shop_id AS "shopId",
  shop_name AS "shopName",
  category_id AS "categoryId",
  period_start AS "periodStart",
  period_end AS "periodEnd",
  banner_placement AS "bannerPlacement",
  featured,
  rank_score AS "rankScore",
  metadata,
  synced_at AS "syncedAt",
  updated_at AS "updatedAt"
`;

export async function findOffersByExternalIds(offerType, externalIds) {
  if (!externalIds?.length) return [];

  const result = await pool.query(
    `
    SELECT ${OFFER_SELECT}
    FROM shopee_offers
    WHERE offer_type = $1
      AND external_id = ANY($2::text[])
      AND active = TRUE
  `,
    [offerType, externalIds]
  );

  const byId = new Map(result.rows.map((row) => [row.externalId, formatBanner(row)]));
  return externalIds.map((id) => byId.get(String(id))).filter(Boolean);
}

export async function findOfferByExternalId(offerType, externalId) {
  const params = [String(externalId)];
  let typeClause = "";

  if (offerType) {
    params.push(offerType);
    typeClause = `AND offer_type = $${params.length}`;
  }

  const result = await pool.query(
    `
    SELECT ${OFFER_SELECT}
    FROM shopee_offers
    WHERE external_id = $1
      AND active = TRUE
      ${typeClause}
    ORDER BY updated_at DESC
    LIMIT 1
  `,
    params
  );

  return formatBanner(result.rows[0]);
}

/**
 * Busca eficiente no catálogo local (FTS português + trigram + filtros).
 */
export async function searchLocalOffers(filters) {
  const params = [];
  const clauses = ["active = TRUE", "(period_end IS NULL OR period_end >= NOW())"];

  if (filters.offerType) {
    params.push(filters.offerType);
    clauses.push(`offer_type = $${params.length}`);
  }

  if (filters.placement) {
    params.push(filters.placement);
    clauses.push(`banner_placement = $${params.length}`);
  }

  if (filters.featured !== undefined) {
    params.push(filters.featured);
    clauses.push(`featured = $${params.length}`);
  }

  if (filters.minPrice != null) {
    params.push(filters.minPrice);
    clauses.push(`price_min >= $${params.length}`);
  }

  if (filters.maxPrice != null) {
    params.push(filters.maxPrice);
    clauses.push(`price_min <= $${params.length}`);
  }

  if (filters.minCommission != null) {
    params.push(filters.minCommission);
    clauses.push(`commission_rate >= $${params.length}`);
  }

  if (filters.shopId != null) {
    params.push(filters.shopId);
    clauses.push(`shop_id = $${params.length}`);
  }

  if (filters.categoryId != null) {
    params.push(filters.categoryId);
    clauses.push(`category_id = $${params.length}`);
  }

  let rankSelect = "0::float AS rank";
  const q = String(filters.q || "").trim();

  if (q) {
    params.push(q);
    const qIdx = params.length;
    params.push(`%${q}%`);
    const likeIdx = params.length;

    clauses.push(`(
      external_id = $${qIdx}
      OR search_document @@ plainto_tsquery('portuguese', $${qIdx})
      OR title ILIKE $${likeIdx}
      OR shop_name ILIKE $${likeIdx}
    )`);

    rankSelect = `
      (
        CASE WHEN external_id = $${qIdx} THEN 100 ELSE 0 END
        + COALESCE(ts_rank(search_document, plainto_tsquery('portuguese', $${qIdx})), 0) * 10
        + CASE WHEN title ILIKE $${likeIdx} THEN 1 ELSE 0 END
      )::float AS rank
    `;
  }

  const sort = String(filters.sort || "relevance").toLowerCase();
  let orderBy = "featured DESC, commission_rate DESC NULLS LAST, sales DESC NULLS LAST, updated_at DESC";

  if (sort === "relevance" && q) {
    orderBy = "rank DESC, commission_rate DESC NULLS LAST, sales DESC NULLS LAST, updated_at DESC";
  } else if (sort === "commission") {
    orderBy = "commission_rate DESC NULLS LAST, sales DESC NULLS LAST, updated_at DESC";
  } else if (sort === "price_asc") {
    orderBy = "price_min ASC NULLS LAST, commission_rate DESC NULLS LAST";
  } else if (sort === "price_desc") {
    orderBy = "price_min DESC NULLS LAST, commission_rate DESC NULLS LAST";
  } else if (sort === "sales") {
    orderBy = "sales DESC NULLS LAST, commission_rate DESC NULLS LAST";
  } else if (sort === "recent") {
    orderBy = "synced_at DESC NULLS LAST, updated_at DESC";
  } else if (sort === "rank") {
    orderBy = "rank_score DESC, sales DESC NULLS LAST, commission_rate DESC NULLS LAST";
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  params.push(filters.limit);
  params.push(filters.offset);

  const itemsResult = await pool.query(
    `
    SELECT ${OFFER_SELECT}, ${rankSelect}
    FROM shopee_offers
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `,
    params
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM shopee_offers ${where}`,
    params.slice(0, -2)
  );

  return {
    items: itemsResult.rows.map((row) => {
      const banner = formatBanner(row);
      return {
        ...banner,
        relevance: toNumber(row.rank),
      };
    }),
    total: countResult.rows[0].total,
  };
}

export async function getCatalogStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM shopee_offers WHERE active = TRUE) AS "activeOffers",
      (SELECT COUNT(*)::int FROM shopee_offers WHERE active = TRUE AND offer_type = 'product') AS "products",
      (SELECT COUNT(*)::int FROM shopee_offers WHERE active = TRUE AND offer_type = 'shop') AS "shops",
      (SELECT COUNT(*)::int FROM shopee_offers WHERE active = TRUE AND offer_type = 'campaign') AS "campaigns",
      (SELECT COUNT(*)::int FROM shopee_search_cache WHERE expires_at > NOW()) AS "warmCacheEntries",
      (SELECT MAX(synced_at) FROM shopee_offers) AS "lastSyncedAt",
      (SELECT MAX(fetched_at) FROM shopee_search_cache) AS "lastLiveFetchAt"
  `);
  return result.rows[0];
}
