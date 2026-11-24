/**
 * Detecta matérias de One Piece e possíveis spoilers a partir do título/resumo/fonte.
 * Usado na listagem (flags + filtros) sem exigência de coluna extra no banco.
 */

export const ONE_PIECE_REGEX =
  "(one[-\\s]?piece|\\mluffy\\M|\\mroronoa\\M|\\mzoro\\M|\\msanji\\M|\\musopp\\M|" +
  "\\mchopper\\M|nico\\s*robin|\\mjimbei\\M|\\mjinbei\\M|\\mjinbe\\M|" +
  "mugiwara|straw\\s*hats?|chap[eé]u\\s*de\\s*palha|eiichiro\\s*oda|" +
  "oda[-\\s]?sensei|gear\\s*(4|5|four|five|fourth|fifth)|\\mnika\\M|" +
  "joy\\s*boy|joyboy|\\melbaf\\M|\\megghead\\M|\\mwano\\M|\\mshanks\\M|" +
  "blackbeard|barbe?\\s*negra|\\mimu\\M|going\\s*merry|thousand\\s*sunny|" +
  "trafalgar\\s*law|\\mmugiwara\\M)";

export const SPOILER_REGEX =
  "(spoilers?|alerta\\s+de\\s+spoiler|spoiler\\s+alert|" +
  "vazamentos?|vazad[oa]s?|\\mvazou\\M|" +
  "leaks?|leaked|leaking|" +
  "cap[íi]tulo\\s*#?\\d+|chapters?\\s*#?\\d+|\\bch\\.?\\s*\\d+|" +
  "\\mraws?\\M|chapter\\s+secrets|full\\s+summary|major\\s+spoilers?|" +
  "scan\\s+(do|de|one)|\\mredon\\M)";

const ONE_PIECE_RE = new RegExp(
  ONE_PIECE_REGEX.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"),
  "i",
);
const SPOILER_RE = new RegExp(
  SPOILER_REGEX.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"),
  "i",
);

export function isOnePieceSourceName(sourceName) {
  return /one[\s-]?piece/i.test(sourceName || "");
}

export function isOnePieceText(text) {
  return ONE_PIECE_RE.test(text || "");
}

export function isSpoilerText(text) {
  return SPOILER_RE.test(text || "");
}

export function annotateAnimeFlags(article) {
  if (!article) return article;
  const text = `${article.title || ""} ${article.summary || ""}`;
  const isOnePiece =
    isOnePieceSourceName(article.sourceName) || isOnePieceText(text);
  const isSpoiler = isSpoilerText(text);
  return { ...article, isOnePiece, isSpoiler };
}
