"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  aggregateCurrentSeason,
  buildLegacyGhostPlan,
  buildSeasonRecordPatch,
  parseArgs,
  summarizeLegacyReferences,
  validateExecutionOptions,
} = require("../scripts/migrateArenaGhosts");

function legacyEntry(id, overrides = {}) {
  return {
    id,
    data: {
      userId: "owner-1",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      digimonSnapshot: {
        digimonId: "Agumon",
        digimonName: "아구몬",
        slotVersion: "Ver.1",
        stage: "Child",
        sprite: 240,
        attackSprite: 4,
        stats: { power: 40, type: "Vaccine", age: 3, weight: 20 },
      },
      record: { wins: 10, losses: 4, seasonWins: 3, seasonLosses: 1, seasonId: 12 },
      ...overrides,
    },
  };
}

test("legacy entry ID와 승패 원형을 그대로 Ghost에 보존하고 identity를 연결하지 않는다", () => {
  const plan = buildLegacyGhostPlan(legacyEntry("oldEntry20CharId"), new Date("2026-07-22T00:00:00.000Z"));
  assert.equal(plan.ghostId, "oldEntry20CharId");
  assert.equal(plan.status, "active");
  assert.equal(plan.ghost.sourceCombatIdentityId, null);
  assert.deepEqual(plan.ghost.formRecordMirror, {
    attackWins: 0, attackLosses: 0, defenseWins: 0, defenseLosses: 0,
  });
  assert.deepEqual(plan.ghost.legacyRecord, {
    wins: 10, losses: 4, seasonWins: 3, seasonLosses: 1, seasonId: 12,
    breakdownKnown: false,
  });
});

test("불완전하거나 지원하지 않는 snapshot은 삭제하지 않고 disabled 계획으로 만든다", () => {
  const plan = buildLegacyGhostPlan(legacyEntry("broken-entry", {
    digimonSnapshot: { digimonName: "알 수 없음" },
  }));
  assert.equal(plan.canCreate, true);
  assert.equal(plan.status, "disabled");
  assert.ok(plan.anomalies.includes("unsupported_master_data"));
});

test("현재 시즌 합계는 attack/defense를 추측하지 않고 legacy unclassified로만 모은다", () => {
  const aggregates = aggregateCurrentSeason([
    legacyEntry("entry-a"),
    legacyEntry("entry-b", { record: { seasonWins: 2, seasonLosses: 5, seasonId: 12 } }),
    legacyEntry("old-season", { record: { seasonWins: 99, seasonLosses: 99, seasonId: 11 } }),
  ], 12);
  assert.deepEqual(aggregates, [{
    ownerUid: "owner-1",
    seasonId: 12,
    legacyUnclassifiedWins: 5,
    legacyUnclassifiedLosses: 6,
    sourceEntryCount: 2,
    sourceEntryIds: ["entry-a", "entry-b"],
  }]);
  const record = buildSeasonRecordPatch({ attackWins: 4, defenseLosses: 2 }, aggregates[0], new Date());
  assert.equal(record.wins, 9);
  assert.equal(record.losses, 8);
  assert.equal(record.attackLosses, 0);
  assert.equal(record.defenseWins, 0);
});

test("과거 배틀 로그의 old entry 참조 보존 가능 여부를 집계한다", () => {
  const summary = summarizeLegacyReferences([
    { data: { myEntryId: "entry-a", defenderEntryId: "missing" } },
  ], new Set(["entry-a"]));
  assert.deepEqual(summary, {
    referenceCount: 2,
    resolvableReferenceCount: 1,
    missingEntryIds: ["missing"],
  });
});

test("apply는 명시한 project·확인 project·자격증명 없이는 시작하지 않는다", () => {
  const dryRun = parseArgs(["--project", "preview-project", "--dry-run"]);
  assert.equal(dryRun.apply, false);
  assert.equal(validateExecutionOptions(dryRun), "application-default");
  const unsafeApply = parseArgs(["--project", "preview-project", "--apply"]);
  assert.throws(() => validateExecutionOptions(unsafeApply), /confirm-project/);
});
