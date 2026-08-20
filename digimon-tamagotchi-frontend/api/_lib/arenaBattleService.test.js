"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applySeasonDelta,
  normalizeBattleRequest,
  normalizeSeasonRecord,
  raiseDefenderProjectionFailure,
  resolveDefenderProjection,
  updateSlotAfterArenaBattle,
} = require("./arenaBattleService");

test("새 배틀 계약은 결과 조작 필드를 거부한다", () => {
  assert.throws(
    () => normalizeBattleRequest({
      requestId: "request-1",
      attackerSlotId: "1",
      defenderGhostId: "ghost_other",
      win: true,
    }),
    (error) => error.code === "ARENA_INVALID_REQUEST" && error.details.fields.includes("win")
  );
});

test("시즌 전적 합계 불변식을 attack/defense/legacy 필드에서 다시 계산한다", () => {
  const next = applySeasonDelta(
    { attackWins: 2, defenseWins: 3, legacyUnclassifiedWins: 4, wins: 100 },
    { seasonId: 7, ownerUid: "uid-a" },
    { attackWins: 1 },
    new Date("2026-07-19T00:00:00.000Z")
  );
  assert.equal(next.wins, 10);
  assert.equal(next.attackWins, 3);
  assert.deepEqual(
    normalizeSeasonRecord(next, { seasonId: 7, ownerUid: "uid-a" }).losses,
    0
  );
});

test("서버 슬롯 outcome은 비용과 전적, bounded battleId 로그를 한 번 조립한다", () => {
  const result = updateSlotAfterArenaBattle({
    slot: { persistenceRevision: 9 },
    projectedStats: { weight: 10, energy: 2, battles: 1, battlesWon: 1, battleLogs: [] },
    attackerWon: false,
    battleId: "battle_one",
    opponentName: "그레이몬",
    now: new Date("2026-07-19T00:00:00.000Z"),
  });
  assert.equal(result.persistenceRevision, 10);
  assert.equal(result.digimonStats.weight, 6);
  assert.equal(result.digimonStats.energy, 1);
  assert.equal(result.digimonStats.battlesLost, 1);
  assert.equal(result.digimonStats.battleLogs[0].battleId, "battle_one");
});

test("방어 원본의 event-time identity 연결 상태를 분류한다", () => {
  const ghost = {
    sourceCombatIdentityId: "identity",
    sourceDigimonInstanceId: "life-1",
    sourceCombatRevision: 2,
    snapshot: { digimonId: "Greymon" },
  };
  const linked = resolveDefenderProjection({
    ghost,
    sourceSnapshot: { exists: true, data: () => ({
      digimonInstanceId: "life-1", combatRevision: 2, selectedDigimon: "Greymon",
    }) },
    requestReceivedAt: new Date(),
    projectSource: () => ({
      status: "resolved",
      linked: true,
      linkStatus: "linked",
      targetCombatIdentityId: "identity",
    }),
  });
  assert.equal(linked.linked, true);
  assert.equal(linked.targetCombatIdentityId, "identity");
});

test("새 생애 원본은 runtime projection 없이 dead 연결 종료로 분류한다", () => {
  let projectionCalls = 0;
  const result = resolveDefenderProjection({
    ghost: {
      sourceCombatIdentityId: "identity",
      sourceDigimonInstanceId: "life-1",
      sourceCombatRevision: 2,
      snapshot: { digimonId: "Bakemon" },
    },
    sourceSnapshot: { exists: true, data: () => ({
      digimonInstanceId: "life-2",
      combatRevision: 1,
      selectedDigimon: "Poyomon",
      digimonStats: { isDead: false },
    }) },
    requestReceivedAt: new Date(),
    projectSource: () => {
      projectionCalls += 1;
      throw new Error("호출되면 안 됩니다.");
    },
  });
  assert.deepEqual(result, { status: "resolved", linked: false, linkStatus: "dead" });
  assert.equal(projectionCalls, 0);
});

test("이전 형태 원본은 runtime projection 없이 evolved 연결 종료로 분류한다", () => {
  let projectionCalls = 0;
  const result = resolveDefenderProjection({
    ghost: {
      sourceCombatIdentityId: "identity",
      sourceDigimonInstanceId: "life-1",
      sourceCombatRevision: 2,
      snapshot: { digimonId: "Greymon" },
    },
    sourceSnapshot: { exists: true, data: () => ({
      digimonInstanceId: "life-1",
      combatRevision: 3,
      selectedDigimon: "MetalGreymon",
      digimonStats: { isDead: false },
    }) },
    requestReceivedAt: new Date(),
    projectSource: () => {
      projectionCalls += 1;
      throw new Error("호출되면 안 됩니다.");
    },
  });
  assert.deepEqual(result, { status: "resolved", linked: false, linkStatus: "evolved" });
  assert.equal(projectionCalls, 0);
});

test("동일 identity에서 형태만 다르면 손상 상태로 차단한다", () => {
  const result = resolveDefenderProjection({
    ghost: {
      sourceCombatIdentityId: "identity",
      sourceDigimonInstanceId: "life-1",
      sourceCombatRevision: 2,
      snapshot: { digimonId: "Greymon" },
    },
    sourceSnapshot: { exists: true, data: () => ({
      digimonInstanceId: "life-1",
      combatRevision: 2,
      selectedDigimon: "MetalGreymon",
      digimonStats: { isDead: false },
    }) },
    requestReceivedAt: new Date(),
  });
  assert.deepEqual(result, {
    status: "terminal_error",
    linked: false,
    code: "ARENA_COMBAT_IDENTITY_STALE",
    phase: "identity",
  });
});

test("exact identity projection 불가는 retryable 503과 구조화 로그를 남긴다", () => {
  const warnings = [];
  assert.throws(
    () => raiseDefenderProjectionFailure({
      projection: {
        status: "terminal_error",
        code: "ARENA_SLOT_PROJECTION_UNAVAILABLE",
        phase: "projection",
      },
      logger: { warn: (...args) => warnings.push(args) },
      battleId: "battle-safe",
      ghost: {
        ghostId: "ghost-safe",
        ownerUid: "로그에 포함되면 안 됨",
        schemaVersion: 2,
        snapshotVersion: 2,
      },
    }),
    (error) =>
      error.code === "ARENA_SOURCE_READ_UNAVAILABLE" &&
      error.status === 503 &&
      error.retryable === true
  );
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "[arena-battle] defender-source-validation-failed");
  assert.deepEqual(warnings[0][1], {
    battleId: "battle-safe",
    ghostId: "ghost-safe",
    phase: "projection",
    errorCode: "ARENA_SLOT_PROJECTION_UNAVAILABLE",
    projectionVersion: 1,
    ghostSchemaVersion: 2,
    snapshotVersion: 2,
  });
  assert.equal(JSON.stringify(warnings).includes("로그에 포함되면 안 됨"), false);
});
