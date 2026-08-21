import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { config } from "../../config.js";
import { pool } from "../../db/pool.js";
import { isGroupJid, jidUser, toWhatsAppJid } from "./jid.js";
import { qrStringToDataUrl } from "./qrcode.js";

const INSTANCE_ID = "notice";

const baileysLogger = {
  level: "error",
  child() {
    return this;
  },
  trace() {},
  debug() {},
  info() {},
  warn(...args) {
    console.warn("[baileys]", ...args);
  },
  error(...args) {
    console.error("[baileys]", ...args);
  },
  fatal(...args) {
    console.error("[baileys]", ...args);
  },
};

let baileysModule = null;
let session = null;
let starting = false;
let qrcode = null;
let qrcodeAt = 0;

async function loadBaileys() {
  if (!baileysModule) {
    const ns = await import("@whiskeysockets/baileys");
    baileysModule =
      ns.makeWASocket || ns.useMultiFileAuthState
        ? ns
        : ns.default && typeof ns.default === "object"
          ? ns.default
          : ns;
  }
  return baileysModule;
}

async function upsertInstance({ status, phone = undefined }) {
  const sets = ["status = $2", "updated_at = NOW()"];
  const params = [INSTANCE_ID, status];
  if (phone !== undefined) {
    params.push(phone);
    sets.push(`phone = $${params.length}`);
  }
  if (status === "connected") {
    sets.push("last_connected_at = NOW()");
  }
  await pool.query(
    `UPDATE whatsapp_instances SET ${sets.join(", ")} WHERE id = $1`,
    params
  );
}

function sessionDir() {
  return join(config.whatsappSessionDir, INSTANCE_ID);
}

export function getSessionSnapshot() {
  const qrFresh =
    qrcode && qrcodeAt && Date.now() - qrcodeAt < config.whatsappQrTtlMs
      ? qrcode
      : null;
  return {
    id: INSTANCE_ID,
    status: session?.state === "open" ? "connected" : session ? "connecting" : "disconnected",
    connectionState: session?.state || "close",
    phone: session?.phone || null,
    qrcode: qrFresh,
    active: Boolean(session),
  };
}

export async function getInstanceRow() {
  const result = await pool.query(
    `
    SELECT
      id,
      phone,
      status,
      last_connected_at AS "lastConnectedAt",
      updated_at AS "updatedAt"
    FROM whatsapp_instances
    WHERE id = $1
  `,
    [INSTANCE_ID]
  );
  return result.rows[0] || { id: INSTANCE_ID, status: "disconnected", phone: null };
}

export async function startSession() {
  if (session || starting) {
    return getSessionSnapshot();
  }
  starting = true;

  try {
    await mkdir(sessionDir(), { recursive: true });
    const baileys = await loadBaileys();
    const { useMultiFileAuthState, fetchLatestBaileysVersion, makeWASocket, DisconnectReason } =
      baileys;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir());
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: ["Notice", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    session = {
      socket,
      state: "connecting",
      phone: undefined,
    };
    await upsertInstance({ status: "connecting" });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrcode = await qrStringToDataUrl(qr);
          qrcodeAt = Date.now();
        } catch (error) {
          console.error("[whatsapp] QR:", error.message);
        }
      }

      if (connection && session) {
        session.state = connection;
        if (connection === "open") {
          const userId = socket.user?.id || "";
          const digits = jidUser(userId);
          session.phone = digits ? `+${digits}` : undefined;
          qrcode = null;
          qrcodeAt = 0;
          await upsertInstance({ status: "connected", phone: session.phone || null });
          console.log(`[whatsapp] Conectado ${session.phone || ""}`);
        }
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const replaced =
          statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
        session = null;
        qrcode = null;

        if (replaced || loggedOut) {
          await upsertInstance({ status: "disconnected", phone: null });
          console.error(
            `[whatsapp] Sessão encerrada (code ${statusCode}). ${replaced ? "Substituída por outro aparelho." : "Logout."}`
          );
          return;
        }

        await upsertInstance({ status: "disconnected" });
        console.warn(`[whatsapp] Caiu (code ${statusCode}), reconectando em 5s...`);
        setTimeout(() => {
          startSession().catch((error) => {
            console.error("[whatsapp] Reconexão falhou:", error.message);
          });
        }, config.whatsappReconnectDelayMs);
      }
    });

    return getSessionSnapshot();
  } finally {
    starting = false;
  }
}

export async function stopSession({ logout = false } = {}) {
  const active = session;
  session = null;
  qrcode = null;
  qrcodeAt = 0;
  if (active?.socket) {
    try {
      if (logout) {
        await active.socket.logout();
      } else {
        active.socket.end(undefined);
      }
    } catch (error) {
      console.warn("[whatsapp] Encerrar sessão:", error.message);
    }
  }
  if (logout) {
    await rm(sessionDir(), { recursive: true, force: true });
    await upsertInstance({ status: "disconnected", phone: null });
  }
}

export async function restoreSession() {
  const row = await getInstanceRow();
  if (row.status === "connected" || row.status === "connecting") {
    console.log("[whatsapp] Restaurando sessão...");
    await startSession();
  }
}

export async function listWhatsAppGroups() {
  if (!session?.socket || session.state !== "open") {
    throw new Error("WhatsApp não está conectado. Escaneie o QR primeiro.");
  }
  const participating = await session.socket.groupFetchAllParticipating();
  return Object.values(participating || {}).map((group) => ({
    jid: group.id,
    name: group.subject || "Grupo",
    size: group.size ?? (group.participants || []).length,
    announce: Boolean(group.announce),
  }));
}

export async function fetchGroupInviteLink(jid) {
  if (!session?.socket || session.state !== "open") {
    throw new Error("WhatsApp não está conectado");
  }
  const code = await session.socket.groupInviteCode(toWhatsAppJid(jid));
  return `https://chat.whatsapp.com/${code}`;
}

export async function sendToJid({ to, text, imageUrl }) {
  if (!session?.socket || session.state !== "open") {
    throw new Error("Sessão WhatsApp não está ativa");
  }
  const jid = toWhatsAppJid(to);
  const payload = imageUrl
    ? { image: { url: imageUrl }, caption: text }
    : { text };
  const sent = await session.socket.sendMessage(jid, payload);
  return {
    externalId: sent?.key?.id || `baileys-${Date.now()}`,
    jid,
    isGroup: isGroupJid(jid),
  };
}

export function isWhatsAppConnected() {
  return Boolean(session?.socket && session.state === "open");
}
