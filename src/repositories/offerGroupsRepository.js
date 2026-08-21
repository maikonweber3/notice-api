import { pool } from "../db/pool.js";

const GROUP_SELECT = `
  id,
  name,
  description,
  whatsapp_jid AS "whatsappJid",
  invite_link AS "inviteLink",
  active,
  posts_per_run AS "postsPerRun",
  min_rank_score AS "minRankScore",
  last_posted_at AS "lastPostedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function listOfferGroups({ activeOnly = false } = {}) {
  const where = activeOnly ? "WHERE active = TRUE" : "";
  const result = await pool.query(
    `SELECT ${GROUP_SELECT} FROM offer_groups ${where} ORDER BY name ASC`
  );
  return result.rows;
}

export async function listPublicOfferGroups() {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      description,
      invite_link AS "inviteLink",
      posts_per_run AS "postsPerRun"
    FROM offer_groups
    WHERE active = TRUE
      AND invite_link IS NOT NULL
      AND invite_link <> ''
    ORDER BY name ASC
  `
  );
  return result.rows;
}

export async function getOfferGroupById(id) {
  const result = await pool.query(
    `SELECT ${GROUP_SELECT} FROM offer_groups WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getOfferGroupByJid(jid) {
  const result = await pool.query(
    `SELECT ${GROUP_SELECT} FROM offer_groups WHERE whatsapp_jid = $1`,
    [jid]
  );
  return result.rows[0] || null;
}

export async function upsertOfferGroup({
  name,
  description,
  whatsappJid,
  inviteLink,
  active = true,
  postsPerRun = 3,
  minRankScore = 0,
}) {
  const result = await pool.query(
    `
    INSERT INTO offer_groups (
      name, description, whatsapp_jid, invite_link, active, posts_per_run, min_rank_score
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (whatsapp_jid) DO UPDATE SET
      name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, offer_groups.description),
      invite_link = COALESCE(EXCLUDED.invite_link, offer_groups.invite_link),
      active = EXCLUDED.active,
      posts_per_run = EXCLUDED.posts_per_run,
      min_rank_score = EXCLUDED.min_rank_score,
      updated_at = NOW()
    RETURNING ${GROUP_SELECT}
  `,
    [
      name,
      description || null,
      whatsappJid,
      inviteLink || null,
      active,
      postsPerRun,
      minRankScore,
    ]
  );
  return result.rows[0];
}

export async function updateOfferGroup(id, patch) {
  const fields = [];
  const params = [id];
  const map = {
    name: "name",
    description: "description",
    inviteLink: "invite_link",
    active: "active",
    postsPerRun: "posts_per_run",
    minRankScore: "min_rank_score",
  };

  for (const [key, column] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${column} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    return getOfferGroupById(id);
  }

  fields.push("updated_at = NOW()");
  const result = await pool.query(
    `
    UPDATE offer_groups
    SET ${fields.join(", ")}
    WHERE id = $1
    RETURNING ${GROUP_SELECT}
  `,
    params
  );
  return result.rows[0] || null;
}

export async function deleteOfferGroup(id) {
  const result = await pool.query(`DELETE FROM offer_groups WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

export async function touchGroupPosted(id) {
  await pool.query(
    `UPDATE offer_groups SET last_posted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  );
}
