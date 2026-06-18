"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ABLY_CAPABILITY,
  ABLY_TOKEN_TTL_MS,
  createAblyTokenHandler,
  resolveAblyClientId,
} = require("./ablyAuth");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("프로필 테이머명을 Ably clientId로 우선 사용한다", () => {
  assert.equal(
    resolveAblyClientId(
      { tamerName: "프로필 테이머" },
      { tamerName: "루트 테이머" },
      { uid: "user-123", name: "인증 이름" }
    ),
    "프로필 테이머"
  );
});

test("인증 사용자에게 로비 전용 제한 토큰 요청을 발급한다", async () => {
  let receivedApiKey = null;
  let receivedTokenParams = null;
  const handler = createAblyTokenHandler({
    verifyRequestUser: async () => ({
      uid: "user-123",
      email: "tester@example.com",
      idToken: "firebase-token",
    }),
    fetchUserProfile: async () => ({ tamerName: "테스터" }),
    fetchUserRoot: async () => ({ displayName: "표시 이름" }),
    getAblyApiKey: () => "app.key:server-secret",
    createTokenRequest: async (apiKey, tokenParams) => {
      receivedApiKey = apiKey;
      receivedTokenParams = tokenParams;
      return { keyName: "app.key", nonce: "nonce", mac: "mac" };
    },
  });
  const response = createResponse();

  await handler({ method: "POST", headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { keyName: "app.key", nonce: "nonce", mac: "mac" });
  assert.equal(receivedApiKey, "app.key:server-secret");
  assert.equal(receivedTokenParams.clientId, "테스터");
  assert.equal(receivedTokenParams.ttl, ABLY_TOKEN_TTL_MS);
  assert.deepEqual(JSON.parse(receivedTokenParams.capability), ABLY_CAPABILITY);
});

test("서버 Ably 키가 없으면 503을 반환한다", async () => {
  const handler = createAblyTokenHandler({
    verifyRequestUser: async () => ({ uid: "user-123", idToken: "firebase-token" }),
    getAblyApiKey: () => "",
  });
  const response = createResponse();

  await handler({ method: "POST", headers: {} }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, "ably_not_configured");
});

test("인증 실패 상세를 숨기고 401을 반환한다", async () => {
  const authError = new Error("raw firebase error");
  authError.status = 401;
  const handler = createAblyTokenHandler({
    verifyRequestUser: async () => {
      throw authError;
    },
    getAblyApiKey: () => "app.key:server-secret",
  });
  const response = createResponse();

  await handler({ method: "POST", headers: {} }, response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "invalid_auth");
  assert.equal(response.body.error.message.includes("raw firebase error"), false);
});

test("operator status 진입점의 Ably 분기가 인증 handler로 연결된다", async () => {
  const identityServiceHandler = require("../operator/status");
  const response = createResponse();

  await identityServiceHandler(
    {
      method: "POST",
      query: { action: "ably-token" },
      headers: {},
    },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "invalid_auth");
});
