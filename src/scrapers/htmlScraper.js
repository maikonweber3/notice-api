import * as cheerio from "cheerio";
import { httpClient } from "../httpClient.js";

export async function scrapeHtml(url, selector = "article h2, h2, h3") {
  const response = await httpClient.get(url);
  const html = response.data;
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const results = [];

  $(selector).each((_, element) => {
    const node = $(element);
    const title = node.text().trim();
    const anchor = node.is("a") ? node : node.find("a").first();
    const link = anchor.attr("href") || "";
    if (!title) return;

    results.push({
      sourceType: "html",
      source: url,
      title,
      link,
      summary: "",
      publishedAt: null,
      collectedAt: now,
    });
  });

  return results;
}
