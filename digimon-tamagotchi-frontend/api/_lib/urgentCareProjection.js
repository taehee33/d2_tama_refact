"use strict";

const { applyLazyUpdate } = require("../_generated/gameProjection.cjs");

const HUNGER_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const STRENGTH_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const SLEEP_LIGHT_WARNING_TIMEOUT_MS = 30 * 60 * 1000;
const RECENTLY_EXPIRED_CALL_GRACE_MS = 15 * 60 * 1000;
const KST_TIME_ZONE = "Asia/Seoul";

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

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampHour(value, fallback = 0) {
  const parsed = normalizeInteger(value, fallback);
  return ((parsed % 24) + 24) % 24;
}

function clampMinute(value, fallback = 0) {
  const parsed = normalizeInteger(value, fallback);
  return Math.max(0, Math.min(59, parsed));
}

function parseTimeParts(value, fallbackHour, fallbackMinute = 0) {
  if (typeof value !== "string") {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  return {
    hour: clampHour(match[1], fallbackHour),
    minute: clampMinute(match[2], fallbackMinute),
  };
}

function normalizeSleepScheduleForAlert(schedule = {}) {
  const startFromString = parseTimeParts(
    schedule.sleepStart || schedule.sleepTime || schedule.startTime,
    22,
    0
  );
  const endFromString = parseTimeParts(
    schedule.wakeUp || schedule.wakeTime || schedule.endTime,
    6,
    0
  );

  return {
    start: clampHour(schedule.start, startFromString.hour),
    startMinute: clampMinute(schedule.startMinute, startFromString.minute),
    end: clampHour(schedule.end, endFromString.hour),
    endMinute: clampMinute(schedule.endMinute, endFromString.minute),
  };
}

function getKstMinutesOfDay(nowMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const values = parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = Number(part.value);
    }
    return accumulator;
  }, {});
  const hour = values.hour === 24 ? 0 : values.hour;
  return clampHour(hour, 0) * 60 + clampMinute(values.minute, 0);
}

function getKstDateParts(nowMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  return parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = Number(part.value);
    }
    return accumulator;
  }, {});
}

function kstWallTimeToUtcMs(dateParts, hour, minute, dayOffset = 0) {
  return Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day) + dayOffset,
    clampHour(hour, 0) - 9,
    clampMinute(minute, 0),
    0,
    0
  );
}

function isWithinSleepScheduleKst(schedule, nowMs) {
  const normalized = normalizeSleepScheduleForAlert(schedule);
  const currentMinutes = getKstMinutesOfDay(nowMs);
  const startMinutes = normalized.start * 60 + normalized.startMinute;
  const endMinutes = normalized.end * 60 + normalized.endMinute;

  if (startMinutes === endMinutes) {
    return false;
  }
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getCurrentSleepScheduleStartMs(schedule, nowMs) {
  const normalized = normalizeSleepScheduleForAlert(schedule);
  const currentMinutes = getKstMinutesOfDay(nowMs);
  const startMinutes = normalized.start * 60 + normalized.startMinute;
  const endMinutes = normalized.end * 60 + normalized.endMinute;
  const dateParts = getKstDateParts(nowMs);

  if (startMinutes === endMinutes) {
    return null;
  }

  if (startMinutes < endMinutes) {
    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      return null;
    }
    return kstWallTimeToUtcMs(dateParts, normalized.start, normalized.startMinute);
  }

  if (currentMinutes >= startMinutes) {
    return kstWallTimeToUtcMs(dateParts, normalized.start, normalized.startMinute);
  }
  if (currentMinutes < endMinutes) {
    return kstWallTimeToUtcMs(dateParts, normalized.start, normalized.startMinute, -1);
  }
  return null;
}

function formatKstTime(nowMs) {
  if (!Number.isFinite(Number(nowMs))) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Number(nowMs)));
}

function formatRemainingMs(remainingMs) {
  const safeMs = Math.max(0, Number(remainingMs) || 0);
  const totalMinutes = Math.ceil(safeMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function buildIssueTiming({
  startedAt,
  deadlineAt,
  nowMs,
}) {
  const safeStartedAt = toTimestamp(startedAt);
  const safeDeadlineAt = toTimestamp(deadlineAt);
  const remainingMs =
    safeDeadlineAt != null ? Math.max(0, safeDeadlineAt - nowMs) : null;
  const detailLines = [];

  if (safeStartedAt != null) {
    detailLines.push(`시작: ${formatKstTime(safeStartedAt)}`);
  }
  if (safeDeadlineAt != null) {
    detailLines.push(
      safeDeadlineAt > nowMs
        ? `케어미스 예정: ${formatKstTime(safeDeadlineAt)}`
        : "케어미스 발생 구간"
    );
    if (safeDeadlineAt > nowMs) {
      detailLines.push(`남은 시간: ${formatRemainingMs(safeDeadlineAt - nowMs)}`);
    }
  }

  return {
    startedAt: safeStartedAt,
    deadlineAt: safeDeadlineAt,
    remainingMs,
    detailLines,
  };
}

function isActiveOrRecentlyExpired(deadlineAt, nowMs) {
  const safeDeadlineAt = toTimestamp(deadlineAt);
  if (safeDeadlineAt == null) return false;
  return safeDeadlineAt > nowMs ||
    safeDeadlineAt >= nowMs - RECENTLY_EXPIRED_CALL_GRACE_MS;
}

function buildTimedIssueKey(key, deadlineAt) {
  const safeDeadlineAt = toTimestamp(deadlineAt);
  return safeDeadlineAt != null ? `${key}:${safeDeadlineAt}` : key;
}

function resolveNeedCallIssue({
  key,
  label,
  statValue,
  projectedCall = {},
  storedCall = {},
  projectedDeadline,
  storedDeadline,
  projectedStartedAt,
  storedStartedAt,
  timeoutMs,
  projectedStats,
  slotData,
  nowMs,
}) {
  if (Number(statValue) !== 0) return null;
  const startedAt = toTimestamp(projectedStartedAt) ??
    toTimestamp(storedStartedAt);
  const deadlineAt = toTimestamp(projectedDeadline) ??
    toTimestamp(storedDeadline) ??
    (startedAt != null ? startedAt + timeoutMs : null);
  const isProjectedActive = projectedCall?.isActive === true &&
    projectedCall?.isLogged !== true;
  const isStoredUnlogged = storedCall?.isLogged !== true;
  const isStoredActiveOrRecentlyExpired = storedCall?.isActive === true &&
    isStoredUnlogged &&
    isActiveOrRecentlyExpired(deadlineAt, nowMs);

  if (
    startedAt == null ||
    deadlineAt == null ||
    (!isProjectedActive && !isStoredActiveOrRecentlyExpired) ||
    !isActiveOrRecentlyExpired(deadlineAt, nowMs) ||
    isNeedCallPausedBySleep(
      isProjectedActive ? projectedCall : storedCall,
      projectedStats,
      slotData,
      nowMs
    )
  ) {
    return null;
  }

  return {
    key,
    dedupKey: buildTimedIssueKey(key, deadlineAt),
    label,
    ...buildIssueTiming({ startedAt, deadlineAt, nowMs }),
  };
}

function isActiveScheduledSleepLightWarning(projectedStats = {}, slotData = {}, nowMs = Date.now()) {
  if (projectedStats.isLightsOn === false || slotData.isLightsOn === false) return false;
  const wakeUntil = toTimestamp(projectedStats.wakeUntil ?? slotData.wakeUntil);
  if (wakeUntil != null && wakeUntil > nowMs) return false;
  const napUntil = toTimestamp(projectedStats.napUntil ?? slotData?.digimonStats?.napUntil);
  if (napUntil != null && napUntil > nowMs) return false;
  const sleepSchedule = projectedStats.sleepSchedule || slotData?.digimonStats?.sleepSchedule;
  return isWithinSleepScheduleKst(sleepSchedule, nowMs);
}

function resolveSleepLightIssueTiming(projectedStats = {}, slotData = {}, nowMs = Date.now()) {
  const sleepSchedule = projectedStats.sleepSchedule || slotData?.digimonStats?.sleepSchedule;
  const callEntry = projectedStats.callStatus?.sleep || {};
  const startedAt = toTimestamp(callEntry.startedAt) ??
    toTimestamp(projectedStats.sleepLightOnStart) ??
    getCurrentSleepScheduleStartMs(sleepSchedule, nowMs);
  const deadlineAt =
    startedAt != null ? startedAt + SLEEP_LIGHT_WARNING_TIMEOUT_MS : null;

  if (startedAt == null || deadlineAt == null || deadlineAt <= nowMs) {
    return null;
  }

  return buildIssueTiming({ startedAt, deadlineAt, nowMs });
}

function isCurrentSleepOrNap(projectedStats = {}, slotData = {}, nowMs = Date.now()) {
  const wakeUntil = toTimestamp(projectedStats.wakeUntil ?? slotData.wakeUntil);
  if (wakeUntil != null && wakeUntil > nowMs) return false;

  const napUntil = toTimestamp(projectedStats.napUntil ?? slotData?.digimonStats?.napUntil);
  if (napUntil != null && napUntil > nowMs) return true;

  const sleepSchedule = projectedStats.sleepSchedule || slotData?.digimonStats?.sleepSchedule;
  return isWithinSleepScheduleKst(sleepSchedule, nowMs);
}

function isNeedCallPausedBySleep(callEntry = {}, projectedStats = {}, slotData = {}, nowMs = Date.now()) {
  return isCurrentSleepOrNap(projectedStats, slotData, nowMs);
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
  const storedStats = slotData?.digimonStats;
  if (
    storedStats &&
    typeof storedStats === "object" &&
    (storedStats.isDead === true || slotData.isDead === true)
  ) {
    // 사망은 terminal state이므로 추가 시간 투영이 필요 없다. 구형 슬롯에
    // sleepSchedule 같은 runtime 필드가 없어도 저장된 사망 판정은 전달한다.
    return {
      status: "projected",
      stats: {
        ...storedStats,
        isDead: true,
        diedAt: storedStats.diedAt ?? slotData.diedAt ?? null,
        deathReason: storedStats.deathReason ?? slotData.deathReason ?? null,
      },
    };
  }
  if (!hasProjectionRuntime(slotData)) return { status: "unavailable", stats: null };
  const stats = storedStats;
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

function resolveUrgentIssues(projectedStats = {}, slotData = {}, nowMs = Date.now()) {
  if (projectedStats.isDead) return [{ key: "death", label: "💀 사망 판정" }];
  const issues = [];
  const callStatus = projectedStats.callStatus || {};
  const storedStats = slotData?.digimonStats || {};
  const storedCallStatus = storedStats.callStatus || {};
  const hungerIssue = resolveNeedCallIssue({
    key: "hunger_call",
    label: "🍖 배고픔 호출",
    statValue: projectedStats.fullness,
    projectedCall: callStatus.hunger,
    storedCall: storedCallStatus.hunger,
    projectedDeadline: projectedStats.hungerMistakeDeadline ?? callStatus.hunger?.deadline,
    storedDeadline: storedStats.hungerMistakeDeadline ?? storedCallStatus.hunger?.deadline,
    projectedStartedAt: callStatus.hunger?.startedAt ?? projectedStats.lastHungerZeroAt,
    storedStartedAt: storedCallStatus.hunger?.startedAt ?? storedStats.lastHungerZeroAt,
    timeoutMs: HUNGER_CALL_TIMEOUT_MS,
    projectedStats,
    slotData,
    nowMs,
  });
  if (hungerIssue) issues.push(hungerIssue);

  const strengthIssue = resolveNeedCallIssue({
    key: "strength_call",
    label: "🔋 기력 호출",
    statValue: projectedStats.strength,
    projectedCall: callStatus.strength,
    storedCall: storedCallStatus.strength,
    projectedDeadline: projectedStats.strengthMistakeDeadline ?? callStatus.strength?.deadline,
    storedDeadline: storedStats.strengthMistakeDeadline ?? storedCallStatus.strength?.deadline,
    projectedStartedAt: callStatus.strength?.startedAt ?? projectedStats.lastStrengthZeroAt,
    storedStartedAt: storedCallStatus.strength?.startedAt ?? storedStats.lastStrengthZeroAt,
    timeoutMs: STRENGTH_CALL_TIMEOUT_MS,
    projectedStats,
    slotData,
    nowMs,
  });
  if (strengthIssue) issues.push(strengthIssue);
  if (
    callStatus.sleep?.isLogged !== true &&
    isActiveScheduledSleepLightWarning(projectedStats, slotData, nowMs)
  ) {
    const timing = resolveSleepLightIssueTiming(projectedStats, slotData, nowMs);
    if (timing) {
      issues.push({
        key: "sleep_light",
        dedupKey: buildTimedIssueKey("sleep_light", timing.deadlineAt ?? timing.startedAt),
        label: "💡 수면 시간 조명 켜짐",
        ...timing,
      });
    }
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
  RECENTLY_EXPIRED_CALL_GRACE_MS,
  hasProjectionRuntime,
  getCurrentSleepScheduleStartMs,
  isActiveScheduledSleepLightWarning,
  isStoredInCareStorage,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
  resolveSleepLightIssueTiming,
};
