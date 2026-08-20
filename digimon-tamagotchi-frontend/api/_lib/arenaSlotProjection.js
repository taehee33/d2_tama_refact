"use strict";

const { ArenaError } = require("./arenaErrors");
const { projectSlotForUrgentCare } = require("./urgentCareProjection");
const {
  calculatePower,
  getDigimonEntryByVersion,
  isStarterDigimonId,
} = require("../_generated/gameProjection.cjs");

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveProjectionTime(requestReceivedAt, snapshot) {
  const requestMs = requestReceivedAt.getTime();
  const updateMs = toDate(snapshot?.updateTime)?.getTime() || 0;
  return new Date(Math.max(requestMs, updateMs));
}

function projectArenaSlot(slotSnapshot, requestReceivedAt, options = {}) {
  if (!slotSnapshot?.exists) throw new ArenaError("ARENA_SLOT_NOT_FOUND", "아레나에 사용할 슬롯을 찾을 수 없습니다.");
  const slot = slotSnapshot.data() || {};
  const projectionAsOf = options.projectionAsOf || resolveProjectionTime(requestReceivedAt, slotSnapshot);
  if (slot.digimonStats?.isDead === true || slot.isDead === true) {
    throw new ArenaError("ARENA_SLOT_DEAD", "사망한 디지몬은 아레나에 참가할 수 없습니다.");
  }
  if (isStarterDigimonId(slot.selectedDigimon)) throw new ArenaError("ARENA_SLOT_STARTER", "디지타마는 아레나에 참가할 수 없습니다.");
  const projection = projectSlotForUrgentCare(slot, projectionAsOf.getTime());
  if (projection.status !== "projected" || !projection.stats) {
    throw new ArenaError("ARENA_SLOT_PROJECTION_UNAVAILABLE", "현재 디지몬 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", null, null, { retryable: true });
  }
  if (projection.stats.isDead === true) throw new ArenaError("ARENA_SLOT_DEAD", "사망한 디지몬은 아레나에 참가할 수 없습니다.");
  if (options.requireCombatIdentity !== false && (
    slot.arenaIdentitySchemaVersion !== 1 ||
    typeof slot.digimonInstanceId !== "string" || !slot.digimonInstanceId.trim() ||
    !Number.isInteger(slot.combatRevision) || slot.combatRevision < 1
  )) {
    throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", "현재 슬롯의 아레나 identity를 갱신한 뒤 다시 시도해 주세요.");
  }
  const digimon = getDigimonEntryByVersion(slot.version || "Ver.1", slot.selectedDigimon);
  if (!digimon) throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", "현재 형태와 지원 데이터가 일치하지 않습니다.");
  const powerResult = calculatePower(projection.stats, digimon, true);
  return {
    slot,
    projectedStats: projection.stats,
    digimon,
    power: Number(powerResult?.power || 0),
    powerDetails: powerResult?.details || {},
    projectionAsOf,
  };
}

module.exports = { projectArenaSlot, resolveProjectionTime };
