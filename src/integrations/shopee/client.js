import crypto from "crypto";
import { config } from "../../config.js";

const SHOPEE_GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function buildAuthorization(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha256")
    .update(`${config.shopeeAppId}${timestamp}${payload}${config.shopeeSecret}`)
    .digest("hex");

  return `SHA256 Credential=${config.shopeeAppId}, Timestamp=${timestamp}, Signature=${signature}`;
}

export async function shopeeGraphql(query, variables = {}) {
  if (!config.shopeeAppId || !config.shopeeSecret) {
    throw new Error("SHOPEE_APP_ID e SHOPEE_SECRET são obrigatórios");
  }

  const body = { query, variables };
  const payload = JSON.stringify(body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(SHOPEE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthorization(payload),
      },
      body: payload,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Shopee API HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    if (data.errors?.length) {
      const message = data.errors.map((error) => error.message).join("; ");
      throw new Error(`Shopee API GraphQL error: ${message}`);
    }

    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}
