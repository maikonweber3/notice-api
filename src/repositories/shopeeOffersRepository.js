import { pool } from "../db/pool.js";

function toTimestamp(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function upsertOffers(offers, options = {}) {
  if (offers.length === 0) {
    return { upserted: 0 };
  }

  const preservePresentation = Boolean(options.preservePresentation);
  const client = await pool.connect();
  let upserted = 0;

  try {
    await client.query("BEGIN");

    for (const offer of offers) {
      const result = await client.query(
        `
        INSERT INTO shopee_offers (
          offer_type, external_id, title, image_url, offer_link, original_link,
          price_min, price_max, price_discount_rate, commission_rate, commission,
          sales, rating_star, shop_id, shop_name, category_id,
          period_start, period_end, banner_placement, featured, active, metadata, synced_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20, TRUE, $21::jsonb, NOW()
        )
        ON CONFLICT (offer_type, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          image_url = EXCLUDED.image_url,
          offer_link = EXCLUDED.offer_link,
          original_link = EXCLUDED.original_link,
          price_min = EXCLUDED.price_min,
          price_max = EXCLUDED.price_max,
          price_discount_rate = EXCLUDED.price_discount_rate,
          commission_rate = EXCLUDED.commission_rate,
          commission = EXCLUDED.commission,
          sales = EXCLUDED.sales,
          rating_star = EXCLUDED.rating_star,
          shop_id = EXCLUDED.shop_id,
          shop_name = EXCLUDED.shop_name,
          category_id = EXCLUDED.category_id,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          banner_placement = CASE
            WHEN $22::boolean THEN shopee_offers.banner_placement
            ELSE EXCLUDED.banner_placement
          END,
          featured = CASE
            WHEN $22::boolean THEN shopee_offers.featured
            ELSE EXCLUDED.featured
          END,
          active = TRUE,
          metadata = EXCLUDED.metadata,
          synced_at = NOW(),
          updated_at = NOW()
      `,
        [
          offer.offerType,
          offer.externalId,
          offer.title,
          offer.imageUrl || null,
          offer.offerLink,
          offer.originalLink || null,
          offer.priceMin ?? null,
          offer.priceMax ?? null,
          offer.priceDiscountRate ?? null,
          offer.commissionRate ?? null,
          offer.commission ?? null,
          offer.sales ?? null,
          offer.ratingStar ?? null,
          offer.shopId ?? null,
          offer.shopName || null,
          offer.categoryId ?? null,
          offer.periodStart || null,
          offer.periodEnd || null,
          offer.bannerPlacement || "default",
          offer.featured ?? false,
          JSON.stringify(offer.metadata || {}),
          preservePresentation,
        ]
      );
      upserted += result.rowCount;
    }

    await client.query("COMMIT");
    return { upserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findBanners(filters) {
  const params = [];
  const clauses = ["active = TRUE"];

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

  if (filters.q) {
    params.push(`%${filters.q}%`);
    clauses.push(`(title ILIKE $${params.length} OR shop_name ILIKE $${params.length})`);
  }

  clauses.push("(period_end IS NULL OR period_end >= NOW())");

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(filters.limit);
  params.push(filters.offset);

  const itemsResult = await pool.query(
    `
    SELECT
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
      metadata,
      synced_at AS "syncedAt",
      updated_at AS "updatedAt"
    FROM shopee_offers
    ${where}
    ORDER BY featured DESC, commission_rate DESC NULLS LAST, sales DESC NULLS LAST, updated_at DESC
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
    items: itemsResult.rows.map(formatBanner),
    total: countResult.rows[0].total,
  };
}

export async function getBannerById(id) {
  const result = await pool.query(
    `
    SELECT
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
      metadata,
      synced_at AS "syncedAt",
      updated_at AS "updatedAt"
    FROM shopee_offers
    WHERE id = $1 AND active = TRUE
  `,
    [id]
  );

  return formatBanner(result.rows[0]);
}

export async function getFeaturedBanners(limit = 5, placement) {
  const { items } = await findBanners({
    featured: true,
    placement: placement || undefined,
    limit,
    offset: 0,
  });
  return items;
}

export async function createSyncRun({ offerType, keyword }) {
  const result = await pool.query(
    `
    INSERT INTO shopee_sync_runs (status, offer_type, keyword)
    VALUES ('running', $1, $2)
    RETURNING id, status, offer_type AS "offerType", keyword, started_at AS "startedAt"
  `,
    [offerType || null, keyword || null]
  );
  return result.rows[0];
}

export async function finishSyncRun(id, { status, pagesFetched, offersUpserted, errorMessage }) {
  await pool.query(
    `
    UPDATE shopee_sync_runs
    SET status = $2,
        pages_fetched = $3,
        offers_upserted = $4,
        error_message = $5,
        finished_at = NOW()
    WHERE id = $1
  `,
    [id, status, pagesFetched, offersUpserted, errorMessage || null]
  );
}

export async function getSyncStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM shopee_offers WHERE active = TRUE) AS "activeOffers",
      (SELECT COUNT(*)::int FROM shopee_offers WHERE featured = TRUE AND active = TRUE) AS "featuredOffers",
      (SELECT MAX(synced_at) FROM shopee_offers) AS "lastSyncedAt",
      (
        SELECT json_build_object(
          'id', id,
          'status', status,
          'offerType', offer_type,
          'keyword', keyword,
          'pagesFetched', pages_fetched,
          'offersUpserted', offers_upserted,
          'startedAt', started_at,
          'finishedAt', finished_at
        )
        FROM shopee_sync_runs
        ORDER BY started_at DESC
        LIMIT 1
      ) AS "lastRun"
  `);
  return result.rows[0];
}

export function formatBanner(row) {
  if (!row) return null;

  const priceMin = toNumber(row.priceMin);
  const priceMax = toNumber(row.priceMax);
  const commissionRate = toNumber(row.commissionRate);

  return {
    id: row.id,
    type: row.offerType,
    externalId: row.externalId,
    title: row.title,
    imageUrl: row.imageUrl,
    link: row.offerLink,
    originalLink: row.originalLink,
    price: priceMin,
    priceMin,
    priceMax,
    discountPercent: row.priceDiscountRate ?? null,
    commissionRate,
    commissionPercent: commissionRate !== null ? Math.round(commissionRate * 10000) / 100 : null,
    commission: toNumber(row.commission),
    sales: row.sales ?? null,
    rating: toNumber(row.ratingStar),
    shop: row.shopName
      ? {
          id: row.shopId,
          name: row.shopName,
        }
      : null,
    categoryId: row.categoryId ?? null,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    placement: row.bannerPlacement,
    featured: row.featured,
    metadata: row.metadata,
    syncedAt: row.syncedAt,
    updatedAt: row.updatedAt,
  };
}

/** Formata oferta mapeada (ainda sem row do banco) no mesmo shape da API. */
export function formatMappedOffer(offer) {
  if (!offer) return null;
  return formatBanner({
    id: offer.id ?? null,
    offerType: offer.offerType,
    externalId: offer.externalId,
    title: offer.title,
    imageUrl: offer.imageUrl,
    offerLink: offer.offerLink,
    originalLink: offer.originalLink,
    priceMin: offer.priceMin,
    priceMax: offer.priceMax,
    priceDiscountRate: offer.priceDiscountRate,
    commissionRate: offer.commissionRate,
    commission: offer.commission,
    sales: offer.sales,
    ratingStar: offer.ratingStar,
    shopId: offer.shopId,
    shopName: offer.shopName,
    categoryId: offer.categoryId,
    periodStart: offer.periodStart,
    periodEnd: offer.periodEnd,
    bannerPlacement: offer.bannerPlacement,
    featured: offer.featured,
    metadata: offer.metadata,
    syncedAt: offer.syncedAt ?? null,
    updatedAt: offer.updatedAt ?? null,
  });
}

export function mapProductOffer(node, options = {}) {
  return {
    offerType: "product",
    externalId: String(node.itemId),
    title: node.productName,
    imageUrl: node.imageUrl,
    offerLink: node.offerLink,
    originalLink: node.productLink || null,
    priceMin: toNumber(node.priceMin),
    priceMax: toNumber(node.priceMax),
    priceDiscountRate: node.priceDiscountRate ?? null,
    commissionRate: toNumber(node.commissionRate),
    commission: toNumber(node.commission),
    sales: node.sales ?? null,
    ratingStar: toNumber(node.ratingStar),
    shopId: node.shopId ?? null,
    shopName: node.shopName || null,
    periodStart: toTimestamp(node.periodStartTime),
    periodEnd: toTimestamp(node.periodEndTime),
    bannerPlacement: options.bannerPlacement || "default",
    featured: options.featured ?? false,
    metadata: {
      sellerCommissionRate: node.sellerCommissionRate,
      shopeeCommissionRate: node.shopeeCommissionRate,
      shopType: node.shopType,
    },
  };
}

export function mapShopOffer(node, options = {}) {
  return {
    offerType: "shop",
    externalId: String(node.shopId),
    title: node.shopName,
    imageUrl: node.imageUrl,
    offerLink: node.offerLink,
    originalLink: node.originalLink || null,
    commissionRate: toNumber(node.commissionRate),
    ratingStar: toNumber(node.ratingStar),
    shopId: node.shopId ?? null,
    shopName: node.shopName || null,
    periodStart: toTimestamp(node.periodStartTime),
    periodEnd: toTimestamp(node.periodEndTime),
    bannerPlacement: options.bannerPlacement || "sidebar",
    featured: options.featured ?? false,
    metadata: {
      shopType: node.shopType,
      remainingBudget: node.remainingBudget,
      sellerCommCoveRatio: node.sellerCommCoveRatio,
    },
  };
}

export function mapCampaignOffer(node, options = {}) {
  const externalId = String(node.collectionId || node.categoryId || node.offerName);

  return {
    offerType: "campaign",
    externalId,
    title: node.offerName,
    imageUrl: node.imageUrl,
    offerLink: node.offerLink,
    originalLink: node.originalLink || null,
    commissionRate: toNumber(node.commissionRate),
    categoryId: node.categoryId ?? null,
    periodStart: toTimestamp(node.periodStartTime),
    periodEnd: toTimestamp(node.periodEndTime),
    bannerPlacement: options.bannerPlacement || "hero",
    featured: options.featured ?? true,
    metadata: {
      offerType: node.offerType,
      collectionId: node.collectionId,
    },
  };
}
