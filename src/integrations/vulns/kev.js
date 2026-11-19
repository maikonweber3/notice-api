import axios from "axios";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export async function fetchKev() {
  const res = await axios.get(KEV_URL, {
    timeout: 60_000,
    headers: { "User-Agent": "MutterCorp-Notice/1.0", Accept: "application/json" },
  });
  const list = res.data?.vulnerabilities || [];
  return {
    catalogVersion: res.data?.catalogVersion || null,
    dateReleased: res.data?.dateReleased || null,
    items: list.map((k) => ({
      vulnId: k.cveID,
      aliases: [k.cveID],
      title: k.vulnerabilityName || null,
      description: k.shortDescription || null,
      vendors: k.vendorProject ? [k.vendorProject] : [],
      products: k.product ? [k.product] : [],
      cwes: Array.isArray(k.cwes) ? k.cwes : [],
      refs: String(k.notes || "")
        .split(/\s*;\s*|\s+/)
        .filter((u) => /^https?:\/\//.test(u)),
      kev: true,
      kevDateAdded: k.dateAdded || null,
      kevDueDate: k.dueDate || null,
      kevRequiredAction: k.requiredAction || null,
      kevRansomware: k.knownRansomwareCampaignUse || null,
      sources: ["kev"],
      publishedAt: k.dateAdded ? new Date(`${k.dateAdded}T00:00:00Z`).toISOString() : null,
      lastModifiedAt: k.dateAdded ? new Date(`${k.dateAdded}T00:00:00Z`).toISOString() : null,
    })),
  };
}
