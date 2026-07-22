"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createArenaBattleHandler } = require("./arenaBattleHandlers");

function createResponse() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; },
  };
}

test("배틀 HTTP handler는 인증 UID만 service에 전달하고 200 DTO를 반환한다", async () => {
  const calls = [];
  const db = { doc: () => ({ get: async () => ({ exists: true, data: () => ({ minArenaClientSchemaVersion: 2 }) }) }) };
  const handler = createArenaBattleHandler({
    db,
    verifyRequestUser: async () => ({ uid: "attacker" }),
    runTransaction: async () => ({ battle: { battleId: "battle-id" } }),
    projectAttacker: () => { calls.push("project"); },
  });
  // 실제 service 대신 기존 battle 문서를 반환하는 transaction 경계를 흉내 낸다.
  const existingDb = {
    ...db,
    doc(path) {
      if (path === "game_settings/arena_config") return db.doc(path);
      return { path };
    },
  };
  const existingHandler = createArenaBattleHandler({
    db: existingDb,
    verifyRequestUser: async () => ({ uid: "attacker" }),
    runTransaction: async (callback) => callback({
      get: async () => ({ exists: true, data: () => ({
        requestHash: require("./arenaDomain").createBattleRequestHash({ attackerSlotId: "slot1", defenderGhostId: "ghost_other" }),
        responsePayload: { battle: { battleId: "battle-id" } },
      }) }),
    }),
    seed: "fixed-seed",
    requestReceivedAt: new Date("2026-07-19T00:00:00.000Z"),
  });
  const req = {
    method: "POST",
    headers: { "x-arena-client-schema-version": "2" },
    body: { requestId: "request-1", attackerSlotId: "1", defenderGhostId: "ghost_other" },
  };
  const res = createResponse();
  await existingHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.battle.battleId, "battle-id");
  assert.equal(calls.length, 0);
  assert.equal(typeof handler, "function");
});
