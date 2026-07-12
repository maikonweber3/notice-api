import { config } from "../../config.js";
import { buildOAuth1Header } from "./oauth1.js";

const X_TWEETS_URL = "https://api.twitter.com/2/tweets";

export function isXConfigured() {
  return Boolean(
    config.xApiKey &&
      config.xApiSecret &&
      config.xAccessToken &&
      config.xAccessTokenSecret
  );
}

export async function postTweet(text) {
  if (!isXConfigured()) {
    throw new Error(
      "Credenciais X incompletas (API_KEY_X, API_SECRET_X, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)"
    );
  }

  const body = JSON.stringify({ text });
  const authorization = buildOAuth1Header("POST", X_TWEETS_URL, {
    consumerKey: config.xApiKey,
    consumerSecret: config.xApiSecret,
    accessToken: config.xAccessToken,
    accessTokenSecret: config.xAccessTokenSecret,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(X_TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const detail =
        data?.detail || data?.title || data?.errors?.[0]?.message || JSON.stringify(data);
      throw new Error(`X API HTTP ${response.status}: ${detail}`);
    }

    return {
      tweetId: data?.data?.id || null,
      text: data?.data?.text || text,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Timeout na requisição à API do X");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
