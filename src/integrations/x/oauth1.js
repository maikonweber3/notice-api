import crypto from "crypto";

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

export function buildOAuth1Header(method, url, oauthCredentials, extraParams = {}) {
  const {
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  } = oauthCredentials;

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: "1.0",
    ...extraParams,
  };

  const signatureBaseParams = { ...oauthParams };
  const sortedKeys = Object.keys(signatureBaseParams).sort();
  const paramString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(signatureBaseParams[key])}`)
    .join("&");

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  const header =
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
      .join(", ");

  return header;
}
