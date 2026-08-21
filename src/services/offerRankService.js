import { pool } from "../db/pool.js";
import { formatBanner } from "../repositories/shopeeOffersRepository.js";

const RANK_SQL = `
  LN(1 + COALESCE(sales, 0)) * 12
  + COALESCE(price_discount_rate, 0) * 0.35
  + COALESCE(rating_star, 0) * 8
  + COALESCE(commission_rate, 0) * 250
  + CASE WHEN featured THEN 12 ELSE 0 END
  + CASE WHEN offer_type = 'product' THEN 8 ELSE 0 END
`;

export async function refreshOfferRankScores() {
  const result = await pool.query(`
    UPDATE shopee_offers
    SET rank_score = (${RANK_SQL}),
        updated_at = updated_at
    WHERE active = TRUE
  `);
  return { updated: result.rowCount };
}

export async function findRankedOffers({
  limit = 20,
  offset = 0,
  minScore = 0,
  offerType = "product",
} = {}) {
  const params = [];
  const clauses = [
    "active = TRUE",
    "(period_end IS NULL OR period_end >= NOW())",
  ];

  if (offerType) {
    params.push(offerType);
    clauses.push(`offer_type = $${params.length}`);
  }

  params.push(minScore);
  clauses.push(`rank_score >= $${params.length}`);

  params.push(limit);
  params.push(offset);

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
      rank_score AS "rankScore",
      metadata,
      synced_at AS "syncedAt",
      updated_at AS "updatedAt"
    FROM shopee_offers
    WHERE ${clauses.join(" AND ")}
    ORDER BY rank_score DESC, sales DESC NULLS LAST, commission_rate DESC NULLS LAST
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `,
    params
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM shopee_offers WHERE ${clauses.join(" AND ")}`,
    params.slice(0, -2)
  );

  return {
    items: itemsResult.rows.map((row, index) => ({
      ...formatBanner(row),
      rankScore: Number(row.rankScore) || 0,
      rank: offset + index + 1,
    })),
    total: countResult.rows[0].total,
  };
}
