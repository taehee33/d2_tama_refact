"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applySeasonDelta,
  normalizeBattleRequest,
  normalizeSeasonRecord,
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
