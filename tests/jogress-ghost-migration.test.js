"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRoomPlan,
  parseArgs,
  planMigration,
  validateOptions,
} = require("../scripts/migrateJogressRoomsToGhostV3");

const now = new Date("2026-08-04T00:00:00.000Z");

function room(id, overrides = {}) {
  return {
    id,
    data: {
      hostUid: "owner",
      hostSlotId: 1,
      hostDigimonId: "BanchoLeomon",
      hostSlotVersion: "Ver.3",
      status: "waiting",
      createdAt: new Date(`2026-08-0${id.slice(-1)}T00:00:00.000Z`),
      ...overrides,
    },
  };
}

test("identity 없는 waiting은 현재 슬롯과 무관한 legacyGhost가 된다", () => {
  const plan = buildRoomPlan("legacy-1", room("legacy-1").data, now);
  assert.equal(plan.active, true);
  assert.equal(plan.patch.status, "waiting");
  assert.equal(plan.patch.snapshotKind, "legacyGhost");
  assert.equal(plan.patch.linkStatus, "ghost");
  assert.equal(plan.patch.hostSnapshot.name, "반쵸레오몬");
});

test("유효한 expired는 waiting Ghost로 복원하고 paired는 ghostFallback 완료한다", () => {
  const expired = buildRoomPlan("expired-1", room("expired-1", { status: "expired" }).data, now);
  const paired = buildRoomPlan("paired-1", room("paired-1", { status: "paired", guestUid: "guest" }).data, now);
  assert.equal(expired.category, "restored");
  assert.equal(expired.patch.status, "waiting");
  assert.equal(paired.patch.status, "completed");
  assert.equal(paired.patch.completionMode, "ghostFallback");
});

test("사용자별 활성 방은 기존 waiting 우선, 최신순 최대 3개만 유지한다", () => {
  const plans = planMigration([
    room("room-1"), room("room-2"), room("room-3"),
    room("room-4", { status: "expired", createdAt: new Date("2026-08-09T00:00:00.000Z") }),
  ], now);
  assert.deepEqual(plans.filter((plan) => plan.active).map((plan) => plan.id).sort(), ["room-1", "room-2", "room-3"]);
  assert.equal(plans.find((plan) => plan.id === "room-4").patch.migration.exclusionReason, "ROOM_LIMIT");
});

test("apply와 rollback은 project 확인 없이는 실행하지 않는다", () => {
  assert.throws(() => validateOptions(parseArgs(["--project", "prod", "--apply"])), /confirm-project/);
  assert.throws(() => validateOptions(parseArgs(["--project", "prod", "--rollback", "--confirm-project", "prod"])), /room-id/);
});
