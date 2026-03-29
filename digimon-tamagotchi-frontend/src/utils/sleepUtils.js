// src/utils/sleepUtils.js
// 수면 관련 공용 유틸리티

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
