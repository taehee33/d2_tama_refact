"use strict";

const {
  isStarterDigimonId,
} = require("../_generated/gameProjection.cjs");

/**
 * Ghost가 가리키는 원본 슬롯의 저장 상태만으로 연결 여부를 먼저 분류합니다.
 * exact identity인 경우에만 호출자가 시간 기반 projection을 수행해야 합니다.
 */
function classifyGhostSourceLink(ghost = {}, sourceSlotSnapshot = null) {
  if (
    !ghost.sourceCombatIdentityId ||
    !ghost.sourceDigimonInstanceId ||
    !Number.isInteger(ghost.sourceCombatRevision)
  ) {
    return { status: "legacy", linked: false };
  }
  if (!sourceSlotSnapshot) return { status: "source_missing", linked: false };
  if (!sourceSlotSnapshot.exists) return { status: "source_missing", linked: false };

  const source = sourceSlotSnapshot.data() || {};
  if (source.digimonStats?.isDead === true || source.isDead === true) {
    return { status: "dead", linked: false };
  }
  if (source.digimonInstanceId !== ghost.sourceDigimonInstanceId) {
    return { status: "dead", linked: false };
  }
  if (source.combatRevision !== ghost.sourceCombatRevision) {
    return { status: "evolved", linked: false };
  }
  if (source.selectedDigimon !== ghost.snapshot?.digimonId) {
    return {
      status: "terminal_error",
      linked: false,
      code: "ARENA_COMBAT_IDENTITY_STALE",
      phase: "identity",
    };
  }
  if (isStarterDigimonId(source.selectedDigimon)) {
    return { status: "starter", linked: false };
  }
  return { status: "needs_projection", linked: null };
}

function toGhostLinkStatus(classification) {
  if (classification?.status === "needs_projection") return "linked";
  if (classification?.status === "terminal_error") return "unknown";
  return classification?.status || "unknown";
}

module.exports = {
  classifyGhostSourceLink,
  toGhostLinkStatus,
};
