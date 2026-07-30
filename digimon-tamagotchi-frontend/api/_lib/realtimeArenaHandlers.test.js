"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRealtimeBattleCommandHandler } = require("./realtimeArenaHandlers");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end(payload) { this.body = JSON.parse(payload); },
  };
}

test("realtime command handler는 command별 allowlist와 private no-store를 강제한다", async (t) => {
  const previousMode = process.env.REALTIME_ARENA_MODE;
  process.env.REALTIME_ARENA_MODE = "active";
  t.after(() => { if (previousMode === undefined) delete process.env.REALTIME_ARENA_MODE; else process.env.REALTIME_ARENA_MODE = previousMode; });
  const handler = createRealtimeBattleCommandHandler({ verifyRequestUser: async () => ({ uid: "host" }) });
  const response = createResponse();
  await handler({
    method: "POST",
    headers: { "x-arena-client-schema-version": "1" },
    query: { battleId: `rtb_${"a".repeat(43)}` },
    body: { command: "submit-action", requestId: "request-1", round: 1, expectedStateVersion: 1, action: "attack", uid: "forged" },
  }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, "ARENA_INVALID_REQUEST");
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.equal(response.headers.Vary, "Authorization");
});

test("realtime handler 인증 오류는 내부 상세 없이 Arena 오류로 정규화한다", async () => {
  const handler = createRealtimeBattleCommandHandler({ verifyRequestUser: async () => { const error = new Error("token secret"); error.status = 401; throw error; } });
  const response = createResponse();
  await handler({ method: "POST", headers: { "x-arena-client-schema-version": "1" }, query: {}, body: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "ARENA_AUTH_REQUIRED");
  assert.doesNotMatch(JSON.stringify(response.body), /token secret/);
});
