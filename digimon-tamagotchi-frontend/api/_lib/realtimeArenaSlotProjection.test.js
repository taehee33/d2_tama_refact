"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRealtimeArenaRulesSnapshot } = require("../_generated/gameProjection.cjs");
const { projectRealtimeArenaSlot } = require("./realtimeArenaSlotProjection");

test("푸니몬은 runtime 투영보다 단계 검사를 먼저 해 명확한 오류를 반환한다", () => {
  const snapshot = {
    exists: true,
    data: () => ({
      version: "Ver.2",
      selectedDigimon: "Punimon",
      digimonStats: {},
      lastSavedAt: Date.now(),
    }),
  };

  assert.throws(
    () => projectRealtimeArenaSlot(snapshot, new Date(), createRealtimeArenaRulesSnapshot()),
    (error) => error.code === "ARENA_REALTIME_STAGE_INELIGIBLE" && /성장기 이상/.test(error.message)
  );
});
