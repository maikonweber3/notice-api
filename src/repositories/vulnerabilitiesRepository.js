import { pool } from "../db/pool.js";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE", "UNKNOWN"];

export function normalizeSeverity(value, score) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "MODERATE") return "MEDIUM";
  if (SEVERITIES.includes(text) && text !== "UNKNOWN") return text;
  const n = Number(score);
  if (Number.isFinite(n) && n > 0) {
    if (n >= 9) return "CRITICAL";
    if (n >= 7) return "HIGH";
    if (n >= 4) return "MEDIUM";
    return "LOW";
  }
  return "UNKNOWN";
}

const uniq = (arr) => [...new Set((arr || []).filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];

const SELECT_COLUMNS = `
  id, vuln_id AS "vulnId", aliases, title, description, severity,
  cvss_score::float AS "cvssScore", cvss_version AS "cvssVersion", cvss_vector AS "cvssVector",
  cvss_source AS "cvssSource", cwes, vendors, products, packages, refs AS "references",
  vuln_status AS "status", kev, kev_date_added AS "kevDateAdded", kev_due_date AS "kevDueDate",
  kev_required_action AS "kevRequiredAction", kev_ransomware AS "kevRansomware", sources,
  published_at AS "publishedAt", last_modified_at AS "lastModifiedAt",
  first_seen_at AS "firstSeenAt", updated_at AS "updatedAt", update_count AS "updateCount"
`;

/**
 * Upsert com merge entre fontes (NVD, CISA KEV, GitHub Advisories).
 * - CVSS da NVD tem prioridade; outras fontes só preenchem quando não há NVD.
 * - Arrays (refs, vendors, sources...) são unidos.
 * - update_count incrementa quando last_modified_at avança (CVE atualizada).
 */
export async function upsertVulnerabilities(items) {
  let inserted = 0;
  let updated = 0;
  if (!items.length) return { inserted, updated };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const v of items) {
      const res = await client.query(
        `
        INSERT INTO vulnerabilities (
          vuln_id, aliases, title, description, severity, cvss_score, cvss_version, cvss_vector,
          cvss_source, cwes, vendors, products, packages, refs, vuln_status, kev, kev_date_added,
          kev_due_date, kev_required_action, kev_ransomware, sources, published_at, last_modified_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        ON CONFLICT (vuln_id) DO UPDATE SET
          aliases = ARRAY(SELECT DISTINCT unnest(vulnerabilities.aliases || EXCLUDED.aliases)),
          title = COALESCE(EXCLUDED.title, vulnerabilities.title),
          description = CASE
            WHEN EXCLUDED.description IS NULL THEN vulnerabilities.description
            WHEN 'nvd' = ANY(EXCLUDED.sources) OR vulnerabilities.description IS NULL THEN EXCLUDED.description
            ELSE vulnerabilities.description END,
          severity = CASE
            WHEN EXCLUDED.cvss_score IS NOT NULL AND (EXCLUDED.cvss_source = 'nvd' OR vulnerabilities.cvss_source IS DISTINCT FROM 'nvd')
              THEN EXCLUDED.severity
            WHEN vulnerabilities.severity = 'UNKNOWN' THEN EXCLUDED.severity
            ELSE vulnerabilities.severity END,
          cvss_score = CASE WHEN EXCLUDED.cvss_score IS NOT NULL AND (EXCLUDED.cvss_source = 'nvd' OR vulnerabilities.cvss_source IS DISTINCT FROM 'nvd')
            THEN EXCLUDED.cvss_score ELSE vulnerabilities.cvss_score END,
          cvss_version = CASE WHEN EXCLUDED.cvss_score IS NOT NULL AND (EXCLUDED.cvss_source = 'nvd' OR vulnerabilities.cvss_source IS DISTINCT FROM 'nvd')
            THEN EXCLUDED.cvss_version ELSE vulnerabilities.cvss_version END,
          cvss_vector = CASE WHEN EXCLUDED.cvss_score IS NOT NULL AND (EXCLUDED.cvss_source = 'nvd' OR vulnerabilities.cvss_source IS DISTINCT FROM 'nvd')
            THEN EXCLUDED.cvss_vector ELSE vulnerabilities.cvss_vector END,
          cvss_source = CASE WHEN EXCLUDED.cvss_score IS NOT NULL AND (EXCLUDED.cvss_source = 'nvd' OR vulnerabilities.cvss_source IS DISTINCT FROM 'nvd')
            THEN EXCLUDED.cvss_source ELSE vulnerabilities.cvss_source END,
          cwes = ARRAY(SELECT DISTINCT unnest(vulnerabilities.cwes || EXCLUDED.cwes)),
          vendors = ARRAY(SELECT DISTINCT unnest(vulnerabilities.vendors || EXCLUDED.vendors)),
          products = ARRAY(SELECT DISTINCT unnest(vulnerabilities.products || EXCLUDED.products)),
          packages = ARRAY(SELECT DISTINCT unnest(vulnerabilities.packages || EXCLUDED.packages)),
          refs = (ARRAY(SELECT DISTINCT unnest(vulnerabilities.refs || EXCLUDED.refs)))[1:40],
          vuln_status = COALESCE(EXCLUDED.vuln_status, vulnerabilities.vuln_status),
          kev = vulnerabilities.kev OR EXCLUDED.kev,
          kev_date_added = COALESCE(EXCLUDED.kev_date_added, vulnerabilities.kev_date_added),
          kev_due_date = COALESCE(EXCLUDED.kev_due_date, vulnerabilities.kev_due_date),
          kev_required_action = COALESCE(EXCLUDED.kev_required_action, vulnerabilities.kev_required_action),
          kev_ransomware = COALESCE(EXCLUDED.kev_ransomware, vulnerabilities.kev_ransomware),
          sources = ARRAY(SELECT DISTINCT unnest(vulnerabilities.sources || EXCLUDED.sources)),
          published_at = LEAST(vulnerabilities.published_at, EXCLUDED.published_at),
          last_modified_at = GREATEST(vulnerabilities.last_modified_at, EXCLUDED.last_modified_at),
          update_count = vulnerabilities.update_count + CASE
            WHEN vulnerabilities.last_modified_at IS NOT NULL AND EXCLUDED.last_modified_at > vulnerabilities.last_modified_at THEN 1
            WHEN EXCLUDED.kev AND NOT vulnerabilities.kev THEN 1
            ELSE 0 END,
          updated_at = CASE
            WHEN EXCLUDED.last_modified_at IS DISTINCT FROM vulnerabilities.last_modified_at
              OR (EXCLUDED.kev AND NOT vulnerabilities.kev)
              OR NOT (EXCLUDED.sources <@ vulnerabilities.sources)
            THEN NOW() ELSE vulnerabilities.updated_at END
        RETURNING (xmax = 0) AS inserted
        `,
        [
          v.vulnId,
          uniq(v.aliases),
          v.title || null,
          v.description || null,
          normalizeSeverity(v.severity, v.cvssScore),
          Number.isFinite(Number(v.cvssScore)) && v.cvssScore !== null && Number(v.cvssScore) > 0 ? Number(v.cvssScore) : null,
          v.cvssVersion || null,
          v.cvssVector || null,
          v.cvssScore ? v.cvssSource || null : null,
          uniq(v.cwes),
          uniq(v.vendors).slice(0, 20),
          uniq(v.products).slice(0, 30),
          uniq(v.packages).slice(0, 30),
          uniq(v.refs).slice(0, 40),
          v.status || null,
          Boolean(v.kev),
          v.kevDateAdded || null,
          v.kevDueDate || null,
          v.kevRequiredAction || null,
          v.kevRansomware || null,
          uniq(v.sources),
          v.publishedAt || null,
          v.lastModifiedAt || null,
        ]
      );
      if (res.rows[0]?.inserted) inserted += 1;
      else updated += 1;
    }
    await client.query("COMMIT");
    return { inserted, updated };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findVulnerabilities(filters = {}) {
  const params = [];
  const clauses = [];
  if (!filters.includeRejected) clauses.push(`COALESCE(vuln_status, '') NOT IN ('Rejected')`);
  if (filters.severity?.length) {
    params.push(filters.severity);
    clauses.push(`severity = ANY($${params.length})`);
  }
  if (filters.kev) clauses.push("kev = TRUE");
  if (filters.source) {
    params.push(filters.source);
    clauses.push(`$${params.length} = ANY(sources)`);
  }
  if (filters.minScore !== undefined && filters.minScore !== null && filters.minScore !== "") {
    params.push(Number(filters.minScore));
    clauses.push(`cvss_score >= $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`last_modified_at >= $${params.length}`);
  }
  if (filters.q) {
    const q = String(filters.q).trim();
    if (/^(CVE|GHSA)-[\w-]+$/i.test(q)) {
      params.push(`${q.toUpperCase()}%`);
      const p = `$${params.length}`;
      clauses.push(`(upper(vuln_id) LIKE ${p} OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE upper(a) LIKE ${p}))`);
    } else {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      clauses.push(`(vuln_id ILIKE ${p} OR title ILIKE ${p} OR description ILIKE ${p}
        OR array_to_string(vendors, ' ') ILIKE ${p} OR array_to_string(products, ' ') ILIKE ${p}
        OR array_to_string(packages, ' ') ILIKE ${p})`);
    }
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = {
    published: "published_at DESC NULLS LAST, id DESC",
    score: "cvss_score DESC NULLS LAST, last_modified_at DESC NULLS LAST",
    kev: "kev_date_added DESC NULLS LAST, last_modified_at DESC NULLS LAST",
    modified: "last_modified_at DESC NULLS LAST, id DESC",
  }[filters.sort] || "last_modified_at DESC NULLS LAST, id DESC";

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM vulnerabilities ${where}`, params);
  params.push(filters.limit || 20, filters.offset || 0);
  const rows = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM vulnerabilities ${where}
     ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { items: rows.rows, total: totalRes.rows[0].total };
}

export async function getVulnerability(id) {
  const key = String(id || "").trim();
  const res = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM vulnerabilities
     WHERE upper(vuln_id) = upper($1) OR upper($1) = ANY(SELECT upper(a) FROM unnest(aliases) a)
     LIMIT 1`,
    [key]
  );
  return res.rows[0] || null;
}

export async function getVulnerabilityStats() {
  const [bySeverity, totals, sync] = await Promise.all([
    pool.query(`SELECT severity, COUNT(*)::int AS count FROM vulnerabilities
      WHERE COALESCE(vuln_status,'') <> 'Rejected' GROUP BY severity ORDER BY count DESC`),
    pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE kev)::int AS kev,
        COUNT(*) FILTER (WHERE last_modified_at >= NOW() - INTERVAL '24 hours')::int AS "updated24h",
        COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '24 hours')::int AS "published24h",
        MAX(updated_at) AS "lastUpdateAt"
      FROM vulnerabilities WHERE COALESCE(vuln_status,'') <> 'Rejected'`),
    pool.query(`SELECT source, cursor_at AS "cursorAt", last_run_at AS "lastRunAt",
        last_success_at AS "lastSuccessAt", last_result AS "lastResult" FROM vuln_sync_state ORDER BY source`),
  ]);
  return { ...totals.rows[0], bySeverity: bySeverity.rows, sync: sync.rows };
}

export async function getSyncState(source) {
  const res = await pool.query(`SELECT cursor_at AS "cursorAt", last_success_at AS "lastSuccessAt" FROM vuln_sync_state WHERE source = $1`, [source]);
  return res.rows[0] || null;
}

export async function saveSyncState(source, { cursorAt, success, result }) {
  await pool.query(
    `INSERT INTO vuln_sync_state (source, cursor_at, last_run_at, last_success_at, last_result, updated_at)
     VALUES ($1, $2, NOW(), CASE WHEN $3 THEN NOW() END, $4, NOW())
     ON CONFLICT (source) DO UPDATE SET
       cursor_at = COALESCE(EXCLUDED.cursor_at, vuln_sync_state.cursor_at),
       last_run_at = NOW(),
       last_success_at = CASE WHEN $3 THEN NOW() ELSE vuln_sync_state.last_success_at END,
       last_result = EXCLUDED.last_result,
       updated_at = NOW()`,
    [source, cursorAt || null, Boolean(success), JSON.stringify(result || {})]
  );
}

export async function listVulnIdsMissingScore({ limit = 20 } = {}) {
  const res = await pool.query(
    `SELECT vuln_id FROM vulnerabilities
     WHERE kev AND cvss_score IS NULL AND vuln_id LIKE 'CVE-%' AND NOT ('nvd' = ANY(sources))
     ORDER BY kev_date_added DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => r.vuln_id);
}

export async function pruneVulnerabilities({ maxAgeDays }) {
  if (!maxAgeDays) return { deleted: 0 };
  const res = await pool.query(
    `DELETE FROM vulnerabilities WHERE NOT kev
       AND COALESCE(last_modified_at, updated_at) < NOW() - ($1::int * INTERVAL '1 day')`,
    [maxAgeDays]
  );
  return { deleted: res.rowCount };
}
