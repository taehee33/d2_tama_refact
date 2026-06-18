"use strict";

const Ably = require("ably");
const { verifyRequestUser } = require("./auth");
const { fetchUserProfile, fetchUserRoot } = require("./firebaseAdmin");
const { allowMethods, sendError, sendJson } = require("./http");

const ABLY_CHANNEL_NAME = "tamer-lobby";
const ABLY_TOKEN_TTL_MS = 60 * 60 * 1000;
const ABLY_CAPABILITY = Object.freeze({
  [ABLY_CHANNEL_NAME]: ["publish", "subscribe", "presence"],
});

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getFallbackClientId(decodedToken) {
  const emailPrefix = normalizeString(decodedToken?.email).split("@")[0];

  return (
    normalizeString(decodedToken?.name) ||
    normalizeString(emailPrefix) ||
    `Trainer_${String(decodedToken?.uid || "unknown").slice(0, 6)}`
  );
}

function resolveAblyClientId(profileData = {}, rootData = {}, decodedToken = {}) {
  return (
    normalizeString(profileData.tamerName) ||
    normalizeString(rootData.tamerName) ||
    normalizeString(rootData.displayName) ||
    getFallbackClientId(decodedToken)
  );
}

async function loadAblyClientId(decodedToken, deps = {}) {
  const loadProfile = deps.fetchUserProfile || fetchUserProfile;
  const loadRoot = deps.fetchUserRoot || fetchUserRoot;

  try {
    const [profileData, rootData] = await Promise.all([
      loadProfile(decodedToken.uid, decodedToken.idToken),
      loadRoot(decodedToken.uid, decodedToken.idToken),
    ]);

    return resolveAblyClientId(profileData, rootData, decodedToken);
  } catch (error) {
    console.warn("[ably-token-api] profile fallback", {
      uid: decodedToken.uid,
      message: error?.message || String(error),
    });
    return getFallbackClientId(decodedToken);
  }
}

async function createTokenRequest(apiKey, tokenParams) {
  const client = new Ably.Rest({ key: apiKey });
  return client.auth.createTokenRequest(tokenParams);
}

function createAblyTokenHandler(deps = {}) {
  const authenticate = deps.verifyRequestUser || verifyRequestUser;
  const issueTokenRequest = deps.createTokenRequest || createTokenRequest;
  const getApiKey = deps.getAblyApiKey || (() => process.env.ABLY_API_KEY || "");

  return async function ablyTokenHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      const decodedToken = await authenticate(req);
      const apiKey = getApiKey();

      if (!apiKey) {
        return sendError(
          res,
          503,
          "ably_not_configured",
          "실시간 채팅 서버가 설정되지 않았습니다."
        );
      }

      const clientId = await loadAblyClientId(decodedToken, deps);
      const tokenRequest = await issueTokenRequest(apiKey, {
        clientId,
        capability: JSON.stringify(ABLY_CAPABILITY),
        ttl: ABLY_TOKEN_TTL_MS,
      });

      return sendJson(res, 200, tokenRequest);
    } catch (error) {
      const status = Number(error?.status) || 500;

      if (status >= 500) {
        console.error("[ably-token-api] token request failed", {
          status,
          message: error?.message || String(error),
        });
      }

      return sendError(
        res,
        status,
        status === 401 ? "invalid_auth" : "ably_token_failed",
        status === 401
          ? "로그인 인증이 만료되었거나 올바르지 않습니다."
          : "실시간 채팅 인증을 준비하지 못했습니다."
      );
    }
  };
}

module.exports = {
  ABLY_CAPABILITY,
  ABLY_CHANNEL_NAME,
  ABLY_TOKEN_TTL_MS,
  createAblyTokenHandler,
  getFallbackClientId,
  loadAblyClientId,
  resolveAblyClientId,
};
