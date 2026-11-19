import axios from "axios";
import { config } from "../../config.js";

const GHSA_URL = "https://api.github.com/advisories";

function mapAdvisory(a) {
  const cvss = a.cvss_severities?.cvss_v4?.score
    ? { score: a.cvss_severities.cvss_v4.score, vector: a.cvss_severities.cvss_v4.vector_string, version: "4.0" }
    : a.cvss_severities?.cvss_v3?.score
      ? { score: a.cvss_severities.cvss_v3.score, vector: a.cvss_severities.cvss_v3.vector_string, version: "3.x" }
      : a.cvss?.score
        ? { score: a.cvss.score, vector: a.cvss.vector_string, version: "3.x" }
        : null;
  const packages = (a.vulnerabilities || [])
    .map((v) => (v.package ? `${v.package.ecosystem}:${v.package.name}` : null))
    .filter(Boolean);
  return {
    vulnId: a.cve_id || a.ghsa_id,
    aliases: [a.ghsa_id, a.cve_id].filter(Boolean),
    title: a.summary || null,
    description: a.description ? String(a.description).slice(0, 4000) : null,
    severity: a.severity || null,
    cvssScore: cvss?.score ?? null,
    cvssVersion: cvss?.version || null,
    cvssVector: cvss?.vector || null,
    cvssSource: cvss ? "ghsa" : null,
    cwes: (a.cwes || []).map((c) => c.cwe_id),
    packages,
    products: (a.vulnerabilities || []).map((v) => v.package?.name).filter(Boolean),
    refs: [a.html_url, ...(a.references || [])],
    status: a.withdrawn_at ? "Withdrawn" : null,
    sources: ["ghsa"],
    publishedAt: a.published_at || null,
    lastModifiedAt: a.updated_at || null,
  };
}

/** Lista advisories revisados atualizados após `since` (mais recentes primeiro). */
export async function fetchGhsaUpdatedSince(since, { maxPages = 5 } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MutterCorp-Notice/1.0",
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  const items = [];
  let url = GHSA_URL;
  let params = { type: "reviewed", sort: "updated", direction: "desc", per_page: 100 };
  let newest = null;
  for (let page = 0; page < maxPages && url; page += 1) {
    const res = await axios.get(url, { params, headers, timeout: 60_000 });
    const list = res.data || [];
    let reachedCursor = false;
    for (const a of list) {
      if (!newest || a.updated_at > newest) newest = a.updated_at;
      if (since && new Date(a.updated_at) <= since) {
        reachedCursor = true;
        break;
      }
      if (a.withdrawn_at) continue;
      items.push(mapAdvisory(a));
    }
    if (reachedCursor || list.length === 0) break;
    const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.link || "");
    url = next ? next[1] : null;
    params = undefined;
  }
  return { items, newest: newest ? new Date(newest) : null };
}
