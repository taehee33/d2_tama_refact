import {
  getMostRecentWakeDate,
  isTimeWithinSleepSchedule,
  normalizeSleepSchedule,
} from "../../utils/sleepUtils";
import { toTimestamp } from "../../utils/fridgeTime";

const FALLING_ASLEEP_DELAY_MS = 15 * 1000;
const NAP_DURATION_MS = 3 * 60 * 60 * 1000;

export function isSleepLikeStatus(status) {
  return (
    status === "NAPPING" ||
    status === "SLEEPING" ||
    status === "SLEEPING_LIGHT_ON"
  );
}

export function getEnergyRecoverySleepStatus(stats = {}, sleepSchedule, timestampMs) {
  const wakeUntilMs = toTimestamp(stats.wakeUntil);
  if (wakeUntilMs != null && wakeUntilMs > timestampMs) {
    return "AWAKE_INTERRUPTED";
  }

  const normalizedSchedule = sleepSchedule ? normalizeSleepSchedule(sleepSchedule) : null;
  if (normalizedSchedule && isTimeWithinSleepSchedule(normalizedSchedule, new Date(timestampMs))) {
    return stats.isLightsOn !== false ? "SLEEPING_LIGHT_ON" : "SLEEPING";
  }

  const napUntilMs = toTimestamp(stats.napUntil);
  const fastSleepStartMs = toTimestamp(stats.fastSleepStart) ?? (
    napUntilMs == null ? null : napUntilMs - NAP_DURATION_MS - FALLING_ASLEEP_DELAY_MS
  );
  if (fastSleepStartMs != null && napUntilMs != null && timestampMs < napUntilMs) {
    return timestampMs < fastSleepStartMs + FALLING_ASLEEP_DELAY_MS
      ? "FALLING_ASLEEP"
      : "NAPPING";
  }

  return "AWAKE";
}

function isFrozenAt(stats = {}, timestampMs) {
  const frozenAtMs = toTimestamp(stats.frozenAt);
  if (frozenAtMs == null || timestampMs < frozenAtMs) return false;

  const takeOutAtMs = toTimestamp(stats.takeOutAt);
  return takeOutAtMs == null || timestampMs < takeOutAtMs;
}

function getNextHalfHourBoundaryAfter(timestampMs) {
  const boundary = new Date(timestampMs);
  boundary.setSeconds(0, 0);
  if (boundary.getTime() <= timestampMs) {
    if (boundary.getMinutes() < 30) boundary.setMinutes(30);
    else {
      boundary.setMinutes(0);
      boundary.setHours(boundary.getHours() + 1);
    }
  }
  return boundary.getTime();
}

function getWakeTimesInRange(sleepSchedule, startMs, endMs) {
  const wakeTimes = new Set();
  for (
    let wakeMs = getMostRecentWakeDate(sleepSchedule, new Date(endMs)).getTime();
    wakeMs > startMs;
    wakeMs -= 24 * 60 * 60 * 1000
  ) {
    if (wakeMs <= endMs) wakeTimes.add(wakeMs);
  }
  return wakeTimes;
}

/** 활동 시간의 00/30분 경계와 정규 기상에 따른 energy 회복을 적용합니다. */
export function recoverEnergy(stats, {
  startMs,
  endMs,
  sleepSchedule,
  maxEnergy,
} = {}) {
  const safeStartMs = toTimestamp(startMs);
  const safeEndMs = toTimestamp(endMs);
  const safeMaxEnergy = Number(maxEnergy);
  if (
    safeStartMs == null || safeEndMs == null || safeEndMs <= safeStartMs ||
    !sleepSchedule || !Number.isFinite(safeMaxEnergy) || safeMaxEnergy <= 0 || stats.isDead
  ) return stats;

  const updatedStats = { ...stats };
  const lastRecoveryMs = toTimestamp(updatedStats.lastEnergyRecoveryAt);
  const recoveryStartMs = Math.max(lastRecoveryMs ?? safeStartMs, safeStartMs);
  const wakeTimes = getWakeTimesInRange(sleepSchedule, recoveryStartMs, safeEndMs);
  const eventTimes = new Set(wakeTimes);
  for (
    let boundaryMs = getNextHalfHourBoundaryAfter(recoveryStartMs);
    boundaryMs <= safeEndMs;
    boundaryMs = getNextHalfHourBoundaryAfter(boundaryMs)
  ) {
    eventTimes.add(boundaryMs);
  }

  for (const eventMs of [...eventTimes].sort((left, right) => left - right)) {
    if (wakeTimes.has(eventMs) && !isFrozenAt(updatedStats, eventMs)) {
      updatedStats.energy = safeMaxEnergy;
      updatedStats.lastEnergyRecoveryAt = eventMs;
      continue;
    }

    const status = getEnergyRecoverySleepStatus(updatedStats, sleepSchedule, eventMs);
    if (isSleepLikeStatus(status) || isFrozenAt(updatedStats, eventMs)) continue;

    const currentEnergy = Number(updatedStats.energy) || 0;
    if (currentEnergy < safeMaxEnergy) {
      updatedStats.energy = Math.min(safeMaxEnergy, currentEnergy + 1);
      updatedStats.lastEnergyRecoveryAt = eventMs;
    }
  }
  return updatedStats;
}
