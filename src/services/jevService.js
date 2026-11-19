import { config } from "../config.js";
import { submitJevDecision } from "../integrations/openrouter/jev.js";

const META_KEYS = new Set(["type", "instructions", "criteria"]);
const ALLOWED_TYPES = new Set(["noul", "choice", "score"]);
const MAX_QUESTIONS = 20;
const MAX_STATE_CHARS = 80_000;

export class JevClientError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isJevAvailable() {
  return Boolean(config.openrouterApiKey);
}

export function defaultJevModel() {
  return config.jevModel;
}

export function resolveJevModel(requested) {
  const model = String(requested || config.jevModel || "").trim();
  if (!model) {
    throw new JevClientError("Modelo Jev não configurado (JEV_MODEL)");
  }
  if (!/^~?typesafe\/jev(?:[-/.]|$)/i.test(model)) {
    throw new JevClientError(
      "Só modelos Jev são aceitos neste endpoint (ex.: ~typesafe/jev-latest)"
    );
  }
  return model;
}

function assertState(state) {
  if (state === undefined || state === null) {
    throw new JevClientError("state é obrigatório (string, objeto ou array)");
  }
  const kind = Array.isArray(state) ? "array" : typeof state;
  if (!["string", "object", "array"].includes(kind) || (kind === "object" && state === null)) {
    throw new JevClientError("state deve ser string, objeto ou array");
  }
  if (kind === "string" && !state.trim()) {
    throw new JevClientError("state não pode ser vazio");
  }
  const size = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (size > MAX_STATE_CHARS) {
    throw new JevClientError(`state excede o máximo de ${MAX_STATE_CHARS} bytes`);
  }
  return state;
}

function normalizeNoul(name, raw) {
  const criteria =
    raw.criteria && typeof raw.criteria === "object" && !Array.isArray(raw.criteria)
      ? raw.criteria
      : { true: raw.true || raw.yes, false: raw.false || raw.no };
  const truthy = String(criteria.true || "").trim();
  const falsy = String(criteria.false || "").trim();
  if (!truthy || !falsy) {
    throw new JevClientError(`Pergunta "${name}": noul precisa de criteria true e false`);
  }
  return { true: truthy, false: falsy };
}

function normalizeChoice(name, raw) {
  let options =
    raw.criteria && typeof raw.criteria === "object" && !Array.isArray(raw.criteria)
      ? raw.criteria
      : null;
  if (!options) {
    options = {};
    for (const [key, value] of Object.entries(raw)) {
      if (META_KEYS.has(key)) continue;
      if (typeof value === "string" && value.trim()) options[key] = value.trim();
    }
  }
  const entries = Object.entries(options).filter(
    ([, value]) => typeof value === "string" && value.trim()
  );
  if (entries.length < 2) {
    throw new JevClientError(`Pergunta "${name}": choice precisa de pelo menos 2 opções`);
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value).trim()]));
}

function normalizeScore(name, raw) {
  if (!Array.isArray(raw.criteria)) {
    throw new JevClientError(`Pergunta "${name}": score precisa de criteria em array`);
  }
  const criteria = raw.criteria.map((item) => String(item).trim()).filter(Boolean);
  if (criteria.length < 2) {
    throw new JevClientError(`Pergunta "${name}": score precisa de pelo menos 2 níveis`);
  }
  return criteria;
}

export function normalizeQuestions(questions) {
  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    throw new JevClientError("questions deve ser um objeto com 1 ou mais perguntas");
  }

  const names = Object.keys(questions);
  if (names.length === 0) {
    throw new JevClientError("Informe pelo menos uma pergunta em questions");
  }
  if (names.length > MAX_QUESTIONS) {
    throw new JevClientError(`No máximo ${MAX_QUESTIONS} perguntas por requisição`);
  }

  const normalized = {};
  for (const name of names) {
    const raw = questions[name];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new JevClientError(`Pergunta "${name}" inválida`);
    }
    const type = String(raw.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(type)) {
      throw new JevClientError(`Pergunta "${name}": type deve ser noul, choice ou score`);
    }
    const instructions = String(raw.instructions || "").trim();
    if (!instructions) {
      throw new JevClientError(`Pergunta "${name}": instructions é obrigatório`);
    }

    let criteria;
    if (type === "noul") criteria = normalizeNoul(name, raw);
    else if (type === "choice") criteria = normalizeChoice(name, raw);
    else criteria = normalizeScore(name, raw);

    normalized[name] = { type, instructions, criteria };
  }
  return normalized;
}

export async function runJevDecision(body = {}) {
  if (!isJevAvailable()) {
    throw new JevClientError("Jev indisponível: OPENROUTER_API_KEY não configurada", 503);
  }

  const model = resolveJevModel(body.model);
  const state = assertState(body.state);
  const questions = normalizeQuestions(body.questions);
  const sessionId = String(body.sessionId || body.session_id || "").trim().slice(0, 256);

  return submitJevDecision({
    model,
    state,
    questions,
    sessionId: sessionId || undefined,
    user: body.user,
    trace: body.trace,
    provider: body.provider,
  });
}
