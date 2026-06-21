"use strict";

const { applyLazyUpdate } = require("../_generated/gameProjection.cjs");

function toTimestamp(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(Number(value?.seconds))) {
    return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function hasProjectionRuntime(slotData = {}) {
  const stats = slotData?.digimonStats;
  if (!stats || typeof stats !== "object") return false;
  return (
    Number.isFinite(Number(stats.hungerTimer)) &&
    Number.isFinite(Number(stats.strengthTimer)) &&
    Number.isFinite(Number(stats.poopTimer)) &&
    Number.isFinite(Number(stats.maxEnergy)) &&
    stats.sleepSchedule &&
    typeof stats.sleepSchedule === "object" &&
    toTimestamp(slotData.lastSavedAt ?? stats.lastSavedAt ?? slotData.lastSavedAtServer) != null
  );
}

function projectSlotForUrgentCare(slotData = {}, nowMs = Date.now()) {
  if (!hasProjectionRuntime(slotData)) return { status: "unavailable", stats: null };
  const stats = slotData.digimonStats;
  const lastSavedAt = toTimestamp(
    slotData.lastSavedAt ?? stats.lastSavedAt ?? slotData.lastSavedAtServer
  );
  return {
    status: "projected",
    stats: applyLazyUpdate(
      {
        ...stats,
        isLightsOn: slotData.isLightsOn ?? stats.isLightsOn ?? true,
        wakeUntil: toTimestamp(slotData.wakeUntil ?? stats.wakeUntil),
      },
      lastSavedAt,
      stats.sleepSchedule,
      Number(stats.maxEnergy),
      { nowMs }
    ),
  };
}

function resolveUrgentIssues(projectedStats = {}, slotData = {}) {
  if (projectedStats.isDead) return [{ key: "death", label: "💀 사망 판정" }];
  const issues = [];
  const callStatus = projectedStats.callStatus || {};
  if (callStatus.hunger?.isActive) issues.push({ key: "hunger_call", label: "🍖 배고픔 호출" });
  if (callStatus.strength?.isActive) issues.push({ key: "strength_call", label: "🔋 기력 호출" });
  if (callStatus.sleep?.isActive && slotData.isLightsOn !== false) {
    issues.push({ key: "sleep_light", label: "💡 수면 시간 조명 켜짐" });
  }
  const poopCount = Number(projectedStats.poopCount) || 0;
  if (poopCount >= 8) {
    issues.push({ key: "poop_danger", label: "💩 똥 8개 위험" });
  } else if (poopCount >= 6) {
    issues.push({ key: "poop_warning", label: `💩 똥 ${poopCount}개 경고` });
  }
  if (projectedStats.isInjured) issues.push({ key: "injury", label: "🏥 치료가 필요한 부상" });
  return issues;
}

function isStoredInCareStorage(slotData = {}) {
  const stats = slotData?.digimonStats || {};
  return slotData.isFrozen === true || slotData.isRefrigerated === true ||
    stats.isFrozen === true || stats.isRefrigerated === true;
}

module.exports = {
  hasProjectionRuntime,
  isStoredInCareStorage,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
};
