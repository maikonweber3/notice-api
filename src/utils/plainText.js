import * as cheerio from "cheerio";

function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Converte HTML/markup (RSS description, Atom content) em texto simples.
 */
export function toPlainText(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return collapseWhitespace(raw);
  }

  const $ = cheerio.load(raw, { decodeEntities: true });
  $("script, style, noscript").remove();
  return collapseWhitespace($.root().text());
}

export function toPlainTextOrNull(value, { maxLength } = {}) {
  const text = toPlainText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }
  return text;
}
