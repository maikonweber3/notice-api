import axios from "axios";
import { config } from "../../config.js";

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nvdDate(value) {
  if (!value) return null;
  const text = String(value);
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickMetric(metrics = {}) {
  const order = [
    ["cvssMetricV40", "4.0"],
    ["cvssMetricV31", "3.1"],
    ["cvssMetricV30", "3.0"],
    ["cvssMetricV2", "2.0"],
  ];
  // Prefer v3.1 (mais comum para severidade), depois v4, v3.0, v2
  const preferred = [order[1], order[0], order[2], order[3]];
  for (const [key, version] of preferred) {
    const list = metrics[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const m = list.find((x) => x.type === "Primary") || list[0];
    const data = m.cvssData || {};
    return {
      score: data.baseScore ?? null,
      severity: data.baseSeverity || m.baseSeverity || null,
      vector: data.vectorString || null,
      version: data.version || version,
      source: m.source === "nvd@nist.gov" ? "nvd" : "nvd-cna",
    };
  }
  return null;
}

function extractCpe(configurations = []) {
  const vendors = new Set();
  const products = new Set();
  for (const cfg of configurations) {
    for (const node of cfg.nodes || []) {
      for (const match of node.cpeMatch || []) {
        if (!match.vulnerable) continue;
        const parts = String(match.criteria || "").split(":");
        if (parts.length > 5) {
          if (parts[3] && parts[3] !== "*") vendors.add(parts[3].replace(/_/g, " "));
          if (parts[4] && parts[4] !== "*") products.add(parts[4].replace(/_/g, " "));
        }
      }
    }
  }
  return { vendors: [...vendors], products: [...products] };
}

export function mapNvdCve(cve) {
  const description =
    (cve.descriptions || []).find((d) => d.lang === "en")?.value ||
    cve.descriptions?.[0]?.value ||
    null;
  const metric = pickMetric(cve.metrics);
  const cpe = extractCpe(cve.configurations);
  for (const aff of cve.affected || []) {
    for (const d of aff.affectedData || []) {
      if (d.vendor && d.vendor !== "n/a") cpe.vendors.push(d.vendor);
      if (d.product && d.product !== "n/a") cpe.products.push(d.product);
    }
  }
  const cwes = [];
  for (const w of cve.weaknesses || []) {
    for (const d of w.description || []) {
      if (d.value && /^CWE-\d+$/.test(d.value)) cwes.push(d.value);
    }
  }
  return {
    vulnId: cve.id,
    aliases: [cve.id],
    title: null,
    description,
    severity: metric?.severity || null,
    cvssScore: metric?.score ?? null,
    cvssVersion: metric?.version || null,
    cvssVector: metric?.vector || null,
    cvssSource: metric ? "nvd" : null,
    cwes,
    vendors: cpe.vendors,
    products: cpe.products,
    refs: (cve.references || []).map((r) => r.url),
    status: cve.vulnStatus || null,
    kev: Boolean(cve.cisaExploitAdd),
    kevDateAdded: cve.cisaExploitAdd || null,
    kevDueDate: cve.cisaActionDue || null,
    kevRequiredAction: cve.cisaRequiredAction || null,
    sources: ["nvd"],
    publishedAt: nvdDate(cve.published),
    lastModifiedAt: nvdDate(cve.lastModified),
  };
}

function client() {
  const headers = { "User-Agent": "MutterCorp-Notice/1.0 (+https://news.muttercorp.com.br)" };
  if (config.nvdApiKey) headers.apiKey = config.nvdApiKey;
  return axios.create({ baseURL: NVD_URL, timeout: 90_000, headers });
}

// NVD: 5 req/30s sem chave, 50 req/30s com chave.
const delayMs = () => (config.nvdApiKey ? 1_000 : 6_500);

async function getWithRetry(http, params, attempt = 1) {
  try {
    return await http.get("", { params });
  } catch (error) {
    const status = error.response?.status;
    if (attempt < 4 && (!status || status === 403 || status === 429 || status >= 500)) {
      await sleep(delayMs() * attempt * 2);
      return getWithRetry(http, params, attempt + 1);
    }
    throw error;
  }
}

/** Busca CVEs modificadas entre start e end (máx. 120 dias por janela na NVD). */
export async function fetchNvdModified({ start, end, onPage }) {
  const http = client();
  const resultsPerPage = 2000;
  let startIndex = 0;
  let total = 0;
  let pages = 0;
  do {
    if (pages > 0) await sleep(delayMs());
    const res = await getWithRetry(http, {
      lastModStartDate: start.toISOString(),
      lastModEndDate: end.toISOString(),
      resultsPerPage,
      startIndex,
    });
    total = res.data.totalResults || 0;
    const items = (res.data.vulnerabilities || []).map((v) => mapNvdCve(v.cve));
    await onPage(items);
    startIndex += resultsPerPage;
    pages += 1;
  } while (startIndex < total && pages < 100);
  return { total, pages };
}

export async function fetchNvdById(cveId) {
  const http = client();
  const res = await getWithRetry(http, { cveId });
  const v = res.data.vulnerabilities?.[0];
  return v ? mapNvdCve(v.cve) : null;
}

export { sleep, delayMs as nvdDelayMs };
