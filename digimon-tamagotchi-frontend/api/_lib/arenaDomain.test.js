"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyRecordDelta,
  assertArenaClientSchemaVersion,
  buildGhostSnapshot,
  createCanonicalRequestHash,
  createCombatIdentityId,
  createRegistrationKey,
  normalizeGhostId,
} = require("./arenaDomain");

test("combat identity는 owner, instance, revision을 모두 구분한다", () => {
  const base = { ownerUid: "owner-a", digimonInstanceId: "life-a", combatRevision: 1 };
  const identity = createCombatIdentityId(base);
  assert.equal(identity, createCombatIdentityId(base));
  assert.notEqual(identity, createCombatIdentityId({ ...base, combatRevision: 2 }));
  assert.notEqual(identity, createCombatIdentityId({ ...base, digimonInstanceId: "life-b" }));
  assert.notEqual(identity, createCombatIdentityId({ ...base, ownerUid: "owner-b" }));
});

test("legacy Ghost ID는 접두사 없이도 허용하되 경로 구분자는 거부한다", () => {
  assert.equal(normalizeGhostId("oldEntry20CharId"), "oldEntry20CharId");
  assert.throws(() => normalizeGhostId("owner/entry"), (error) => error.code === "ARENA_INVALID_REQUEST");
});

test("registration key는 같은 combat identity에서 결정적이다", () => {
  const input = { ownerUid: "owner-a", combatIdentityId: "identity-a" };
  assert.equal(createRegistrationKey(input), createRegistrationKey(input));
});

test("request hash는 object key 순서와 무관하다", () => {
  assert.equal(
    createCanonicalRequestHash({ requestId: "r1", body: { b: 2, a: 1 } }),
    createCanonicalRequestHash({ body: { a: 1, b: 2 }, requestId: "r1" })
  );
});

test("Arena API minimum schema gate는 구 client를 426으로 거부한다", () => {
  assert.equal(assertArenaClientSchemaVersion({ requestVersion: 2, minimumVersion: 2 }), 2);
  assert.throws(
    () => assertArenaClientSchemaVersion({ requestVersion: 1, minimumVersion: 2 }),
    (error) => error.code === "ARENA_CLIENT_UPGRADE_REQUIRED" && error.status === 426
  );
});

test("전적 delta는 참가자 관점의 명시적 필드만 누적한다", () => {
  assert.deepEqual(
    applyRecordDelta(
      { attackWins: 2, attackLosses: 1, defenseWins: 0, defenseLosses: 3 },
      { attackWins: 1 }
    ),
    { attackWins: 3, attackLosses: 1, defenseWins: 0, defenseLosses: 3 }
  );
});

test("Ghost snapshot은 allowlist만 반환한다", () => {
  const snapshot = buildGhostSnapshot({
    slot: {
      version: "Ver.2",
      selectedDigimon: "angewomon",
      digimonStats: { age: 17, weight: 74, secret: "drop" },
    },
    digimon: {
      id: "angewomon",
      name: "엔젤우몬",
      stage: "Perfect",
      spriteBasePath: "/Ver2_Mod_Kor",
      sprite: 123,
      stats: { type: "Vaccine", attackSprite: 130 },
    },
    combatPowerAtCapture: 105,
    capturedAt: new Date("2026-07-18T00:00:00.000Z"),
  });

  assert.equal(snapshot.combatPowerAtCapture, 105);
  assert.equal(snapshot.secret, undefined);
  assert.equal(snapshot.stats, undefined);
  assert.equal(snapshot.digimonName, "엔젤우몬");
});
