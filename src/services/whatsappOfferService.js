import { config } from "../config.js";
import { mirrorNewsToTelegram } from "./telegramNewsService.js";
import {
  fetchGroupInviteLink,
  getInstanceRow,
  isWhatsAppConnected,
  listWhatsAppGroups,
  sendToJid,
} from "../integrations/whatsapp/gateway.js";
import { analyzeMostRelevantNews, newsThemeLabel, pickNewsTheme } from "./whatsappNewsAnalysisService.js";
import {
  getOfferGroupById,
  getOfferGroupByJid,
  listOfferGroups,
  touchGroupPosted,
  upsertOfferGroup,
} from "../repositories/offerGroupsRepository.js";
import {
  claimNextWhatsAppPost,
  discardUnsentWhatsAppPosts,
  enqueueWhatsAppPost,
  getWhatsAppQueueStats,
  wasArticleQueued,
  markWhatsAppFailed,
  markWhatsAppPosted,
  reserveOffersCooldown,
  resetStuckWhatsAppPosts,
  wasOfferPostedRecently,
  wasOfferPostedRecentlyAnywhere,
} from "../repositories/whatsappPostQueueRepository.js";
import { searchShopeeCatalog } from "./shopeeSearchService.js";
import { findRankedOffers, refreshOfferRankScores } from "./offerRankService.js";

const CATEGORY_OFFER_KEYWORDS = {
  tecnologia: "notebook",
  programacao: "teclado",
  games: "gamer",
  cinema: "tv",
  entretenimento: "fone",
  esportes: "relogio",
  investimentos: "notebook",
  "mercado-crypto": "smart",
};

const CATEGORY_LABEL = {
  investimentos: "Investimentos",
  "mercado-crypto": "Mercado Crypto",
  tecnologia: "Tecnologia",
  programacao: "Programação",
  esportes: "Esportes",
  entretenimento: "Entretenimento",
  games: "Games",
  cinema: "Cinema e Séries",
};

function formatBrl(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

async function whatsappReadyToPublish() {
  if (isWhatsAppConnected()) return true;
  const row = await getInstanceRow();
  return row.status === "connected";
}

function isNewsGroup(group) {
  const jid = (config.whatsappNewsGroupJid || "").trim();
  return Boolean(jid) && group.whatsappJid === jid;
}

async function offerIsOnCooldown(groupId, offerId) {
  const hours = config.whatsappOfferCooldownHours;
  if (await wasOfferPostedRecentlyAnywhere(offerId, hours)) return true;
  if (await wasOfferPostedRecently(groupId, offerId, hours)) return true;
  return false;
}

export function buildOfferMessage(offer, rank) {
  const lines = [
    `🏆 Oferta #${rank} do ranking Notice`,
    "",
    offer.title,
  ];

  const price = formatBrl(offer.price ?? offer.priceMin ?? offer.priceMax);
  const discount =
    offer.discountPercent != null && offer.discountPercent > 0
      ? `  (−${offer.discountPercent}%)`
      : "";
  if (price) {
    lines.push("", `💰 ${price}${discount}`);
  }

  const meta = [];
  if (offer.rating != null && offer.rating > 0) {
    meta.push(`⭐ ${Number(offer.rating).toFixed(1)}`);
  }
  if (offer.sales != null && offer.sales > 0) {
    meta.push(`${offer.sales} vendas`);
  }
  if (meta.length) {
    lines.push(meta.join(" · "));
  }
  if (offer.shop?.name) {
    lines.push(`🏪 ${offer.shop.name}`);
  }

  lines.push("", offer.link || "");
  return lines.join("\n").trim();
}

function buildNewsMessage(article, offers, analysis) {
  const label = CATEGORY_LABEL[article.category] || article.category;
  const site = config.whatsappNewsSiteUrl;
  const reviewed = (analysis || article.summary || "").trim().slice(0, 500);
  const lines = [
    `📰 Notice · ${label}`,
    "",
    article.title,
  ];
  if (reviewed) {
    lines.push("", reviewed);
  }
  lines.push("", `🔗 ${site}/articles/${article.id}`);

  if (offers.length) {
    lines.push("", "🛒 Ofertas relacionadas");
    offers.forEach((offer, index) => {
      const price = formatBrl(offer.price ?? offer.priceMin ?? offer.priceMax);
      lines.push("", `${index + 1}. ${offer.title}${price ? ` — ${price}` : ""}`);
      if (offer.link) lines.push(offer.link);
    });
  }

  return lines.join("\n").trim();
}

export async function registerGroupFromWhatsApp({
  jid,
  name,
  description,
  postsPerRun,
  minRankScore,
  fetchInvite = true,
} = {}) {
  if (!jid) {
    throw new Error("jid do grupo é obrigatório");
  }
  let inviteLink = null;
  if (fetchInvite) {
    try {
      inviteLink = await fetchGroupInviteLink(jid);
    } catch (error) {
      console.warn("[whatsapp] Convite do grupo:", error.message);
    }
  }

  return upsertOfferGroup({
    name: name || "Grupo de Ofertas",
    description: description || "As melhores ofertas Shopee, ranqueadas pelo Notice.",
    whatsappJid: jid,
    inviteLink,
    active: true,
    postsPerRun: postsPerRun ?? config.whatsappPostsPerRun,
    minRankScore: minRankScore ?? 0,
  });
}

export async function enqueueRankedOffersForGroups() {
  if (!(await whatsappReadyToPublish())) {
    return { groups: 0, enqueued: 0, reason: "whatsapp_disconnected" };
  }
  await refreshOfferRankScores();
  const groups = (await listOfferGroups({ activeOnly: true })).filter(
    (group) => !isNewsGroup(group)
  );
  if (groups.length === 0) {
    return { groups: 0, enqueued: 0 };
  }

  let enqueued = 0;
  for (const group of groups) {
    const { items } = await findRankedOffers({
      limit: Math.max(group.postsPerRun * 8, 24),
      minScore: Number(group.minRankScore) || 0,
      offerType: "product",
    });

    let taken = 0;
    for (const offer of items) {
      if (taken >= group.postsPerRun) break;
      if (await offerIsOnCooldown(group.id, offer.id)) continue;

      await enqueueWhatsAppPost({
        groupId: group.id,
        offerId: offer.id,
        rankPosition: offer.rank,
        rankScore: offer.rankScore,
        messageText: buildOfferMessage(offer, offer.rank),
        imageUrl: offer.imageUrl,
      });
      taken += 1;
      enqueued += 1;
    }
  }

  return { groups: groups.length, enqueued };
}

async function pickFreshOffers({ groupId, keyword, limit }) {
  const picked = [];
  const seen = new Set();

  const catalog = await searchShopeeCatalog({
    q: keyword,
    type: "product",
    sort: "rank",
    limit: Math.max(limit * 8, 24),
    page: 1,
  }).catch(() => ({ items: [] }));

  for (const offer of catalog.items || []) {
    if (picked.length >= limit) break;
    if (!offer.id || seen.has(offer.id)) continue;
    if (await offerIsOnCooldown(groupId, offer.id)) continue;
    seen.add(offer.id);
    picked.push(offer);
  }

  if (picked.length < limit) {
    const ranked = await findRankedOffers({
      limit: 40,
      offerType: "product",
    });
    for (const offer of ranked.items) {
      if (picked.length >= limit) break;
      if (!offer.id || seen.has(offer.id)) continue;
      if (await offerIsOnCooldown(groupId, offer.id)) continue;
      seen.add(offer.id);
      picked.push(offer);
    }
  }

  return picked;
}

async function newsDispatchGroups() {
  const jid = (config.whatsappNewsGroupJid || "").trim();
  if (jid) {
    const newsGroup = await getOfferGroupByJid(jid);
    if (newsGroup?.active) return [newsGroup];
  }
  return listOfferGroups({ activeOnly: true });
}

async function enqueueArticleNews(group, article, analysis) {
  if (await wasArticleQueued(group.id, article.id)) {
    return null;
  }

  const keyword = CATEGORY_OFFER_KEYWORDS[article.category] || "oferta";
  const offers = await pickFreshOffers({
    groupId: group.id,
    keyword,
    limit: config.whatsappNewsOffers,
  });

  const messageText = buildNewsMessage(article, offers, analysis);
  const queued = await enqueueWhatsAppPost({
    groupId: group.id,
    offerId: null,
    articleId: article.id,
    rankPosition: null,
    rankScore: null,
    messageText,
    imageUrl: offers[0]?.imageUrl || null,
  });
  if (!queued) return null;

  try {
    const telegram = await mirrorNewsToTelegram(messageText);
    if (telegram.failed) {
      console.warn("[telegram] Espelho notícia falhou:", JSON.stringify(telegram));
    }
  } catch (error) {
    console.warn("[telegram] Espelho notícia:", error.message);
  }

  await reserveOffersCooldown(
    group.id,
    offers.map((offer) => offer.id)
  );
  return { articleId: article.id, group: group.name, offers: offers.length };
}

async function pickThemeAnalysis(groupId) {
  const startTheme = pickNewsTheme();
  const themes = config.whatsappNewsThemes.length
    ? config.whatsappNewsThemes
    : [startTheme];
  const startIndex = Math.max(themes.indexOf(startTheme), 0);

  for (let offset = 0; offset < themes.length; offset += 1) {
    const theme = themes[(startIndex + offset) % themes.length];
    const picked = await analyzeMostRelevantNews({ groupId, theme });
    if (picked.article) return picked;
  }
  return { theme: startTheme, article: null, analysis: null, reason: "no_candidates" };
}

export async function enqueueNewsWithOffers() {
  if (!(await whatsappReadyToPublish())) {
    return { enqueued: 0, reason: "whatsapp_disconnected" };
  }

  const groups = await newsDispatchGroups();
  if (groups.length === 0) {
    return { enqueued: 0, reason: "no_active_group" };
  }

  let enqueued = 0;
  const articles = [];
  let analysis = null;

  for (const group of groups) {
    const picked = await pickThemeAnalysis(group.id);
    analysis = {
      theme: picked.theme,
      themeLabel: newsThemeLabel(picked.theme),
      model: picked.model || null,
      candidates: picked.candidates || 0,
      reason: picked.reason || null,
    };
    if (!picked.article) continue;

    const item = await enqueueArticleNews(group, picked.article, picked.analysis);
    if (item) {
      enqueued += 1;
      articles.push(item.articleId);
    }
    break;
  }

  return {
    enqueued,
    articles,
    analysis,
    groups: groups.map((group) => group.name),
  };
}

export async function processNextWhatsAppPost() {
  await resetStuckWhatsAppPosts();
  const item = await claimNextWhatsAppPost();
  if (!item) {
    return { processed: false, reason: "empty_queue" };
  }

  if (item.messageText === "[cooldown]") {
    await markWhatsAppPosted(item.id, { externalId: "cooldown" });
    return { processed: true, id: item.id, status: "skipped_cooldown" };
  }

  if (!isWhatsAppConnected()) {
    await markWhatsAppFailed(item.id, "WhatsApp desconectado");
    return {
      processed: true,
      id: item.id,
      status: "failed",
      error: "WhatsApp desconectado",
    };
  }

  try {
    const sent = await sendToJid({
      to: item.whatsappJid,
      text: item.messageText,
      imageUrl: item.imageUrl,
    });
    await markWhatsAppPosted(item.id, { externalId: sent.externalId });
    await touchGroupPosted(item.groupId);
    return {
      processed: true,
      id: item.id,
      status: "posted",
      group: item.groupName,
      externalId: sent.externalId,
    };
  } catch (error) {
    await markWhatsAppFailed(item.id, error.message);
    return {
      processed: true,
      id: item.id,
      status: "failed",
      error: error.message,
    };
  }
}

export async function drainWhatsAppQueue({ max = 10 } = {}) {
  const results = [];
  for (let i = 0; i < max; i += 1) {
    const result = await processNextWhatsAppPost();
    if (!result.processed) break;
    results.push(result);
  }
  return { processed: results.length, results };
}

export async function publishNow() {
  const queued = await enqueueRankedOffersForGroups();
  const drained = await drainWhatsAppQueue({ max: 30 });
  return { ...queued, ...drained };
}

export async function publishNewsNow() {
  const queued = await enqueueNewsWithOffers();
  const drained = await drainWhatsAppQueue({ max: 10 });
  return { ...queued, ...drained };
}

export {
  discardUnsentWhatsAppPosts,
  getOfferGroupById,
  getWhatsAppQueueStats,
  listWhatsAppGroups,
};
