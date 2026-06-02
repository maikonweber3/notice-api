import crypto from "node:crypto";

export function computeArticleHash(article) {
  const payload = `${article.title || ""}|${article.link || ""}|${article.sourceUrl || ""}|${article.category || ""}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
