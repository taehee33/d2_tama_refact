"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanupReadyArchiveJobs, projectFrozenEvidenceV1 } = require("./arenaJobs");

test("mirror V1 projector는 frozen 배틀 시점 identity만으로 연결을 판정한다", () => {
  const battleOccurredAt = new Date("2026-07-19T01:00:00.000Z");
  const baseJob = {
    battleOccurredAt,
    projectionEvidenceAtBattle: {
      projectionInput: {
        expectedDigimonInstanceId: "life-1",
        expectedCombatRevision: 2,
        expectedDigimonId: "Greymon",
        slot: {
          arenaIdentitySchemaVersion: 1,
          digimonInstanceId: "life-1",
          combatRevision: 2,
          selectedDigimon: "Greymon",
          version: "Ver.1",
          lastSavedAt: battleOccurredAt.getTime(),
          digimonStats: {
            isDead: false,
            birthTime: battleOccurredAt.getTime(),
            lifespanSeconds: 0,
            timeToEvolveSeconds: 999999,
            hungerTimer: 60,
            hungerCountdown: 3600,
            fullness: 5,
            strengthTimer: 60,
            strengthCountdown: 3600,
            strength: 5,
            effort: 2,
            poopTimer: 120,
            poopCountdown: 7200,
            poopCount: 0,
            weight: 20,
            maxEnergy: 20,
            energy: 10,
            sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
            callStatus: {
              hunger: { isActive: false, startedAt: null, isLogged: false },
              strength: { isActive: false, startedAt: null, isLogged: false },
              sleep: { isActive: false, startedAt: null, isLogged: false },
            },
            activityLogs: [],
            battleLogs: [],
          },
        },
      },
    },
  };
  assert.equal(projectFrozenEvidenceV1(baseJob).status, "linked");
  assert.equal(projectFrozenEvidenceV1({
    ...baseJob,
    projectionEvidenceAtBattle: {
      projectionInput: {
        ...baseJob.projectionEvidenceAtBattle.projectionInput,
        expectedCombatRevision: 1,
      },
    },
  }).status, "not_linked");
});

test("보존된 frozen input이 없으면 mirror job을 확정하지 않는다", () => {
  assert.deepEqual(projectFrozenEvidenceV1({ projectionEvidenceAtBattle: {} }), {
    status: "deferred",
    code: "SUPPORTED_SCHEMA_REPAIR_PENDING",
  });
});

test("archive cleanup은 보존 기한이 지난 ready 작업만 삭제한다", async () => {
  const deleted = [];
  const documents = [
    { ref: { path: "arena_archive_outbox/ready" }, data: () => ({ status: "ready" }) },
    { ref: { path: "arena_archive_outbox/failed" }, data: () => ({ status: "failed" }) },
  ];
  const query = {
    where(field, operator, value) {
      assert.equal(field, "purgeAfter");
      assert.equal(operator, "<=");
      assert.equal(value.toISOString(), "2026-07-22T00:00:00.000Z");
      return this;
    },
    orderBy(field, direction) {
      assert.equal(field, "purgeAfter");
      assert.equal(direction, "asc");
      return this;
    },
    limit(value) {
      assert.equal(value, 50);
      return this;
    },
    async get() {
      return { docs: documents };
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "arena_archive_outbox");
      return query;
    },
    batch() {
      return {
        delete(ref) { deleted.push(ref.path); },
        async commit() {},
      };
    },
  };

  const result = await cleanupReadyArchiveJobs({
    db,
    now: new Date("2026-07-22T00:00:00.000Z"),
  });

  assert.deepEqual(result, { selected: 2, deleted: 1 });
  assert.deepEqual(deleted, ["arena_archive_outbox/ready"]);
});
