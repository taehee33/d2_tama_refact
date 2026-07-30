"use strict";

const { ArenaError } = require("./arenaErrors");
const { projectArenaSlot } = require("./arenaSlotProjection");
const { getDigimonEntryByVersion } = require("../_generated/gameProjection.cjs");

function assertEligibleStage(digimon, rules) {
  if (!digimon) {
    throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", "현재 형태와 지원 데이터가 일치하지 않습니다.");
  }
  if (!rules.eligibleStages.includes(digimon.stage)) {
    throw new ArenaError(
      "ARENA_REALTIME_STAGE_INELIGIBLE",
      "성장기 이상의 디지몬만 실시간 배틀에 참가할 수 있습니다."
    );
  }
}

function projectRealtimeArenaSlot(slotSnapshot, requestReceivedAt, rules, options = {}, deps = {}) {
  if (deps.projectSlot) {
    const projected = deps.projectSlot(slotSnapshot, requestReceivedAt, options);
    assertEligibleStage(projected?.digimon, rules);
    return projected;
  }

  if (slotSnapshot?.exists) {
    const slot = slotSnapshot.data() || {};
    const digimon = getDigimonEntryByVersion(slot.version || "Ver.1", slot.selectedDigimon);
    assertEligibleStage(digimon, rules);
  }

  return projectArenaSlot(slotSnapshot, requestReceivedAt, options);
}

module.exports = { assertEligibleStage, projectRealtimeArenaSlot };
