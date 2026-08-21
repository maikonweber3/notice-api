export function jidUser(jidOrUser) {
  return String(jidOrUser || "")
    .replace(/@.*/, "")
    .split(":")[0]
    .replace(/\D/g, "");
}

/** Aceita E.164, JID 1:1 ou JID de grupo (@g.us). */
export function toWhatsAppJid(to) {
  const trimmed = String(to || "").trim();
  if (!trimmed) {
    throw new Error("Destino WhatsApp vazio");
  }
  if (trimmed.includes("@")) {
    const [user, server] = trimmed.split("@");
    const cleanUser = user.split(":")[0];
    return `${cleanUser}@${server}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 14) {
    return `${digits}@lid`;
  }
  return `${digits}@s.whatsapp.net`;
}

export function isGroupJid(jid) {
  return String(jid || "").endsWith("@g.us");
}
