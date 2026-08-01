"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRealtimeBattleCollectionHandler, createRealtimeBattleCommandHandler } = require("./realtimeArenaHandlers");

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
    headers: { "x-arena-client-schema-version": "2" },
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
  await handler({ method: "POST", headers: { "x-arena-client-schema-version": "2" }, query: {}, body: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "ARENA_AUTH_REQUIRED");
  assert.doesNotMatch(JSON.stringify(response.body), /token secret/);
});

test("realtime collection GET은 인증된 사용자에게 정제된 대기방 목록을 반환한다", async (t) => {
  const previousMode = process.env.REALTIME_ARENA_MODE;
  process.env.REALTIME_ARENA_MODE = "active";
  t.after(() => { if (previousMode === undefined) delete process.env.REALTIME_ARENA_MODE; else process.env.REALTIME_ARENA_MODE = previousMode; });
  const rooms = [{ battleId: "rtb_room", ownerDisplayName: "테이머", isOwn: false }];
  const handler = createRealtimeBattleCollectionHandler({
    verifyRequestUser: async () => ({ uid: "guest" }),
    listWaitingBattles: async ({ uid }) => {
      assert.equal(uid, "guest");
      return rooms;
    },
  });
  const response = createResponse();

  await handler({ method: "GET", headers: { "x-arena-client-schema-version": "2" } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { rooms });
  assert.equal(response.headers["Cache-Control"], "private, no-store");
});

test("realtime collection POST는 cpu 모드를 CPU 생성 서비스로 전달한다", async (t) => {
  const previousMode = process.env.REALTIME_ARENA_MODE;
  process.env.REALTIME_ARENA_MODE = "active";
  t.after(() => { if (previousMode === undefined) delete process.env.REALTIME_ARENA_MODE; else process.env.REALTIME_ARENA_MODE = previousMode; });
  let received = null;
  const handler = createRealtimeBattleCollectionHandler({
    verifyRequestUser: async () => ({ uid: "host" }),
    createCpuBattle: async (input) => {
      received = input;
      return { battle: { battleId: `rtb_${"c".repeat(43)}`, mode: "cpu", status: "selecting" }, role: "host", replayed: false };
    },
  });
  const response = createResponse();

  await handler({
    method: "POST",
    headers: { "x-arena-client-schema-version": "2" },
    body: { requestId: "create-cpu", slotId: "slot1", mode: "cpu" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(received.uid, "host");
  assert.equal(received.slotId, "slot1");
  assert.equal(response.body.battle.mode, "cpu");
});
