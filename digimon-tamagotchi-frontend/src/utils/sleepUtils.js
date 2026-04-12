// src/utils/sleepUtils.js
// 수면 관련 공용 유틸리티

import { toEpochMs } from "./time";

function clampHour(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return ((parsed % 24) + 24) % 24;
}

function clampMinute(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(59, parsed));
}

function toMinutesOfDay(hour, minute = 0) {
  return clampHour(hour) * 60 + clampMinute(minute);
}

function formatTimeLabel(hour, minute = 0) {
  const safeHour = clampHour(hour);
  const safeMinute = clampMinute(minute);
  const period = safeHour >= 12 ? "오후" : "오전";
  const hour12 = safeHour > 12 ? safeHour - 12 : safeHour === 0 ? 12 : safeHour;
  return `${period} ${hour12}:${String(safeMinute).padStart(2, "0")}`;
}

function buildScheduleDate(baseDate, hour, minute = 0, dayOffset = 0) {
  const target = new Date(baseDate);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(clampHour(hour), clampMinute(minute), 0, 0);
  return target;
}

function ensureTimestamp(value) {
  return toEpochMs(value);
}

function clampInterval(startMs, endMs, rangeStartMs, rangeEndMs) {
  const clampedStart = Math.max(startMs, rangeStartMs);
  const clampedEnd = Math.min(endMs, rangeEndMs);

  if (!Number.isFinite(clampedStart) || !Number.isFinite(clampedEnd) || clampedStart >= clampedEnd) {
    return null;
  }

  return {
    start: clampedStart,
    end: clampedEnd,
  };
}

function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals]
    .filter((interval) => interval && interval.start < interval.end)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return [];
  }

  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = merged[merged.length - 1];
    const current = sorted[index];

    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function subtractInterval(intervals, removeStartMs, removeEndMs) {
  if (!Number.isFinite(removeStartMs) || !Number.isFinite(removeEndMs) || removeStartMs >= removeEndMs) {
    return intervals;
  }

  return intervals.flatMap((interval) => {
    if (interval.end <= removeStartMs || interval.start >= removeEndMs) {
      return [interval];
    }

    const next = [];

    if (interval.start < removeStartMs) {
      next.push({ start: interval.start, end: removeStartMs });
    }

    if (removeEndMs < interval.end) {
      next.push({ start: removeEndMs, end: interval.end });
    }

    return next;
  });
}

function formatDuration(diffMs) {
  const safeMs = Math.max(0, diffMs);
  const totalMinutes = Math.max(0, Math.ceil(safeMs / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후`;
  }

  return `${minutes}분 후`;
}

export function normalizeSleepSchedule(schedule) {
  if (!schedule) {
    return { start: 22, end: 6, startMinute: 0, endMinute: 0 };
  }

  return {
    ...schedule,
    start: clampHour(schedule.start, 22),
    end: clampHour(schedule.end, 6),
    startMinute: clampMinute(schedule.startMinute, 0),
    endMinute: clampMinute(schedule.endMinute, 0),
  };
}

export function shiftSleepScheduleByHours(schedule, offsetHours = 0) {
  const normalized = normalizeSleepSchedule(schedule);
  const shift = Number.parseInt(offsetHours, 10) || 0;

  return {
    ...normalized,
    start: clampHour(normalized.start + shift),
    end: clampHour(normalized.end + shift),
  };
}

export function isTimeWithinSleepSchedule(schedule, nowDate = new Date()) {
  const normalized = normalizeSleepSchedule(schedule);
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const startMinutes = toMinutesOfDay(
    normalized.start,
    normalized.startMinute
  );
  const endMinutes = toMinutesOfDay(normalized.end, normalized.endMinute);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function getNextSleepDate(schedule, now = new Date()) {
  const normalized = normalizeSleepSchedule(schedule);
  const todaySleep = buildScheduleDate(
    now,
    normalized.start,
    normalized.startMinute
  );

  if (todaySleep.getTime() > now.getTime()) {
    return todaySleep;
  }

  return buildScheduleDate(now, normalized.start, normalized.startMinute, 1);
}

export function getMostRecentWakeDate(schedule, now = new Date()) {
  const normalized = normalizeSleepSchedule(schedule);
  const todayWake = buildScheduleDate(now, normalized.end, normalized.endMinute);

  if (todayWake.getTime() <= now.getTime()) {
    return todayWake;
  }

  return buildScheduleDate(now, normalized.end, normalized.endMinute, -1);
}

export function getMostRecentSleepDate(schedule, now = new Date()) {
  const normalized = normalizeSleepSchedule(schedule);
  const todaySleep = buildScheduleDate(
    now,
    normalized.start,
    normalized.startMinute
  );

  if (todaySleep.getTime() <= now.getTime()) {
    return todaySleep;
  }

  return buildScheduleDate(now, normalized.start, normalized.startMinute, -1);
}

export function getNextWakeDate(schedule, now = new Date()) {
  const recentWake = getMostRecentWakeDate(schedule, now);

  if (recentWake.getTime() > now.getTime()) {
    return recentWake;
  }

  return buildScheduleDate(
    recentWake,
    recentWake.getHours(),
    recentWake.getMinutes(),
    1
  );
}

export function hasCrossedWakeTimeSince(schedule, previousTime, now = new Date()) {
  if (!previousTime) {
    return false;
  }

  const previousDate =
    previousTime instanceof Date ? previousTime : new Date(previousTime);
  const recentWakeDate = getMostRecentWakeDate(schedule, now);

  return (
    !Number.isNaN(previousDate.getTime()) &&
    recentWakeDate.getTime() > previousDate.getTime() &&
    recentWakeDate.getTime() <= now.getTime()
  );
}

/**
 * 수면까지 남은 시간을 계산합니다.
 * @param {Object} sleepSchedule - 수면 스케줄
 * @param {Date} now - 현재 시간
 * @returns {string}
 */
export function getTimeUntilSleep(sleepSchedule, now = new Date()) {
  if (!sleepSchedule) {
    return "정보 없음";
  }

  return formatDuration(getNextSleepDate(sleepSchedule, now).getTime() - now.getTime());
}

/**
 * 기상까지 남은 시간을 계산합니다.
 * @param {Object} sleepSchedule - 수면 스케줄
 * @param {Date} now - 현재 시간
 * @returns {string}
 */
export function getTimeUntilWake(sleepSchedule, now = new Date()) {
  if (!sleepSchedule) {
    return "정보 없음";
  }

  return formatDuration(getNextWakeDate(sleepSchedule, now).getTime() - now.getTime());
}

/**
 * 수면 시간을 포맷팅합니다.
 * @param {Object} sleepSchedule - 수면 스케줄
 * @returns {string}
 */
export function formatSleepSchedule(sleepSchedule) {
  if (!sleepSchedule) {
    return "정보 없음";
  }

  const normalized = normalizeSleepSchedule(sleepSchedule);
  return `${formatTimeLabel(normalized.start, normalized.startMinute)} - ${formatTimeLabel(
    normalized.end,
    normalized.endMinute
  )}`;
}

/**
 * 특정 기간 내에 포함된 수면 시간(초)을 계산합니다.
 * @param {number|Date} startTime - 시작 시간
 * @param {number|Date} endTime - 종료 시간
 * @param {Object} schedule - 수면 스케줄
 * @returns {number}
 */
export function calculateSleepSecondsInRange(startTime, endTime, schedule) {
  if (!schedule) {
    return 0;
  }

  const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
  const endMs = endTime instanceof Date ? endTime.getTime() : endTime;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return 0;
  }

  const maxRange = 7 * 24 * 60 * 60 * 1000;
  const actualEnd = Math.min(endMs, startMs + maxRange);
  const step = 60 * 1000;
  let sleepMs = 0;
  let current = startMs;

  while (current < actualEnd) {
    if (isTimeWithinSleepSchedule(schedule, new Date(current))) {
      sleepMs += step;
    }

    current += step;
  }

  return Math.floor(sleepMs / 1000);
}

const FALLING_ASLEEP_DELAY_MS = 15 * 1000;
const NAP_DURATION_MS = 3 * 60 * 60 * 1000;
const WAKE_INTERRUPTION_DURATION_MS = 10 * 60 * 1000;

export function getFallingAsleepRemainingSeconds(
  fastSleepStart,
  now = Date.now()
) {
  const fastSleepStartMs = ensureTimestamp(fastSleepStart);
  const nowMs = ensureTimestamp(now) ?? Date.now();

  if (fastSleepStartMs == null) {
    return null;
  }

  const remainingMs = Math.max(
    0,
    fastSleepStartMs + FALLING_ASLEEP_DELAY_MS - nowMs
  );

  return Math.ceil(remainingMs / 1000);
}

export function formatSleepCountdown(diffMs) {
  const safeMs = Math.max(0, diffMs || 0);
  const hours = Math.floor(safeMs / (60 * 60 * 1000));
  const minutes = Math.floor((safeMs % (60 * 60 * 1000)) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }

  return `${seconds}초`;
}

function buildScheduledSleepIntervals(startMs, endMs, schedule) {
  if (!schedule) {
    return [];
  }

  const normalized = normalizeSleepSchedule(schedule);
  const rangeStart = new Date(startMs);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(endMs);
  rangeEnd.setHours(0, 0, 0, 0);

  const daySpan = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000));
  const intervals = [];

  for (let offset = -1; offset <= daySpan + 1; offset += 1) {
    const sleepStart = buildScheduleDate(
      rangeStart,
      normalized.start,
      normalized.startMinute,
      offset
    );
    const sleepEndBaseOffset =
      toMinutesOfDay(normalized.start, normalized.startMinute) <
      toMinutesOfDay(normalized.end, normalized.endMinute)
        ? offset
        : offset + 1;
    const sleepEnd = buildScheduleDate(
      rangeStart,
      normalized.end,
      normalized.endMinute,
      sleepEndBaseOffset
    );

    const clamped = clampInterval(
      sleepStart.getTime(),
      sleepEnd.getTime(),
      startMs,
      endMs
    );

    if (clamped) {
      intervals.push(clamped);
    }
  }

  return intervals;
}

function buildNapIntervals(startMs, endMs, { isLightsOn = true, fastSleepStart = null, napUntil = null } = {}) {
  if (isLightsOn) {
    return [];
  }

  const napUntilMs = ensureTimestamp(napUntil);
  if (napUntilMs == null) {
    return [];
  }

  const fastSleepStartMs = ensureTimestamp(fastSleepStart);
  const napStartMs =
    fastSleepStartMs != null
      ? fastSleepStartMs + FALLING_ASLEEP_DELAY_MS
      : napUntilMs - NAP_DURATION_MS;

  const clamped = clampInterval(napStartMs, napUntilMs, startMs, endMs);
  return clamped ? [clamped] : [];
}

export function getSleepLikeIntervalsInRange(
  startTime,
  endTime,
  {
    schedule = null,
    isLightsOn = true,
    wakeUntil = null,
    fastSleepStart = null,
    napUntil = null,
  } = {}
) {
  const startMs = ensureTimestamp(startTime);
  const endMs = ensureTimestamp(endTime);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return [];
  }

  let intervals = [
    ...buildScheduledSleepIntervals(startMs, endMs, schedule),
    ...buildNapIntervals(startMs, endMs, {
      isLightsOn,
      fastSleepStart,
      napUntil,
    }),
  ];

  intervals = mergeIntervals(intervals);

  const wakeUntilMs = ensureTimestamp(wakeUntil);
  if (wakeUntilMs != null) {
    const wakeStartMs = wakeUntilMs - WAKE_INTERRUPTION_DURATION_MS;
    intervals = subtractInterval(intervals, wakeStartMs, wakeUntilMs);
  }

  return mergeIntervals(intervals);
}

export function calculateSleepLikeSecondsInRange(startTime, endTime, context = {}) {
  return getSleepLikeIntervalsInRange(startTime, endTime, context).reduce(
    (total, interval) => total + Math.floor((interval.end - interval.start) / 1000),
    0
  );
}

export function getActiveSleepLikeStartedAt(currentTime, context = {}) {
  const currentMs = ensureTimestamp(currentTime);

  if (!Number.isFinite(currentMs)) {
    return null;
  }

  const lookbackStartMs = currentMs - 48 * 60 * 60 * 1000;
  const intervals = getSleepLikeIntervalsInRange(lookbackStartMs, currentMs + 1, context);

  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    const interval = intervals[index];
    if (interval.start <= currentMs && currentMs < interval.end) {
      return interval.start;
    }
  }

  return null;
}
