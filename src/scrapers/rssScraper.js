import { XMLParser } from "fast-xml-parser";
import { httpClient } from "../httpClient.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "#text" in value) return String(value["#text"]).trim();
  return String(value).trim();
}

function toIsoDate(value) {
  const text = pickText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function scrapeRss(feedUrl) {
  const response = await httpClient.get(feedUrl);
  const xml = response.data;
  const parsed = parser.parse(xml);
  const now = new Date().toISOString();

  const channelItems = normalizeArray(parsed?.rss?.channel?.item);
  const atomEntries = normalizeArray(parsed?.feed?.entry);

  const rssResults = channelItems.map((item) => ({
    sourceType: "rss",
    source: feedUrl,
    title: pickText(item?.title),
    link: pickText(item?.link),
    summary: pickText(item?.description),
    publishedAt: toIsoDate(item?.pubDate),
    collectedAt: now,
  }));

  const atomResults = atomEntries.map((entry) => {
    const links = normalizeArray(entry?.link);
    const firstHref = links.find((l) => l?.href)?.href || "";
    return {
      sourceType: "rss",
      source: feedUrl,
      title: pickText(entry?.title),
      link: pickText(firstHref),
      summary: pickText(entry?.summary) || pickText(entry?.content),
      publishedAt: toIsoDate(entry?.updated) || toIsoDate(entry?.published),
      collectedAt: now,
    };
  });

  return [...rssResults, ...atomResults].filter((item) => item.title);
}
