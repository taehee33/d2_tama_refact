"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildOpponentGhostDto,
  classifyGhostLinkStatus,
  createArenaGhostCollectionHandler,
} = require("./arenaGhostHandlers");

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };
}

function createConfigDb(config) {
  return {
    doc() {
      return {
        async get() {
          return { exists: true, data: () => config };
        },
      };
    },
  };
}

test("Ghost API는 minimum client schema보다 낮은 요청을 structured 426으로 거부한다", async () => {
  const handler = createArenaGhostCollectionHandler({
    verifyRequestUser: async () => ({ uid: "owner-a" }),
    db: createConfigDb({ minArenaClientSchemaVersion: 3 }),
  });
  const response = createResponse();
  await handler(
    {
      method: "GET",
      headers: { "x-arena-client-schema-version": "2" },
      query: { scope: "mine" },
    },
    response
  );
  assert.equal(response.statusCode, 426);
  assert.equal(response.payload.error.code, "ARENA_CLIENT_UPGRADE_REQUIRED");
  assert.equal(response.payload.error.retryable, false);
});

test("Ghost API 인증 오류는 ArenaError 계약으로 정규화한다", async () => {
  const authError = new Error("legacy auth error");
  authError.status = 401;
  const handler = createArenaGhostCollectionHandler({
    verifyRequestUser: async () => {
      throw authError;
    },
  });
  const response = createResponse();
  await handler({ method: "GET", headers: {}, query: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.error.code, "ARENA_AUTH_REQUIRED");
});

test("Ghost link status는 exact identity일 때만 linked다", () => {
  const ghost = {
    sourceDigimonInstanceId: "life-a",
    sourceCombatRevision: 2,
    snapshot: { digimonId: "Greymon" },
  };
  assert.equal(
    classifyGhostLinkStatus(ghost, {
      exists: true,
      data: () => ({
        digimonInstanceId: "life-a",
        combatRevision: 2,
        selectedDigimon: "Greymon",
        digimonStats: { isDead: false },
      }),
    }),
    "linked"
  );
  assert.equal(
    classifyGhostLinkStatus(ghost, {
      exists: true,
      data: () => ({
        digimonInstanceId: "life-a",
        combatRevision: 3,
        selectedDigimon: "MetalGreymon",
        digimonStats: { isDead: false },
      }),
    }),
    "evolved"
  );
});

test("상대 DTO는 source identity와 내부 pending 정보를 노출하지 않는다", () => {
  const dto = buildOpponentGhostDto(
    {
      ghostId: "ghost-a",
      ownerUid: "owner-a",
      status: "active",
      sourceSlotId: "slot1",
      sourceDigimonInstanceId: "life-a",
      sourceCombatRevision: 2,
      pendingMirrorCount: 1,
      snapshot: {
        digimonId: "Greymon",
        digimonName: "그레이몬",
        combatPowerAtCapture: 100,
      },
      ownDefenseRecord: { wins: 1, losses: 2 },
    },
    "테이머"
  );
  assert.equal(dto.sourceSlotId, undefined);
  assert.equal(dto.sourceDigimonInstanceId, undefined);
  assert.equal(dto.pendingMirrorCount, undefined);
  assert.equal(dto.ownerDisplayName, "테이머");
});
