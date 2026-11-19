import { chatCompletion } from "../integrations/openrouter/client.js";
import { config } from "../config.js";
import { findRecentArticlesForTheme } from "../repositories/articlesRepository.js";

const THEME_LABELS = {
  investimentos: "Investimentos",
  "mercado-crypto": "Mercado Crypto",
  tecnologia: "Tecnologia",
  programacao: "Programação",
  esportes: "Esportes",
  entretenimento: "Entretenimento",
  games: "Games",
  cinema: "Cinema e Séries",
};

const SYSTEM_PROMPT = `Você escolhe a notícia mais relevante de um único tema para um grupo de WhatsApp.
Critérios: impacto, novidade, clareza e interesse geral. Evite fofoca vazia e repetição.
Responda APENAS um JSON válido, sem markdown:
{"id":123,"analysis":"texto curto em português"}
A análise tem 2 ou 3 frases, tom calmo, sem emoji e sem inventar fatos.`;

export function newsThemeLabel(theme) {
  return THEME_LABELS[theme] || theme;
}

export function pickNewsTheme(date = new Date()) {
  const themes = config.whatsappNewsThemes;
  if (themes.length === 0) return "tecnologia";
  const slot = Math.floor(date.getTime() / (3 * 60 * 60 * 1000));
  return themes[slot % themes.length];
}

function parseSelection(raw, candidates) {
  const ids = new Set(candidates.map((article) => Number(article.id)));
  const match = String(raw || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const id = Number(parsed.id);
    if (!ids.has(id)) return null;
    const analysis = String(parsed.analysis || "").replace(/\s+/g, " ").trim();
    if (!analysis) return null;
    return { id, analysis: analysis.slice(0, 500) };
  } catch {
    return null;
  }
}

function fallbackSelection(candidates) {
  const article = candidates[0];
  const analysis = (article.summary || article.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
  return { id: Number(article.id), analysis };
}

function buildCatalog(theme, candidates) {
  const lines = candidates.map((article) => {
    const excerpt = (article.summary || "").replace(/\s+/g, " ").trim().slice(0, 180);
    return `#${article.id} | ${article.title}${excerpt ? ` — ${excerpt}` : ""}`;
  });
  return [
    `Tema desta rodada: ${newsThemeLabel(theme)} (${theme}).`,
    "Escolha UMA notícia, a mais relevante agora.",
    "",
    ...lines,
  ].join("\n");
}

export async function analyzeMostRelevantNews({ groupId, theme } = {}) {
  const selectedTheme = theme || pickNewsTheme();
  const candidates = await findRecentArticlesForTheme({
    category: selectedTheme,
    groupId,
    limit: 12,
    maxAgeHours: config.whatsappNewsLookbackHours,
  });

  if (candidates.length === 0) {
    return { theme: selectedTheme, article: null, analysis: null, reason: "no_candidates" };
  }

  let selection = fallbackSelection(candidates);
  try {
    const { text, model } = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildCatalog(selectedTheme, candidates) },
      ],
      maxTokens: 280,
      temperature: 0.35,
    });
    selection = parseSelection(text, candidates) || selection;
    const article = candidates.find((item) => Number(item.id) === selection.id) || candidates[0];
    return {
      theme: selectedTheme,
      article,
      analysis: selection.analysis,
      model,
      candidates: candidates.length,
    };
  } catch (error) {
    const article = candidates.find((item) => Number(item.id) === selection.id) || candidates[0];
    return {
      theme: selectedTheme,
      article,
      analysis: selection.analysis,
      candidates: candidates.length,
      model: null,
      reason: error.message,
    };
  }
}
