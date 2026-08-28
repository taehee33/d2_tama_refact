"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSlotAudit,
  parseArgs,
} = require("../scripts/auditCareMistakeReconciliation");

function fakeDoc(id, data) {
  return { id, data: () => data };
}

test("읽기 전용 인자를 파싱한다", () => {
  assert.deepEqual(parseArgs([
    "--project", "project-1",
    "--uid", "user-1",
    "--slots", "4,5",
  ]), {
    projectId: "project-1",
    uid: "user-1",
    slotIds: ["4", "5"],
    reportPath: null,
  });
});

test("슬롯 5의 호출 케어미스 2건을 저장된 0보다 독립적으로 보고한다", () => {
  const identity = {
    slotInstanceId: "slot-life-5",
    digimonInstanceId: "digimon-life-5",
    evolutionStageInstanceId: "stage-life-5",
  };
  const report = buildSlotAudit({
    slotId: "5",
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
      digimonStats: { careMistakes: 0 },
    },
    logDocs: [
      fakeDoc("log-1", { ...identity, eventId: "care-1", type: "CAREMISTAKE", timestamp: 200 }),
      fakeDoc("log-2", { ...identity, eventId: "care-2", type: "CAREMISTAKE", timestamp: 201 }),
    ],
    incidentDocs: [],
  });

  assert.equal(report.storedProjection.rootCareMistakes, 0);
  assert.equal(report.evidence.occurrenceCount, 2);
  assert.equal(report.evidence.projectedFromActivityLogs, 2);
  assert.equal(report.recommendedStatus, "verified");
});

test("다른 stage 로그는 현재 복구 근거에서 제외한다", () => {
  const identity = {
    slotInstanceId: "slot-life-4",
    digimonInstanceId: "digimon-life-4",
    evolutionStageInstanceId: "stage-current",
  };
  const report = buildSlotAudit({
    slotId: "4",
    slotData: { ...identity, evolutionStageStartedAt: 100 },
    logDocs: [
      fakeDoc("current", { ...identity, type: "CAREMISTAKE", timestamp: 200 }),
      fakeDoc("old-stage", {
        ...identity,
        evolutionStageInstanceId: "stage-old",
        type: "CAREMISTAKE",
        timestamp: 201,
      }),
    ],
    incidentDocs: [],
  });

  assert.equal(report.evidence.occurrenceCount, 1);
});

test("구 슬롯은 생애·단계 시작·단계명으로 stage identity를 안전하게 복구한다", () => {
  const report = buildSlotAudit({
    slotId: "4",
    slotData: {
      slotInstanceId: "slot-life-4",
      digimonInstanceId: "digimon-life-4",
      digimonStats: {
        evolutionStage: "Child",
        evolutionStageStartedAt: 100,
      },
    },
    logDocs: [],
    incidentDocs: [],
  });

  assert.equal(
    report.identity.evolutionStageInstanceId,
    "stage:digimon-life-4:Child:100"
  );
  assert.equal(report.audit.hasCompleteIdentity, true);
  assert.equal(report.recommendedStatus, "verified");
});
