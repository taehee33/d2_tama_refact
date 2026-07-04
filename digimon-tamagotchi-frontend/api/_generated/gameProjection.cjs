/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/
/************************************************************************/
var __webpack_exports__ = {};
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  applyLazyUpdate: () => (/* reexport */ applyLazyUpdate),
  projectState: () => (/* reexport */ projectState)
});

;// ./src/data/defaultStatsFile.js
// src/data/defaultStatsFile.js
const defaultStatsFile_defaultStats = {
    sprite: 133,
    evolutionStage: "Digitama",
    age: 0,
    birthTime: null, // 디지몬 생성 시간 (나이 계산용)
    weight: 0,
    strength: 0,
    stamina: 0, // 기존 필드 (호환성 유지)
    energy: 0, // 매뉴얼의 DP 개념 (Energy/DP)
    effort: 0,
    fullness: 0,
    careMistakes: 0,
    careMistakeLedger: [],

    lifespanSeconds: 0,
    timeToEvolveSeconds: 0,

    hungerTimer: 0,
    hungerCountdown: 0,
    strengthTimer: 0,
    strengthCountdown: 0,
    poopTimer: 0,

    maxOverfeed: 0,
    overfeeds: 0, // 오버피드 횟수 누적
    consecutiveMeatFed: 0, // 연속으로 먹은 고기 개수 (오버피드 체크용)
    isDead: false,
    diedAt: null,
    lastHungerZeroAt: null,
    hungerZeroFrozenDurationMs: 0,
    lastStrengthZeroAt: null,
    strengthZeroFrozenDurationMs: 0,

    maxStamina: 0,
    minWeight: 0,
    healing: 0,
    attribute: 0,
    power: 0,
    attackSprite: 0,
    altAttackSprite: 65535,

    // 매뉴얼 기반 추가 필드
    // proteinCount 제거됨 - strength로 통합
    proteinOverdose: 0, // 프로틴 과다 복용 횟수 (최대 7, 4개당 +1)

    // 배틀 관련: 이번 생애 누적 (진화 시 유지, 새로운 시작 시 초기화)
    totalBattles: 0, // 이번 생애 동안의 총 배틀 횟수
    totalBattlesWon: 0, // 이번 생애 동안의 총 승리 횟수
    totalBattlesLost: 0, // 이번 생애 동안의 총 패배 횟수
    totalWinRate: 0, // 이번 생애 동안의 총 승률 (%)

    // 배틀 관련: 현재 디지몬 (진화 시 리셋)
    battles: 0, // 현재 디지몬일 때의 배틀 횟수 (진화 조건용)
    battlesWon: 0, // 현재 디지몬일 때의 승리 횟수 (진화 조건용)
    battlesLost: 0, // 현재 디지몬일 때의 패배 횟수 (진화 조건용)
    winRate: 0, // 현재 디지몬일 때의 승률 (%) (진화 조건용)
    isInjured: false, // 부상 상태 (똥 8개, 배틀 부상 시 true)
    injuredAt: null, // 부상 당한 시각 (6시간 사망 체크용)
    injuryFrozenDurationMs: 0, // 현재 부상 타이머에서 제외할 냉장고 누적 시간
    injuries: 0, // 이번 생 누적 부상 횟수 (15회 사망 체크용)
    poopReachedMaxAt: null, // 똥이 처음 8개가 된 시각
    lastPoopPenaltyAt: null, // 추가 부상 8시간 주기의 기준 시각
    poopPenaltyFrozenDurationMs: 0, // 현재 똥 8시간 주기에서 제외할 냉장고 누적 시간
    healedDosesCurrent: 0, // 현재 투여된 치료제 횟수
    // 호출(Call) 시스템
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false }, // 제한시간 10분
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false }
    },
    fastSleepStart: null,
    napUntil: null,
    sleepLightOnStart: null,

    // 냉장고(냉동수면) 관련
    isFrozen: false,    // 냉장고 보관 여부
    frozenAt: null,     // 냉장고에 넣은 시간 (timestamp)
    takeOutAt: null,    // 냉장고에서 꺼낸 시간 (timestamp, 꺼내기 애니메이션용)
  };

;// ./src/constants/activityLogs.js
// src/constants/activityLogs.js

// activityLogs는 UI 이력, 중복 방지, 최근 상태 확인에 함께 쓰이므로
// 액션/복구/로드 경로 모두 같은 최대 개수를 사용한다.
const MAX_ACTIVITY_LOGS = 100;

;// ./src/utils/sleepUtils.js
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

function normalizeSleepSchedule(schedule) {
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

function shiftSleepScheduleByHours(schedule, offsetHours = 0) {
  const normalized = normalizeSleepSchedule(schedule);
  const shift = Number.parseInt(offsetHours, 10) || 0;

  return {
    ...normalized,
    start: clampHour(normalized.start + shift),
    end: clampHour(normalized.end + shift),
  };
}

function isTimeWithinSleepSchedule(schedule, nowDate = new Date()) {
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

function getNextSleepDate(schedule, now = new Date()) {
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

function getMostRecentWakeDate(schedule, now = new Date()) {
  const normalized = normalizeSleepSchedule(schedule);
  const todayWake = buildScheduleDate(now, normalized.end, normalized.endMinute);

  if (todayWake.getTime() <= now.getTime()) {
    return todayWake;
  }

  return buildScheduleDate(now, normalized.end, normalized.endMinute, -1);
}

function getMostRecentSleepDate(schedule, now = new Date()) {
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

function getNextWakeDate(schedule, now = new Date()) {
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

function hasCrossedWakeTimeSince(schedule, previousTime, now = new Date()) {
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
function getTimeUntilSleep(sleepSchedule, now = new Date()) {
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
function getTimeUntilWake(sleepSchedule, now = new Date()) {
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
function formatSleepSchedule(sleepSchedule) {
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
function calculateSleepSecondsInRange(startTime, endTime, schedule) {
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

const FALLING_ASLEEP_DELAY_MS = (/* unused pure expression or super */ null && (15 * 1000));
const NAP_DURATION_MS = (/* unused pure expression or super */ null && (3 * 60 * 60 * 1000));
const WAKE_INTERRUPTION_DURATION_MS = (/* unused pure expression or super */ null && (10 * 60 * 1000));

function getFallingAsleepRemainingSeconds(
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

function formatSleepCountdown(diffMs) {
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

function getSleepLikeIntervalsInRange(
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

function calculateSleepLikeSecondsInRange(startTime, endTime, context = {}) {
  return getSleepLikeIntervalsInRange(startTime, endTime, context).reduce(
    (total, interval) => total + Math.floor((interval.end - interval.start) / 1000),
    0
  );
}

function getActiveSleepLikeStartedAt(currentTime, context = {}) {
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

;// ./src/utils/time.js
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function getKstDateParts(value) {
  const timestamp = time_toEpochMs(value);
  if (timestamp == null) {
    return null;
  }

  const date = new Date(timestamp + KST_OFFSET_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
  };
}

function time_toEpochMs(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      try {
        const timestamp = value.toMillis();
        return Number.isFinite(timestamp) ? timestamp : null;
      } catch (_error) {
        return null;
      }
    }

    if (typeof value.toDate === "function") {
      try {
        const date = value.toDate();
        if (date instanceof Date) {
          const timestamp = date.getTime();
          return Number.isFinite(timestamp) ? timestamp : null;
        }
      } catch (_error) {
        return null;
      }
    }

    if ("seconds" in value) {
      const seconds = Number(value.seconds);
      const nanoseconds =
        value.nanoseconds != null ? Number(value.nanoseconds) : 0;
      const timestamp = seconds * 1000 + nanoseconds / 1000000;
      return Number.isFinite(timestamp) ? timestamp : null;
    }
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function time_getStartOfKstDayMs(value = Date.now()) {
  const timestamp = time_toEpochMs(value);
  if (timestamp == null) {
    return null;
  }

  return (
    Math.floor((timestamp + KST_OFFSET_MS) / KST_DAY_MS) * KST_DAY_MS -
    KST_OFFSET_MS
  );
}

function time_isSameKstDay(left, right) {
  const leftDayStart = time_getStartOfKstDayMs(left);
  const rightDayStart = time_getStartOfKstDayMs(right);

  if (leftDayStart == null || rightDayStart == null) {
    return false;
  }

  return leftDayStart === rightDayStart;
}

function formatTimestamp(timestamp, format = "short") {
  const parts = getKstDateParts(timestamp);
  if (!parts) {
    return "N/A";
  }

  const month = pad(parts.month);
  const day = pad(parts.day);
  const hours = pad(parts.hours);
  const minutes = pad(parts.minutes);
  const seconds = pad(parts.seconds);

  switch (format) {
    case "long":
      return `${parts.year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case "time":
      return `${hours}:${minutes}:${seconds}`;
    case "short":
    default:
      return `${month}/${day} ${hours}:${minutes}`;
  }
}

function formatSlotCreatedAt(value) {
  if (value == null || value === "") {
    return "";
  }

  const timestamp = time_toEpochMs(value);
  if (timestamp == null) {
    return String(value);
  }

  return new Date(timestamp).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
}



;// ./src/utils/fridgeTime.js


function toTimestamp(value) {
  return time_toEpochMs(value);
}

function toDurationMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

/**
 * 냉장고 구간을 제외한 경과 시간(ms)
 */
function fridgeTime_getElapsedTimeExcludingFridge(
  startTime,
  endTime = Date.now(),
  frozenAt = null,
  takeOutAt = null,
  extraExcludedMs = 0
) {
  const startMs = toTimestamp(startTime);
  const endMs = toTimestamp(endTime) ?? Date.now();

  if (startMs == null || endMs <= startMs) {
    return 0;
  }

  const extraPausedMs = toDurationMs(extraExcludedMs);

  const frozenMs = toTimestamp(frozenAt);
  if (frozenMs == null) {
    return Math.max(0, (endMs - startMs) - extraPausedMs);
  }

  const takeOutMs = toTimestamp(takeOutAt) ?? endMs;

  if (frozenMs < startMs || frozenMs >= endMs) {
    return endMs - startMs;
  }

  const frozenDuration = Math.max(0, takeOutMs - frozenMs);
  return Math.max(0, (endMs - startMs) - frozenDuration - extraPausedMs);
}

;// ./src/data/v1/digimons.js
// src/data/v1/digimons.js
// Digital Monster Color 매뉴얼 기반 디지몬 데이터 스키마
// Ver.1 전체 진화 트리 데이터 (Baby I ~ Super Ultimate)

/**
 * 디지몬 데이터 스키마
 *
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate)
 * @property {number} sprite - 스프라이트 번호
 * @property {Object} stats - 스탯 정보
 * @property {number} stats.hungerCycle - 배고픔 감소 주기 (분)
 * @property {number} stats.strengthCycle - 힘 감소 주기 (분)
 * @property {number} stats.poopCycle - 똥 생성 주기 (분, Stage별로 다름: I=3분, II=60분, III+=120분)
 * @property {number} stats.maxOverfeed - 최대 오버피드 허용치
 * @property {number} stats.basePower - 기본 파워
 * @property {number} stats.maxEnergy - 최대 에너지 (DP)
 * @property {number} stats.minWeight - 최소 체중
 * @property {number} stats.healDoses - 치료 필요 횟수 (기본값 1)
 * @property {string} stats.type - 속성 ("Vaccine", "Data", "Virus", "Free" 또는 null)
 * @property {string} stats.sleepTime - 수면 시간 (HH:MM 형식)
 * @property {number} stats.attackSprite - 공격 스프라이트 번호 (공격 시 사용, null이면 기본 sprite 사용)
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */

const digimonDataVer1 = {
  // 사망 형태
  Ohakadamon1: {
    id: "Ohakadamon1",
    name: "오하카다몬(일반)",
    stage: "Ohakadamon",
    sprite: 159,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: null, // 진화 불가
    evolutions: [],
  },
  Ohakadamon2: {
    id: "Ohakadamon2",
    name: "오하카다몬(perfect)",
    stage: "Ohakadamon",
    sprite: 160,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: null, // 진화 불가
    evolutions: [],
  },

  // Digitama (Digi-Egg)
  Digitama: {
    id: "Digitama",
    name: "디지타마",
    stage: "Digitama",
    sprite: 133,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999, // Stage I: 3분마다 똥
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 10초 후 자동 진화 (다음 세대 알 → 깜몬)
      timeToEvolveSeconds: 10,
    },
    evolutions: [
      {
        targetId: "Botamon",
        targetName: "깜몬",
        // 시간 조건은 evolutionCriteria에서 처리되므로 conditions 없음
      },
    ],
  },

  // Baby I (In-Training I)
  Botamon: {
    id: "Botamon",
    name: "깜몬",
    stage: "Baby I",
    sprite: 210,
    stats: {
      hungerCycle: 3, // Hunger Loss: 3 Minutes
      strengthCycle: 3, // Strength Loss: 3 Minutes
      poopCycle: 3, // Stage I: 3분마다 똥
      maxOverfeed: 3,
      basePower: 0, // Power: 0
      maxEnergy: 5, // Energy: 0
      minWeight: 5, // Min Weight: 5
      healDoses: 0, // Heal Doses: 1 (치료 필요 횟수)
      type: "Free", // Free
      sleepTime: null,
      attackSprite: 1, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: null
      //attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 10분 후 진화
      timeToEvolveSeconds: 600, // 10분 = 600초
    },
    evolutions: [
      {
        targetId: "Koromon",
        targetName: "코로몬",
        // 시간 조건은 evolutionCriteria에서 처리되므로 conditions 없음
      },
    ],
  },

  // Baby II (In-Training II)
  Koromon: {
    id: "Koromon",
    name: "코로몬",
    stage: "Baby II",
    sprite: 225,
    stats: {
      hungerCycle: 30, // Hunger Loss: 30 Minutes
      strengthCycle: 30, // Strength Loss: 30 Minutes
      poopCycle: 60, // Stage II: 60분마다 똥
      maxOverfeed: 2,
      basePower: 0, // Power: 0
      maxEnergy: 10, // Energy: 0
      minWeight: 10, // Min Weight: 10
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Free", // Free
      sleepTime: "20:00",
      attackSprite: 7, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
    },
    evolutionCriteria: {
      // 12시간 후 진화
      timeToEvolveSeconds: 43200, // 12시간 = 43200초
    },
    evolutions: [
      {
        targetId: "Agumon",
        targetName: "아구몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
        },
      },
      {
        targetId: "Betamon",
        targetName: "베타몬",
        conditions: {
          careMistakes: { min: 4 }, // 4+ Care Mistakes
        },
      },
    ],
  },

  // Child (Rookie) - Agumon
  Agumon: {
    id: "Agumon",
    name: "아구몬",
    stage: "Child",
    sprite: 240,
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120, // Stage III+: 120분마다 똥
      maxOverfeed: 4,
      basePower: 30, // Power: 30
      maxEnergy: 20, // Energy: 20
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "20:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
      //attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
    },
    evolutions: [
      // 우선순위: 까다로운 진화를 앞에 배치
      {
        targetId: "Greymon",
        targetName: "그레이몬",
        // Case 1: 단일 조건 그룹 (모든 조건 만족 시 진화 - AND Logic)
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { min: 32 },   // 32+ Training
        },
      },
      {
        targetId: "Devimon",
        targetName: "데블몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { max: 31 },   // 0-31 Training
        },
      },
      {
        targetId: "Tyranomon",
        targetName: "티라노몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 5, max: 15 },    // 5-15 Training
          overfeeds: { min: 3 },             // 3+ Overfeed
          sleepDisturbances: { min: 4, max: 5 }, // 4-5 Sleep Disturbances
        },
      },
      {
        targetId: "Meramon",
        targetName: "메라몬",
        conditions: {
          careMistakes: { min: 4 },      // 4+ Care Mistakes
          trainings: { min: 16 },        // 16+ Training
          overfeeds: { min: 3 },         // 3+ Overfeed
          sleepDisturbances: { min: 6 }, // 6+ Sleep Disturbances
        },
      },
      // Case 2: 다중 조건 그룹 (배열 내 조건 중 하나라도 만족 시 진화 - OR Logic)
      {
        targetId: "Numemon",
        targetName: "워매몬",
        conditionGroups: [
          // 루트 1: 4+ Care Mistakes, 0-4 Training
          { careMistakes: { min: 4 }, trainings: { max: 4 } },
          // 루트 2: 4+ Care Mistakes, 0-2 Overfeed
          { careMistakes: { min: 4 }, overfeeds: { max: 2 } },
          // 루트 3: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 0-3 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 3 } },
          // 루트 4: 4+ Care Mistakes, 5-15 Training, 3+ Overfeed, 6+ Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, overfeeds: { min: 3 }, sleepDisturbances: { min: 6 } },
          // 루트 5: 4+ Care Mistakes, 16+ Training, 3+ Overfeed, 0-5 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 16 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 5 } },
        ],
      },
    ],
  },

  // Child (Rookie) - Betamon
  Betamon: {
    id: "Betamon",
    name: "베타몬",
    stage: "Child",
    sprite: 255,
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 25, // Power: 25
      maxEnergy: 20, // Energy: 20
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "21:00",
      attackSprite: 5, // 공격 스프라이트 (null이면 기본 sprite 사용)
    },
    evolutionCriteria: {
      // 24시간 후 진화
      timeToEvolveSeconds: 86400, // 24시간 = 86400초
    },
    evolutions: [
      // 우선순위: 까다로운 진화를 앞에 배치
      {
        targetId: "Devimon",
        targetName: "데블몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { min: 48 },   // 48+ Training
        },
      },
      {
        targetId: "Meramon",
        targetName: "메라몬",
        conditions: {
          careMistakes: { max: 3 }, // 0-3 Care Mistakes
          trainings: { max: 47 },    // 0-47 Training
        },
      },
      {
        targetId: "Airdramon",
        targetName: "에어드라몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 8, max: 31 },      // 8-31 Training
          overfeeds: { max: 3 },              // 0-3 Overfeed
          sleepDisturbances: { min: 9 },      // 9+ Sleep Disturbances
        },
      },
      {
        targetId: "Seadramon",
        targetName: "시드라몬",
        conditions: {
          careMistakes: { min: 4 },           // 4+ Care Mistakes
          trainings: { min: 8, max: 31 },     // 8-31 Training
          overfeeds: { min: 4 },              // 4+ Overfeed
          sleepDisturbances: { max: 8 },      // 0-8 Sleep Disturbances
        },
      },
      // Case 2: 다중 조건 그룹 (OR Logic)
      {
        targetId: "Numemon",
        targetName: "워매몬",
        conditionGroups: [
          // 루트 1: 4+ Care Mistakes, 0-7 Training
          { careMistakes: { min: 4 }, trainings: { max: 7 } },
          // 루트 2: 4+ Care Mistakes, 32+ Training
          { careMistakes: { min: 4 }, trainings: { min: 32 } },
          // 루트 3: 4+ Care Mistakes, 8-31 Training, 4+ Overfeed, 9+ Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { min: 4 }, sleepDisturbances: { min: 9 } },
          // 루트 4: 4+ Care Mistakes, 8-31 Training, 0-3 Overfeed, 0-8 Sleep Disturbances
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { max: 3 }, sleepDisturbances: { max: 8 } },
        ],
      },
    ],
  },

  // Adult (Champion) - Greymon
  Greymon: {
    id: "Greymon",
    name: "그레이몬",
    stage: "Adult",
    sprite: 270,
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Devimon
  Devimon: {
    id: "Devimon",
    name: "데블몬",
    stage: "Adult",
    sprite: 300, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 51, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Airdramon
  Airdramon: {
    id: "Airdramon",
    name: "에어드라몬",
    stage: "Adult",
    sprite: 330, // TODO: Check actual sprite
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50, // Power: 50
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: 6, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Numemon
  Numemon: {
    id: "Numemon",
    name: "워매몬",
    stage: "Adult",
    sprite: 360, // TODO: Check actual sprite
    stats: {
      hungerCycle: 28, // Hunger Loss: 28 Minutes
      strengthCycle: 28, // Strength Loss: 28 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 40, // Power: 40
      maxEnergy: 30, // Energy: 30
      minWeight: 10, // Min Weight: 10
      healDoses: 3, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "00:00",
      attackSprite: 16, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 00:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Monzaemon",
        targetName: "퍼펫몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Tyranomon
  Tyranomon: {
    id: "Tyranomon",
    name: "티라노몬",
    stage: "Adult",
    sprite: 285, // 레거시 데이터와 일치 (수면 프레임: 296, 297)
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "22:00",
      attackSprite: 4, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 22:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Mamemon",
        targetName: "콩알몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Meramon
  Meramon: {
    id: "Meramon",
    name: "메라몬",
    stage: "Adult",
    sprite: 315, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 30, // Min Weight: 30
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "00:00",
      attackSprite: 17, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 00:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "Mamemon",
        targetName: "콩알몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Adult (Champion) - Seadramon
  Seadramon: {
    id: "Seadramon",
    name: "시드라몬",
    stage: "Adult",
    sprite: 345,
    stats: {
      hungerCycle: 38, // Hunger Loss: 38 Minutes
      strengthCycle: 38, // Strength Loss: 38 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45, // Power: 45
      maxEnergy: 30, // Energy: 30
      minWeight: 20, // Min Weight: 20
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 15, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 36시간 후 진화
      timeToEvolveSeconds: 129600, // 36시간 = 129600초
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "MetalGreymonVirus",
        targetName: "메탈그레이몬",
        conditions: {
          battles: { min: 15 },    // 15+ Battles
          winRatio: { min: 80 },   // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Metal Greymon (Virus)
  MetalGreymonVirus: {
    id: "MetalGreymonVirus",
    name: "메탈그레이몬",
    stage: "Perfect",
    sprite: 375, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100, // Power: 100
      maxEnergy: 40, // Energy: 40
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "20:00",
      attackSprite: 11, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 20:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "BlitzGreymon",
        targetName: "블리츠그레이몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },       // 15+ Battles
          winRatio: { min: 80 },      // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Monzaemon
  Monzaemon: {
    id: "Monzaemon",
    name: "퍼펫몬",
    stage: "Perfect",
    sprite: 405, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100, // Power: 100
      maxEnergy: 40, // Energy: 40
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "21:00",
      attackSprite: 23, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 21:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "ShinMonzaemon",
        targetName: "신퍼펫몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },      // 15+ Battles
          winRatio: { min: 80 },     // 80%+ Win Ratio
        },
      },
    ],
  },

  // Perfect (Ultimate) - Mamemon
  Mamemon: {
    id: "Mamemon",
    name: "콩알몬",
    stage: "Perfect",
    sprite: 390, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 85, // Power: 85
      maxEnergy: 40, // Energy: 40
      minWeight: 5, // Min Weight: 5
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 8, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 48시간 후 진화
      timeToEvolveSeconds: 172800, // 48시간 = 172800초
      mistakes: {
        max: 1, // Mistakes [0, 1]
      },
      battles: 15, // Battles 15+
      winRatio: 80, // WinRatio 80%+
    },
    evolutions: [
      {
        targetId: "BanchoMamemon",
        targetName: "반쵸콩알몬",
        conditions: {
          careMistakes: { max: 1 },  // 0-1 Care Mistakes
          battles: { min: 15 },      // 15+ Battles
          winRatio: { min: 80 },     // 80%+ Win Ratio
        },
      },
    ],
  },

  // Ultimate - Blitz Greymon
  BlitzGreymon: {
    id: "BlitzGreymonV1",
    name: "블리츠그레이몬 Ver.1",
    stage: "Ultimate",
    sprite: 420, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170, // Power: 170
      maxEnergy: 50, // Energy: 50
      minWeight: 50, // Min Weight: 50
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 49, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: {
      // 조그레스 진화
      jogress: true, // Jogress with Cres Garurumon
    },
    evolutions: [
      {
        targetId: "OmegamonAlterSV1",
        targetName: "오메가몬 Alter-S(Ver.1)",
        // 조그레스는 특별한 케이스이므로 conditions 대신 jogress 플래그 사용
        jogress: {
          partner: "CresGarurumon", // Jogress with Cres Garurumon (V2는 baseJogressId로 매칭)
        },
      },
    ],
  },

  // Ultimate - Shin Monzaemon
  ShinMonzaemon: {
    id: "ShinMonzaemon",
    name: "신퍼펫몬",
    stage: "Ultimate",
    sprite: 450, // TODO: Check actual sprite
    stats: {
      hungerCycle: 48, // Hunger Loss: 48 Minutes
      strengthCycle: 48, // Strength Loss: 48 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170, // Power: 170
      maxEnergy: 50, // Energy: 50
      minWeight: 40, // Min Weight: 40
      healDoses: 2, // Heal Doses: 1 (치료 필요 횟수)
      type: "Vaccine", // Vaccine
      sleepTime: "23:00",
      attackSprite: 52, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Bancho Mamemon
  BanchoMamemon: {
    id: "BanchoMamemon",
    name: "반쵸콩알몬",
    stage: "Ultimate",
    sprite: 435, // TODO: Check actual sprite
    stats: {
      hungerCycle: 59, // Hunger Loss: 59 Minutes
      strengthCycle: 59, // Strength Loss: 59 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 150, // Power: 150
      maxEnergy: 50, // Energy: 50
      minWeight: 5, // Min Weight: 5
      type: "Data", // Data
      sleepTime: "23:00",
      attackSprite: 116, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Super Ultimate - Omegamon Alter-S (Ver.1, 객체 키 = targetId)
  OmegamonAlterSV1: {
    id: "OmegamonAlterSV1",
    name: "오메가몬 Alter-S Ver.1",
    stage: "Super Ultimate",
    sprite: 465, // TODO: Check actual sprite
    stats: {
      hungerCycle: 66, // Hunger Loss: 66 Minutes
      strengthCycle: 66, // Strength Loss: 66 Minutes
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 200, // Power: 200
      maxEnergy: 50, // Energy: 50
      minWeight: 40, // Min Weight: 40
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: "Virus", // Virus
      sleepTime: "23:00",
      attackSprite: 31, // 공격 스프라이트 (null이면 기본 sprite 사용) // Sleep: 23:00
    },
    evolutionCriteria: null, // 최종 단계
    evolutions: [], // 최종 단계
  },

  // Ultimate - Cres Garurumon (Jogress 파트너용 Placeholder)
  CresGarurumon: {
    id: "CresGarurumonV1forJogress",
    name: "크레스가루몬 Ver.1 (for Jogress)",
    stage: "Ultimate",
    sprite: 480, // TODO: Check actual sprite
    stats: {
      hungerCycle: 0, // Placeholder
      strengthCycle: 0, // Placeholder
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0, // Placeholder
      maxEnergy: 0, // Placeholder
      minWeight: 0, // Placeholder
      healDoses: 1, // Heal Doses: 1 (치료 필요 횟수)
      type: null, // Placeholder
      sleepTime: null,
      attackSprite: null, // 공격 스프라이트 (null이면 기본 sprite 사용) // Placeholder
    },
    evolutionCriteria: null, // Jogress 파트너용
    evolutions: [], // Jogress 파트너용
  },
};

;// ./src/data/v2modkor/digimons.js
// src/data/v2modkor/digimons.js
// Digital Monster Color Ver.2 매뉴얼 기반 디지몬 데이터 스키마
// Ver.2 전체 진화 트리 데이터 (v1/digimons.js와 동일 구조). 스프라이트는 public/Ver2_Mod_Kor 경로 사용.
// 한글/영문 이름은 20주년 벽돌제품 Ver.2 차트 기준 적용 (푸니몬, 뿔몬, 파피몬, 에레키몬, 캅테리몬, 엔젤몬, 가루몬, 프리지몬, 베지몬, 버드라몬, 고래몬, 스컬그레이몬, 메탈콩알몬, 베이더몬, 스컬맘몬, 크레스가루루몬, 블리츠그레이몬, 오메가몬 Alter-S).
// 오하카다몬V2·디지타마V2는 공통으로 쓰지 않고 Ver.2 전용 ID 사용.

/** v2 스프라이트 기준 경로 (public/Ver2_Mod_Kor → 서빙 경로 /Ver2_Mod_Kor) */
const V2_SPRITE_BASE = '/Ver2_Mod_Kor';

/**
 * Ver.2 디지몬 데이터 스키마 (v1과 동일 + spriteBasePath)
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계 (Digitama, Baby I, Baby II, Child, Adult, Perfect, Ultimate, Super Ultimate)
 * @property {number} sprite - 스프라이트 번호
 * @property {string} [spriteBasePath] - 스프라이트 이미지 기준 경로 (v2는 /Ver2_Mod_Kor)
 * @property {Object} stats - 스탯 정보
 * @property {number} stats.hungerCycle - 배고픔 감소 주기 (분)
 * @property {number} stats.strengthCycle - 힘 감소 주기 (분)
 * @property {number} stats.poopCycle - 똥 생성 주기 (분)
 * @property {number} stats.maxOverfeed - 최대 오버피드 허용치
 * @property {number} stats.basePower - 기본 파워
 * @property {number} stats.maxEnergy - 최대 에너지 (DP)
 * @property {number} stats.minWeight - 최소 체중
 * @property {number} stats.healDoses - 치료 필요 횟수
 * @property {string} stats.type - 속성 ("Vaccine", "Data", "Virus", "Free" 또는 null)
 * @property {string} stats.sleepTime - 수면 시간 (HH:MM 형식)
 * @property {number} stats.attackSprite - 공격 스프라이트 번호 (null이면 기본 sprite 사용)
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */

const digimonDataVer2 = {
  // 사망 형태 (Ver.2 전용 ID — 이름은 직접 수정)
  Ohakadamon1V2: {
    id: "Ohakadamon1V2",
    name: "사망(일반 Ver.2)",
    stage: "Ohakadamon",
    sprite: 159,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },
  Ohakadamon2V2: {
    id: "Ohakadamon2V2",
    name: "사망(perfect Ver.2)",
    stage: "Ohakadamon",
    sprite: 160,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Digitama (Ver.2 전용 ID — 이름은 직접 수정)
  DigitamaV2: {
    id: "DigitamaV2",
    name: "디지타마 Ver.2",
    stage: "Digitama",
    sprite: 133,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [
      { targetId: "Punimon", targetName: "푸니몬" },
    ],
  },

  // Baby I (In-Training I)
  Punimon: {
    id: "Punimon",
    name: "푸니몬",
    stage: "Baby I",
    sprite: 226,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: 1,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [
      { targetId: "Tsunomon", targetName: "뿔몬" },
    ],
  },

  // Baby II (In-Training II) — 뿔몬
  Tsunomon: {
    id: "Tsunomon",
    name: "뿔몬",
    stage: "Baby II",
    sprite: 241,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 30,
      strengthCycle: 30,
      poopCycle: 60,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 10,
      minWeight: 10,
      healDoses: 1,
      type: "Free",
      sleepTime: "20:00",
      attackSprite: 7,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Gabumon",
        targetName: "파피몬",
        conditions: { careMistakes: { max: 3 } },
      },
      {
        targetId: "Elecmon",
        targetName: "에레키몬",
        conditions: { careMistakes: { min: 4 } },
      },
    ],
  },

  // Child (Rookie) — 파피몬 (Gabumon)
  Gabumon: {
    id: "Gabumon",
    name: "파피몬",
    stage: "Child",
    sprite: 256,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "20:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Kabuterimon",
        targetName: "캅테리몬",
        conditions: { careMistakes: { max: 3 }, trainings: { min: 48 } },
      },
      {
        targetId: "Angemon",
        targetName: "엔젤몬",
        conditions: { careMistakes: { max: 3 }, trainings: { max: 47 } },
      },
      {
        targetId: "Garurumon",
        targetName: "가루몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 5, max: 31 },
          overfeeds: { min: 3 },
          sleepDisturbances: { min: 4, max: 5 },
        },
      },
      {
        targetId: "Frigimon",
        targetName: "프리지몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
          overfeeds: { min: 3 },
          sleepDisturbances: { min: 6 },
        },
      },
      {
        targetId: "Vegiemon",
        targetName: "베지몬",
        conditionGroups: [
          { careMistakes: { min: 4 }, trainings: { max: 4 } },
          { careMistakes: { min: 4 }, overfeeds: { max: 2 } },
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 31 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 3 } },
          { careMistakes: { min: 4 }, trainings: { min: 5, max: 31 }, overfeeds: { min: 3 }, sleepDisturbances: { min: 6 } },
          { careMistakes: { min: 4 }, trainings: { min: 32 }, overfeeds: { min: 3 }, sleepDisturbances: { max: 5 } },
        ],
      },
    ],
  },

  // Child (Rookie) — 에레키몬 (Elecmon)
  Elecmon: {
    id: "Elecmon",
    name: "에레키몬",
    stage: "Child",
    sprite: 271,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 25,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "21:00",
      attackSprite: 5,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Angemon",
        targetName: "엔젤몬",
        conditions: { careMistakes: { max: 3 }, trainings: { min: 48 } },
      },
      {
        targetId: "Birdramon",
        targetName: "버드라몬",
        conditions: { careMistakes: { max: 3 }, trainings: { max: 47 } },
      },
      {
        targetId: "Frigimon",
        targetName: "프리지몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 8, max: 31 },
          overfeeds: { max: 5 },
          sleepDisturbances: { min: 6 },
        },
      },
      {
        targetId: "Whamon",
        targetName: "고래몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
          overfeeds: { min: 6 },
          sleepDisturbances: { min: 4 },
        },
      },
      {
        targetId: "Vegiemon",
        targetName: "베지몬",
        conditionGroups: [
          { careMistakes: { min: 4 }, trainings: { max: 7 } },
          { careMistakes: { min: 4 }, trainings: { min: 32 } },
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, overfeeds: { min: 6 }},
          { careMistakes: { min: 4 }, trainings: { min: 32 }, sleepDisturbances: { max :4 } },
          { careMistakes: { min: 4 }, trainings: { min: 8, max: 31 }, sleepDisturbances: { max: 5 } },
        ],
      },
    ],
  },

  // Adult (Champion) — 캅테리몬 (Kabuterimon)
  Kabuterimon: {
    id: "Kabuterimon",
    name: "캅테리몬",
    stage: "Adult",
    sprite: 286,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 엔젤몬 (Angemon)
  Angemon: {
    id: "Angemon",
    name: "엔젤몬",
    stage: "Adult",
    sprite: 316,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "24:00",
      attackSprite: 51,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 버드라몬 (Birdramon)
  Birdramon: {
    id: "Birdramon",
    name: "버드라몬",
    stage: "Adult",
    sprite: 346,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 6,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullGreymon",
        targetName: "스컬그레이몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 베지몬 (Vegiemon)
  Vegiemon: {
    id: "Vegiemon",
    name: "베지몬",
    stage: "Adult",
    sprite: 376,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 28,
      strengthCycle: 28,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "Vademon",
        targetName: "베이더몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 가루몬 (Garurumon)
  Garurumon: {
    id: "Garurumon",
    name: "가루몬",
    stage: "Adult",
    sprite: 301,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "22:00",
      attackSprite: 4,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "MetalMammemon",
        targetName: "메탈콩알몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 프리지몬 (Frigimon)
  Frigimon: {
    id: "Frigimon",
    name: "프리지몬",
    stage: "Adult",
    sprite: 331,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Data",
      sleepTime: "00:00",
      attackSprite: 17,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "MetalMammemon",
        targetName: "메탈콩알몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Adult (Champion) — 고래몬 (Whamon)
  Whamon: {
    id: "Whamon",
    name: "고래몬",
    stage: "Adult",
    sprite: 361,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 38,
      strengthCycle: 38,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 15,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "MetalMammemon",
        targetName: "메탈콩알몬",
        conditions: { battles: { min: 15 }, winRatio: { min: 80 } },
      },
    ],
  },

  // Perfect (Ultimate) — 스컬그레이몬 (SkullGreymon)
  SkullGreymon: {
    id: "SkullGreymon",
    name: "스컬그레이몬",
    stage: "Perfect",
    sprite: 391,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "20:00",
      attackSprite: 11,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "SkullMammon",
        targetName: "스컬맘몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Perfect (Ultimate) — 메탈콩알몬 (MetalMamemon)
  MetalMammemon: {
    id: "MetalMammemon",
    name: "메탈콩알몬",
    stage: "Perfect",
    sprite: 406,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Data",
      sleepTime: "21:00",
      attackSprite: 23,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "CresGarurumonV2",
        targetName: "크레스가루루몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Perfect (Ultimate) — 베이더몬 (Vademon)
  Vademon: {
    id: "Vademon",
    name: "베이더몬",
    stage: "Perfect",
    sprite: 421,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 5,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 8,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
      mistakes: { max: 1 },
      battles: 15,
      winRatio: 80,
    },
    evolutions: [
      {
        targetId: "Ebemon",
        targetName: "이바몬",
        conditions: {
          careMistakes: { max: 1 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  },

  // Ultimate
  Ebemon: {
    id: "Ebemon",
    name: "이바몬",
    stage: "Ultimate",
    sprite: 466,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 49,
    },
    evolutionCriteria: {
      jogress: true,
    },
    evolutions: [    ],
  },

  // Ultimate — 스컬맘몬 (SkullMammon)
  SkullMammon: {
    id: "SkullMammon",
    name: "스컬맘몬",
    stage: "Ultimate",
    sprite: 436,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 48,
      strengthCycle: 48,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 52,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Ultimate — 크레스가루루몬 (CresGarurumon)
  CresGarurumonV2: {
    id: "CresGarurumonV2",
    name: "크레스가루루몬 Ver.2",
    stage: "Ultimate",
    sprite: 451,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 59,
      strengthCycle: 59,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 5,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 116,
    },
    evolutionCriteria: null,
    evolutions: [
      {
        targetId: "OmegamonAlterSV2",
        targetName: "오메가몬 Alter-S",
        jogress: { partner: "BlitzGreymonV1" },
      },
    ],
  },

  // Super Ultimate
  OmegamonAlterSV2: {
    id: "OmegamonAlterSV2",
    name: "오메가몬 Alter-S(Ver.2)",
    stage: "Super Ultimate",
    sprite: 211,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 66,
      strengthCycle: 66,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 31,
    },
    evolutionCriteria: null,
    evolutions: [],
  },

  // Ultimate — Jogress 파트너 (크레스가루루몬 / CresGarurumon)
  BlitzGreymonV2: {
    id: "BlitzGreymonV2forJogress",
    name: "블리츠그레이몬 Ver.2 (for Jogress)",
    stage: "Ultimate",
    sprite: 210,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 120,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 1,
      type: null,
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: null,
    evolutions: [],
  },
};

;// ./src/data/v2modkor/index.js
// src/data/v2modkor/index.js
// Ver.2 디지몬 데이터 버전 관리 — v1과 동일 스키마 + spriteBasePath



;// ./src/data/v3/digimons.js
// src/data/v3/digimons.js
// Digital Monster Color Ver.3 골격 데이터
// 주의:
// - 진화 구조/파워/주요 분기 조건은 Ver.3 계열 자료를 바탕으로 정리했습니다.
// - sprite 값은 로컬 자산 정합 작업 전까지 임시 번호입니다.
// - 이후 Ver.3 전용 스프라이트가 정리되면 PROVISIONAL_V3_SPRITES만 교체하면 됩니다.

const V3_SPRITE_BASE = "/Ver3_Mod_TH";

const PROVISIONAL_V3_SPRITES = {
  Ohakadamon1V3: 159,
  Ohakadamon2V3: 160,
  DigitamaV3: 133,
  Poyomon: 210,
  Tokomon: 225,
  Patamon: 240,
  Kunemon: 255,
  Unimon: 270,
  Centaurmon: 285,
  Ogremon: 300,
  Bakemon: 315,
  Shellmon: 345,
  Drimogemon: 330,
  Scumon: 360,
  Andromon: 375,
  Giromon: 390,
  Etemon: 405,
  Chimairamon: 421,
  HiAndromon: 436,
  Gokumon: 451,
  BanchoLeomon: 466,
  Chaosmon: 481,
  Millenniumon: 496,
};

function buildEntry({
  id,
  name,
  stage,
  sprite,
  stats,
  evolutionCriteria = null,
  evolutions = [],
}) {
  return {
    id,
    name,
    stage,
    sprite,
    spriteBasePath: V3_SPRITE_BASE,
    stats,
    evolutionCriteria,
    evolutions,
  };
}

function buildStats({
  hungerCycle,
  strengthCycle,
  poopCycle = 120,
  maxOverfeed,
  basePower,
  maxEnergy,
  minWeight,
  healDoses,
  type,
  sleepTime,
  attackSprite,
}) {
  return {
    hungerCycle,
    strengthCycle,
    poopCycle,
    maxOverfeed,
    basePower,
    maxEnergy,
    minWeight,
    healDoses,
    type,
    sleepTime,
    attackSprite,
  };
}

const ADULT_FALLBACK_EVOLUTION = {
  targetId: "Chimairamon",
  targetName: "키메라몬",
};

function buildAdultEvolutions() {
  return [
    {
      targetId: "Giromon",
      targetName: "기로몬",
      conditions: {
        careMistakes: { min: 1, max: 4 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    {
      targetId: "Andromon",
      targetName: "안드로몬",
      conditions: {
        careMistakes: { max: 0 },
        trainings: { min: 15 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    {
      targetId: "Etemon",
      targetName: "에테몬",
      conditions: {
        careMistakes: { max: 0 },
        trainings: { max: 14 },
        battles: { min: 15 },
        winRatio: { min: 80 },
      },
    },
    ADULT_FALLBACK_EVOLUTION,
  ];
}

const digimonDataVer3 = {
  Ohakadamon1V3: buildEntry({
    id: "Ohakadamon1V3",
    name: "사망(일반 Ver.3)",
    stage: "Ohakadamon",
    sprite: PROVISIONAL_V3_SPRITES.Ohakadamon1V3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
  }),

  Ohakadamon2V3: buildEntry({
    id: "Ohakadamon2V3",
    name: "사망(perfect Ver.3)",
    stage: "Ohakadamon",
    sprite: PROVISIONAL_V3_SPRITES.Ohakadamon2V3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 0,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
  }),

  DigitamaV3: buildEntry({
    id: "DigitamaV3",
    name: "디지타마 Ver.3",
    stage: "Digitama",
    sprite: PROVISIONAL_V3_SPRITES.DigitamaV3,
    stats: buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [{ targetId: "Poyomon", targetName: "포요몬" }],
  }),

  Poyomon: buildEntry({
    id: "Poyomon",
    name: "포요몬",
    stage: "Baby I",
    sprite: PROVISIONAL_V3_SPRITES.Poyomon,
    stats: buildStats({
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: 1,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [{ targetId: "Tokomon", targetName: "토코몬" }],
  }),

  Tokomon: buildEntry({
    id: "Tokomon",
    name: "토코몬",
    stage: "Baby II",
    sprite: PROVISIONAL_V3_SPRITES.Tokomon,
    stats: buildStats({
      hungerCycle: 30,
      strengthCycle: 30,
      poopCycle: 60,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 10,
      minWeight: 10,
      healDoses: 1,
      type: "Free",
      sleepTime: "20:00",
      attackSprite: 7,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Patamon",
        targetName: "파타몬",
        conditions: { careMistakes: { max: 2 } },
      },
      {
        targetId: "Kunemon",
        targetName: "쿠네몬",
        conditions: { careMistakes: { min: 3 } },
      },
    ],
  }),

  Patamon: buildEntry({
    id: "Patamon",
    name: "파타몬",
    stage: "Child",
    sprite: PROVISIONAL_V3_SPRITES.Patamon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "20:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Unimon",
        targetName: "유니몬",
        conditions: {
          careMistakes: { max: 2 },
          trainings: { min: 15 },
        },
      },
      {
        targetId: "Ogremon",
        targetName: "오거몬",
        conditions: {
          careMistakes: { max: 2 },
          trainings: { max: 14 },
        },
      },
      {
        targetId: "Shellmon",
        targetName: "쉘몬",
        conditions: {
          careMistakes: { min: 3 },
        },
      },
    ],
  }),

  Kunemon: buildEntry({
    id: "Kunemon",
    name: "쿠네몬",
    stage: "Child",
    sprite: PROVISIONAL_V3_SPRITES.Kunemon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 25,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 5,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Scumon",
        targetName: "스카몬",
        conditions: {
          careMistakes: { min: 3 },
          trainings: { max: 4 },
        },
      },
      {
        targetId: "Centaurmon",
        targetName: "켄타루몬",
        conditions: {
          careMistakes: { min: 3 },
          trainings: { min: 5, max: 11 },
          overfeeds: { max: 1 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Bakemon",
        targetName: "바케몬",
        conditionGroups: [
          {
            careMistakes: { min: 3 },
            trainings: { min: 12 },
          },
          {
            careMistakes: { min: 3 },
            trainings: { min: 5, max: 11 },
            overfeeds: { min: 2 },
          },
          {
            careMistakes: { min: 3 },
            trainings: { min: 5, max: 11 },
            sleepDisturbances: { min: 5 },
          },
        ],
      },
    ],
  }),

  Unimon: buildEntry({
    id: "Unimon",
    name: "유니몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Unimon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Centaurmon: buildEntry({
    id: "Centaurmon",
    name: "켄타루몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Centaurmon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Ogremon: buildEntry({
    id: "Ogremon",
    name: "오거몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Ogremon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 51,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Bakemon: buildEntry({
    id: "Bakemon",
    name: "바케몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Bakemon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Shellmon: buildEntry({
    id: "Shellmon",
    name: "쉘몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Shellmon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Drimogemon: buildEntry({
    id: "Drimogemon",
    name: "드리모게몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Drimogemon,
    stats: buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Scumon: buildEntry({
    id: "Scumon",
    name: "스카몬",
    stage: "Adult",
    sprite: PROVISIONAL_V3_SPRITES.Scumon,
    stats: buildStats({
      hungerCycle: 28,
      strengthCycle: 28,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: buildAdultEvolutions(),
  }),

  Andromon: buildEntry({
    id: "Andromon",
    name: "안드로몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Andromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "20:00",
      attackSprite: 11,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "HiAndromon",
        targetName: "하이안드로몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Giromon: buildEntry({
    id: "Giromon",
    name: "기로몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Giromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "HiAndromon",
        targetName: "하이안드로몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Etemon: buildEntry({
    id: "Etemon",
    name: "에테몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Etemon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 23,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "BanchoLeomon",
        targetName: "반쵸레오몬",
        conditions: {
          careMistakes: { max: 2 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
      {
        targetId: "Gokumon",
        targetName: "고쿠몬",
        conditions: {
          careMistakes: { min: 3, max: 4 },
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Chimairamon: buildEntry({
    id: "Chimairamon",
    name: "키메라몬",
    stage: "Perfect",
    sprite: PROVISIONAL_V3_SPRITES.Chimairamon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Millenniumon",
        targetName: "밀레니엄몬",
        jogress: {
          partner: "Mugendramon",
          partnerName: "무겐드라몬",
          partnerVersion: "Ver.5",
        },
      },
    ],
  }),

  HiAndromon: buildEntry({
    id: "HiAndromon",
    name: "하이안드로몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.HiAndromon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Gokumon: buildEntry({
    id: "Gokumon",
    name: "고쿠몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Gokumon,
    stats: buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),

  BanchoLeomon: buildEntry({
    id: "BanchoLeomon",
    name: "반쵸레오몬",
    stage: "Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.BanchoLeomon,
    stats: buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 180,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
    evolutionCriteria: null,
    evolutions: [
      {
        targetId: "Chaosmon",
        targetName: "카오스몬",
        jogress: {
          partner: "Darkdramon",
          partnerName: "다크드라몬",
          partnerVersion: "Ver.4",
        },
      },
    ],
  }),

  Chaosmon: buildEntry({
    id: "Chaosmon",
    name: "카오스몬",
    stage: "Super Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Chaosmon,
    stats: buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Millenniumon: buildEntry({
    id: "Millenniumon",
    name: "밀레니엄몬",
    stage: "Super Ultimate",
    sprite: PROVISIONAL_V3_SPRITES.Millenniumon,
    stats: buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),
};

;// ./src/data/v3/index.js
// src/data/v3/index.js



;// ./src/data/v4/digimons.js
// src/data/v4/digimons.js
// Digital Monster Color Ver.4 데이터
// 주의:
// - 진화 조건은 Humulos / Wikimon / 원작 차트 기준으로 정리했습니다.
// - 스프라이트는 공식 Individual Sprites를 우선 사용하고, 누락 자산은 placeholder로 유지합니다.

const V4_SPRITE_BASE = "/Ver4_Mod_TH";

const V4_SPRITES = {
  Placeholder: 0,
  DigitamaV4: 133,
  Ohakadamon1V4: 159,
  Ohakadamon2V4: 160,
  Yuramon: 210,
  Tanemon: 225,
  Piyomon: 240,
  Palmon: 255,
  Monochromon: 270,
  Kokatorimon: 285,
  Leomon: 300,
  Kuwagamon: 315,
  Coelamon: 330,
  Mojyamon: 345,
  Nanimon: 360,
  Ultimatedramon: 375,
  Piccolomon: 390,
  Digitamamon: 405,
  Darkdramon: 420,
  BloomLordmon: 435,
  Gankoomon: 450,
  Chaosmon: 465,
  Chaosdramon: 480,
};

function digimons_buildEntry({
  id,
  name,
  stage,
  sprite,
  stats,
  evolutionCriteria = null,
  evolutions = [],
}) {
  return {
    id,
    name,
    stage,
    sprite,
    spriteBasePath: V4_SPRITE_BASE,
    stats,
    evolutionCriteria,
    evolutions,
  };
}

function digimons_buildStats({
  hungerCycle,
  strengthCycle,
  poopCycle = 120,
  maxOverfeed,
  basePower,
  maxEnergy,
  minWeight,
  healDoses,
  type,
  sleepTime,
  attackSprite,
}) {
  return {
    hungerCycle,
    strengthCycle,
    poopCycle,
    maxOverfeed,
    basePower,
    maxEnergy,
    minWeight,
    healDoses,
    type,
    sleepTime,
    attackSprite,
  };
}

function buildNeutralStats() {
  return digimons_buildStats({
    hungerCycle: 0,
    strengthCycle: 0,
    poopCycle: 0,
    maxOverfeed: 0,
    basePower: 0,
    maxEnergy: 0,
    minWeight: 0,
    healDoses: 0,
    type: null,
    sleepTime: null,
    attackSprite: null,
  });
}

const digimonDataVer4 = {
  Ohakadamon1V4: digimons_buildEntry({
    id: "Ohakadamon1V4",
    name: "사망(일반 Ver.4)",
    stage: "Ohakadamon",
    sprite: V4_SPRITES.Ohakadamon1V4,
    stats: buildNeutralStats(),
  }),

  Ohakadamon2V4: digimons_buildEntry({
    id: "Ohakadamon2V4",
    name: "사망(perfect Ver.4)",
    stage: "Ohakadamon",
    sprite: V4_SPRITES.Ohakadamon2V4,
    stats: buildNeutralStats(),
  }),

  DigitamaV4: digimons_buildEntry({
    id: "DigitamaV4",
    name: "디지타마 Ver.4",
    stage: "Digitama",
    sprite: V4_SPRITES.DigitamaV4,
    stats: digimons_buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [{ targetId: "Yuramon", targetName: "유라몬" }],
  }),

  Yuramon: digimons_buildEntry({
    id: "Yuramon",
    name: "유라몬",
    stage: "Baby I",
    sprite: V4_SPRITES.Yuramon,
    stats: digimons_buildStats({
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: 1,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [{ targetId: "Tanemon", targetName: "타네몬" }],
  }),

  Tanemon: digimons_buildEntry({
    id: "Tanemon",
    name: "타네몬",
    stage: "Baby II",
    sprite: V4_SPRITES.Tanemon,
    stats: digimons_buildStats({
      hungerCycle: 30,
      strengthCycle: 30,
      poopCycle: 60,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 10,
      minWeight: 10,
      healDoses: 1,
      type: "Free",
      sleepTime: "20:00",
      attackSprite: 7,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Piyomon",
        targetName: "피요몬",
        conditions: { careMistakes: { max: 4 } },
      },
      {
        targetId: "Palmon",
        targetName: "팔몬",
        conditions: { careMistakes: { min: 5 } },
      },
    ],
  }),

  Piyomon: digimons_buildEntry({
    id: "Piyomon",
    name: "피요몬",
    stage: "Child",
    sprite: V4_SPRITES.Piyomon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Vaccine",
      sleepTime: "20:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Monochromon",
        targetName: "모노크로몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Kokatorimon",
        targetName: "코카트리몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Leomon",
        targetName: "레오몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Kuwagamon",
        targetName: "쿠와가몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
        },
      },
    ],
  }),

  Palmon: digimons_buildEntry({
    id: "Palmon",
    name: "팔몬",
    stage: "Child",
    sprite: V4_SPRITES.Palmon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "20:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Leomon",
        targetName: "레오몬",
        conditions: {
          trainings: { min: 5, max: 23 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Kuwagamon",
        targetName: "쿠와가몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Coelamon",
        targetName: "코엘라몬",
        conditions: {
          trainings: { max: 23 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 3 },
        },
      },
      {
        targetId: "Mojyamon",
        targetName: "모쟈몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Nanimon",
        targetName: "나니몬",
      },
    ],
  }),

  Monochromon: digimons_buildEntry({
    id: "Monochromon",
    name: "모노크로몬",
    stage: "Adult",
    sprite: V4_SPRITES.Monochromon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Data",
      sleepTime: "21:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Ultimatedramon",
        targetName: "얼티메이트드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Kokatorimon: digimons_buildEntry({
    id: "Kokatorimon",
    name: "코카트리몬",
    stage: "Adult",
    sprite: V4_SPRITES.Kokatorimon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Ultimatedramon",
        targetName: "얼티메이트드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Leomon: digimons_buildEntry({
    id: "Leomon",
    name: "레오몬",
    stage: "Adult",
    sprite: V4_SPRITES.Leomon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "21:00",
      attackSprite: 4,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Piccolomon",
        targetName: "피콜로몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Kuwagamon: digimons_buildEntry({
    id: "Kuwagamon",
    name: "쿠와가몬",
    stage: "Adult",
    sprite: V4_SPRITES.Kuwagamon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Piccolomon",
        targetName: "피콜로몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Coelamon: digimons_buildEntry({
    id: "Coelamon",
    name: "코엘라몬",
    stage: "Adult",
    sprite: V4_SPRITES.Coelamon,
    stats: digimons_buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Mojyamon: digimons_buildEntry({
    id: "Mojyamon",
    name: "모쟈몬",
    stage: "Adult",
    sprite: V4_SPRITES.Mojyamon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Data",
      sleepTime: "22:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Nanimon: digimons_buildEntry({
    id: "Nanimon",
    name: "나니몬",
    stage: "Adult",
    sprite: V4_SPRITES.Nanimon,
    stats: digimons_buildStats({
      hungerCycle: 28,
      strengthCycle: 28,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Digitamamon",
        targetName: "디지타마몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Ultimatedramon: digimons_buildEntry({
    id: "Ultimatedramon",
    name: "얼티메이트드라몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Ultimatedramon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 80,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 23,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Darkdramon",
        targetName: "다크드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Piccolomon: digimons_buildEntry({
    id: "Piccolomon",
    name: "피콜로몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Piccolomon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 75,
      maxEnergy: 40,
      minWeight: 30,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Gankoomon",
        targetName: "강쿠몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Digitamamon: digimons_buildEntry({
    id: "Digitamamon",
    name: "디지타마몬",
    stage: "Perfect",
    sprite: V4_SPRITES.Digitamamon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "BloomLordmon",
        targetName: "블룸로드몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Darkdramon: digimons_buildEntry({
    id: "Darkdramon",
    name: "다크드라몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.Darkdramon,
    stats: digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 120,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
    evolutions: [
      {
        targetId: "Chaosmon",
        targetName: "카오스몬",
        jogress: {
          partner: "BanchoLeomon",
          partnerName: "반쵸레오몬",
          partnerVersion: "Ver.3",
        },
      },
      {
        targetId: "Chaosdramon",
        targetName: "카오스드라몬",
        jogress: {
          partner: "Mugendramon",
          partnerName: "무겐드라몬",
          partnerVersion: "Ver.5",
        },
      },
    ],
  }),

  BloomLordmon: digimons_buildEntry({
    id: "BloomLordmon",
    name: "블룸로드몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.BloomLordmon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 130,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Data",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Gankoomon: digimons_buildEntry({
    id: "Gankoomon",
    name: "강쿠몬",
    stage: "Ultimate",
    sprite: V4_SPRITES.Gankoomon,
    stats: digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 140,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
  }),

  Chaosmon: digimons_buildEntry({
    id: "Chaosmon",
    name: "카오스몬",
    stage: "Super Ultimate",
    sprite: V4_SPRITES.Chaosmon,
    stats: digimons_buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
  }),

  Chaosdramon: digimons_buildEntry({
    id: "Chaosdramon",
    name: "카오스드라몬",
    stage: "Super Ultimate",
    sprite: V4_SPRITES.Chaosdramon,
    stats: digimons_buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),
};

;// ./src/data/v4/index.js
// src/data/v4/index.js



;// ./src/data/v5/digimons.js
// src/data/v5/digimons.js
// Digital Monster Color Ver.5 데이터
// 주의:
// - 진화 조건은 Humulos / Wikimon / 원작 차트 기준으로 정리했습니다.
// - 스프라이트는 공식 Individual Sprites를 우선 사용하고, 누락 자산은 placeholder로 유지합니다.

const V5_SPRITE_BASE = "/Ver5_Mod_TH";

const V5_SPRITES = {
  Placeholder: 0,
  DigitamaV5: 133,
  Ohakadamon1V5: 159,
  Ohakadamon2V5: 160,
  Zurumon: 210,
  Pagumon: 225,
  Gazimon: 240,
  Gizamon: 255,
  DarkTyranomon: 270,
  Cyclomon: 285,
  Devidramon: 300,
  Tuskmon: 315,
  Flymon: 330,
  Deltamon: 345,
  Raremon: 360,
  MetalTyranomon: 375,
  Nanomon: 390,
  ExTyranomon: 405,
  Mugendramon: 420,
  Raidenmon: 435,
  Gaioumon: 450,
  Millenniumon: 465,
  Chaosdramon: 480,
};

function v5_digimons_buildEntry({
  id,
  name,
  stage,
  sprite,
  stats,
  evolutionCriteria = null,
  evolutions = [],
}) {
  return {
    id,
    name,
    stage,
    sprite,
    spriteBasePath: V5_SPRITE_BASE,
    stats,
    evolutionCriteria,
    evolutions,
  };
}

function v5_digimons_buildStats({
  hungerCycle,
  strengthCycle,
  poopCycle = 120,
  maxOverfeed,
  basePower,
  maxEnergy,
  minWeight,
  healDoses,
  type,
  sleepTime,
  attackSprite,
}) {
  return {
    hungerCycle,
    strengthCycle,
    poopCycle,
    maxOverfeed,
    basePower,
    maxEnergy,
    minWeight,
    healDoses,
    type,
    sleepTime,
    attackSprite,
  };
}

function digimons_buildNeutralStats() {
  return v5_digimons_buildStats({
    hungerCycle: 0,
    strengthCycle: 0,
    poopCycle: 0,
    maxOverfeed: 0,
    basePower: 0,
    maxEnergy: 0,
    minWeight: 0,
    healDoses: 0,
    type: null,
    sleepTime: null,
    attackSprite: null,
  });
}

const digimonDataVer5 = {
  Ohakadamon1V5: v5_digimons_buildEntry({
    id: "Ohakadamon1V5",
    name: "사망(일반 Ver.5)",
    stage: "Ohakadamon",
    sprite: V5_SPRITES.Ohakadamon1V5,
    stats: digimons_buildNeutralStats(),
  }),

  Ohakadamon2V5: v5_digimons_buildEntry({
    id: "Ohakadamon2V5",
    name: "사망(perfect Ver.5)",
    stage: "Ohakadamon",
    sprite: V5_SPRITES.Ohakadamon2V5,
    stats: digimons_buildNeutralStats(),
  }),

  DigitamaV5: v5_digimons_buildEntry({
    id: "DigitamaV5",
    name: "디지타마 Ver.5",
    stage: "Digitama",
    sprite: V5_SPRITES.DigitamaV5,
    stats: v5_digimons_buildStats({
      hungerCycle: 0,
      strengthCycle: 0,
      poopCycle: 999,
      maxOverfeed: 0,
      basePower: 0,
      maxEnergy: 0,
      minWeight: 0,
      healDoses: 0,
      type: null,
      sleepTime: null,
      attackSprite: null,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 8,
    },
    evolutions: [{ targetId: "Zurumon", targetName: "주루몬" }],
  }),

  Zurumon: v5_digimons_buildEntry({
    id: "Zurumon",
    name: "주루몬",
    stage: "Baby I",
    sprite: V5_SPRITES.Zurumon,
    stats: v5_digimons_buildStats({
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: 1,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [{ targetId: "Pagumon", targetName: "파구몬" }],
  }),

  Pagumon: v5_digimons_buildEntry({
    id: "Pagumon",
    name: "파구몬",
    stage: "Baby II",
    sprite: V5_SPRITES.Pagumon,
    stats: v5_digimons_buildStats({
      hungerCycle: 30,
      strengthCycle: 30,
      poopCycle: 60,
      maxOverfeed: 2,
      basePower: 0,
      maxEnergy: 10,
      minWeight: 10,
      healDoses: 1,
      type: "Free",
      sleepTime: "20:00",
      attackSprite: 7,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 43200,
    },
    evolutions: [
      {
        targetId: "Gazimon",
        targetName: "가즈몬",
        conditions: { careMistakes: { max: 4 } },
      },
      {
        targetId: "Gizamon",
        targetName: "기자몬",
        conditions: { careMistakes: { min: 5 } },
      },
    ],
  }),

  Gazimon: v5_digimons_buildEntry({
    id: "Gazimon",
    name: "가즈몬",
    stage: "Child",
    sprite: V5_SPRITES.Gazimon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 4,
      basePower: 30,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 5,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "DarkTyranomon",
        targetName: "다크티라노몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Cyclomon",
        targetName: "사이클론몬",
        conditions: {
          careMistakes: { max: 3 },
          trainings: { min: 32 },
        },
      },
      {
        targetId: "Devidramon",
        targetName: "데비드라몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { max: 31 },
        },
      },
      {
        targetId: "Tuskmon",
        targetName: "터스크몬",
        conditions: {
          careMistakes: { min: 4 },
          trainings: { min: 32 },
        },
      },
    ],
  }),

  Gizamon: v5_digimons_buildEntry({
    id: "Gizamon",
    name: "기자몬",
    stage: "Child",
    sprite: V5_SPRITES.Gizamon,
    stats: v5_digimons_buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 25,
      maxEnergy: 20,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "21:00",
      attackSprite: 5,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 86400,
    },
    evolutions: [
      {
        targetId: "Devidramon",
        targetName: "데비드라몬",
        conditions: {
          trainings: { min: 5, max: 23 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Tuskmon",
        targetName: "터스크몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 2 },
          sleepDisturbances: { max: 4 },
        },
      },
      {
        targetId: "Flymon",
        targetName: "플라이몬",
        conditions: {
          trainings: { max: 23 },
          overfeeds: { max: 3 },
          sleepDisturbances: { min: 3 },
        },
      },
      {
        targetId: "Deltamon",
        targetName: "델타몬",
        conditions: {
          trainings: { min: 24 },
          overfeeds: { min: 4 },
          sleepDisturbances: { max: 2 },
        },
      },
      {
        targetId: "Raremon",
        targetName: "레어몬",
      },
    ],
  }),

  DarkTyranomon: v5_digimons_buildEntry({
    id: "DarkTyranomon",
    name: "다크티라노몬",
    stage: "Adult",
    sprite: V5_SPRITES.DarkTyranomon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 51,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "MetalTyranomon",
        targetName: "메탈티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Cyclomon: v5_digimons_buildEntry({
    id: "Cyclomon",
    name: "사이클론몬",
    stage: "Adult",
    sprite: V5_SPRITES.Cyclomon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "MetalTyranomon",
        targetName: "메탈티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Devidramon: v5_digimons_buildEntry({
    id: "Devidramon",
    name: "데비드라몬",
    stage: "Adult",
    sprite: V5_SPRITES.Devidramon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 17,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Nanomon",
        targetName: "나노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Tuskmon: v5_digimons_buildEntry({
    id: "Tuskmon",
    name: "터스크몬",
    stage: "Adult",
    sprite: V5_SPRITES.Tuskmon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 30,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 6,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "Nanomon",
        targetName: "나노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Flymon: v5_digimons_buildEntry({
    id: "Flymon",
    name: "플라이몬",
    stage: "Adult",
    sprite: V5_SPRITES.Flymon,
    stats: v5_digimons_buildStats({
      hungerCycle: 38,
      strengthCycle: 38,
      maxOverfeed: 2,
      basePower: 50,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 15,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Deltamon: v5_digimons_buildEntry({
    id: "Deltamon",
    name: "델타몬",
    stage: "Adult",
    sprite: V5_SPRITES.Deltamon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 45,
      maxEnergy: 30,
      minWeight: 20,
      healDoses: 2,
      type: "Virus",
      sleepTime: "22:00",
      attackSprite: 8,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Raremon: v5_digimons_buildEntry({
    id: "Raremon",
    name: "레어몬",
    stage: "Adult",
    sprite: V5_SPRITES.Raremon,
    stats: v5_digimons_buildStats({
      hungerCycle: 28,
      strengthCycle: 28,
      maxOverfeed: 2,
      basePower: 40,
      maxEnergy: 30,
      minWeight: 10,
      healDoses: 3,
      type: "Virus",
      sleepTime: "00:00",
      attackSprite: 16,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 129600,
    },
    evolutions: [
      {
        targetId: "ExTyranomon",
        targetName: "엑스티라노몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  MetalTyranomon: v5_digimons_buildEntry({
    id: "MetalTyranomon",
    name: "메탈티라노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.MetalTyranomon,
    stats: v5_digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 23,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Mugendramon",
        targetName: "무겐드라몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Nanomon: v5_digimons_buildEntry({
    id: "Nanomon",
    name: "나노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.Nanomon,
    stats: v5_digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 85,
      maxEnergy: 40,
      minWeight: 20,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 31,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Raidenmon",
        targetName: "라이덴몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  ExTyranomon: v5_digimons_buildEntry({
    id: "ExTyranomon",
    name: "엑스티라노몬",
    stage: "Perfect",
    sprite: V5_SPRITES.ExTyranomon,
    stats: v5_digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 100,
      maxEnergy: 40,
      minWeight: 40,
      healDoses: 1,
      type: "Vaccine",
      sleepTime: "23:00",
      attackSprite: 49,
    }),
    evolutionCriteria: {
      timeToEvolveSeconds: 172800,
    },
    evolutions: [
      {
        targetId: "Gaioumon",
        targetName: "가이오우몬",
        conditions: {
          battles: { min: 15 },
          winRatio: { min: 80 },
        },
      },
    ],
  }),

  Mugendramon: v5_digimons_buildEntry({
    id: "Mugendramon",
    name: "무겐드라몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Mugendramon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 170,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
    evolutions: [
      {
        targetId: "Millenniumon",
        targetName: "밀레니엄몬",
        jogress: {
          partner: "Chimairamon",
          partnerName: "키메라몬",
          partnerVersion: "Ver.3",
        },
      },
      {
        targetId: "Chaosdramon",
        targetName: "카오스드라몬",
        jogress: {
          partner: "Darkdramon",
          partnerName: "다크드라몬",
          partnerVersion: "Ver.4",
        },
      },
    ],
  }),

  Raidenmon: v5_digimons_buildEntry({
    id: "Raidenmon",
    name: "라이덴몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Raidenmon,
    stats: v5_digimons_buildStats({
      hungerCycle: 48,
      strengthCycle: 48,
      maxOverfeed: 2,
      basePower: 150,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 2,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),

  Gaioumon: v5_digimons_buildEntry({
    id: "Gaioumon",
    name: "가이오우몬",
    stage: "Ultimate",
    sprite: V5_SPRITES.Gaioumon,
    stats: v5_digimons_buildStats({
      hungerCycle: 59,
      strengthCycle: 59,
      maxOverfeed: 2,
      basePower: 180,
      maxEnergy: 50,
      minWeight: 50,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 116,
    }),
  }),

  Millenniumon: v5_digimons_buildEntry({
    id: "Millenniumon",
    name: "밀레니엄몬",
    stage: "Super Ultimate",
    sprite: V5_SPRITES.Millenniumon,
    stats: v5_digimons_buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),

  Chaosdramon: v5_digimons_buildEntry({
    id: "Chaosdramon",
    name: "카오스드라몬",
    stage: "Super Ultimate",
    sprite: V5_SPRITES.Chaosdramon,
    stats: v5_digimons_buildStats({
      hungerCycle: 66,
      strengthCycle: 66,
      maxOverfeed: 2,
      basePower: 200,
      maxEnergy: 50,
      minWeight: 40,
      healDoses: 1,
      type: "Virus",
      sleepTime: "23:00",
      attackSprite: 52,
    }),
  }),
};

;// ./src/data/v5/index.js
// src/data/v5/index.js



;// ./src/utils/digimonVersionUtils.js






const VERSION_CONFIGS = {
  "Ver.1": {
    key: "ver1",
    label: "Ver.1",
    starterId: "Digitama",
    deathFormIds: ["Ohakadamon1", "Ohakadamon2"],
    spriteBasePath: "/images",
    dataMap: digimonDataVer1,
  },
  "Ver.2": {
    key: "ver2",
    label: "Ver.2",
    starterId: "DigitamaV2",
    deathFormIds: ["Ohakadamon1V2", "Ohakadamon2V2"],
    spriteBasePath: V2_SPRITE_BASE,
    dataMap: digimonDataVer2,
  },
  "Ver.3": {
    key: "ver3",
    label: "Ver.3",
    starterId: "DigitamaV3",
    deathFormIds: ["Ohakadamon1V3", "Ohakadamon2V3"],
    spriteBasePath: V3_SPRITE_BASE,
    dataMap: digimonDataVer3,
  },
  "Ver.4": {
    key: "ver4",
    label: "Ver.4",
    starterId: "DigitamaV4",
    deathFormIds: ["Ohakadamon1V4", "Ohakadamon2V4"],
    spriteBasePath: V4_SPRITE_BASE,
    dataMap: digimonDataVer4,
  },
  "Ver.5": {
    key: "ver5",
    label: "Ver.5",
    starterId: "DigitamaV5",
    deathFormIds: ["Ohakadamon1V5", "Ohakadamon2V5"],
    spriteBasePath: V5_SPRITE_BASE,
    dataMap: digimonDataVer5,
  },
};

const SUPPORTED_DIGIMON_VERSIONS = Object.freeze(
  Object.keys(VERSION_CONFIGS)
);

const SUPPORTED_MASTER_DATA_VERSION_KEYS = Object.freeze(
  SUPPORTED_DIGIMON_VERSIONS.map((version) => VERSION_CONFIGS[version].key)
);

const STARTER_DIGIMON_IDS = Object.freeze(
  SUPPORTED_DIGIMON_VERSIONS.map((version) => VERSION_CONFIGS[version].starterId)
);

function normalizeDigimonVersionLabel(version = "Ver.1") {
  return VERSION_CONFIGS[version] ? version : "Ver.1";
}

function getDigimonVersionConfig(version = "Ver.1") {
  return VERSION_CONFIGS[normalizeDigimonVersionLabel(version)];
}

function getDigimonVersionKey(version = "Ver.1") {
  return getDigimonVersionConfig(version).key;
}

function getDigimonVersionLabelByKey(versionKey = "ver1") {
  const entry = Object.values(VERSION_CONFIGS).find(
    (config) => config.key === versionKey
  );
  return entry?.label || "Ver.1";
}

function getDigimonDataMapByVersion(version = "Ver.1") {
  return getDigimonVersionConfig(version).dataMap;
}

function digimonVersionUtils_getStarterDigimonId(version = "Ver.1") {
  return getDigimonVersionConfig(version).starterId;
}

function digimonVersionUtils_getStarterDigimonIdFromDataMap(dataMap = {}) {
  return (
    STARTER_DIGIMON_IDS.find((starterId) => dataMap?.[starterId]) || "Digitama"
  );
}

function digimonVersionUtils_isStarterDigimonId(digimonId) {
  return STARTER_DIGIMON_IDS.includes(digimonId);
}

function getDeathFormIds(version = "Ver.1") {
  return [...getDigimonVersionConfig(version).deathFormIds];
}

function isDeathFormDigimonId(digimonId) {
  return SUPPORTED_DIGIMON_VERSIONS.some((version) =>
    VERSION_CONFIGS[version].deathFormIds.includes(digimonId)
  );
}

function getSpriteBasePathByVersion(version = "Ver.1") {
  return getDigimonVersionConfig(version).spriteBasePath;
}

function digimonVersionUtils_getDigimonVersionByDigimonId(digimonId) {
  if (!digimonId) {
    return "Ver.1";
  }

  const matchedVersion = SUPPORTED_DIGIMON_VERSIONS.find((version) =>
    Boolean(getDigimonDataMapByVersion(version)?.[digimonId])
  );

  return matchedVersion || "Ver.1";
}

function getDigimonEntryByVersion(version = "Ver.1", digimonId) {
  if (!digimonId) {
    return null;
  }

  return getDigimonDataMapByVersion(version)?.[digimonId] || null;
}

function getDigimonDataMapsByPreference(version = "Ver.1") {
  const normalizedVersion = normalizeDigimonVersionLabel(version);

  return [
    getDigimonDataMapByVersion(normalizedVersion),
    ...SUPPORTED_DIGIMON_VERSIONS.filter(
      (label) => label !== normalizedVersion
    ).map((label) => getDigimonDataMapByVersion(label)),
  ].filter(Boolean);
}

function findDigimonEntryAcrossVersions(
  digimonId,
  preferredVersion = "Ver.1"
) {
  if (!digimonId) {
    return null;
  }

  return (
    getDigimonDataMapsByPreference(preferredVersion)
      .map((dataMap) => {
        if (!dataMap) {
          return null;
        }

        if (dataMap[digimonId]) {
          return dataMap[digimonId];
        }

        return (
          Object.values(dataMap).find((entry) => entry?.id === digimonId) || null
        );
      })
      .find(Boolean) || null
  );
}

;// ./src/utils/digimonLogSnapshot.js


function normalizeMaps(maps = []) {
  return maps.flat().filter((map) => map && typeof map === "object");
}

function resolveDigimonLogName(digimonId, ...maps) {
  const normalizedId = typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedId) return null;

  for (const map of normalizeMaps(maps)) {
    const byKey = map[normalizedId]?.name;
    if (byKey) return byKey;

    const match = Object.values(map).find(
      (entry) => entry && (entry.id === normalizedId || entry.name === normalizedId)
    );
    if (match?.name) return match.name;
  }

  return normalizedId;
}

function resolveDigimonSnapshotFromToken(token, ...maps) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return { digimonId: null, digimonName: null };
  }

  for (const map of normalizeMaps(maps)) {
    if (map[normalizedToken]) {
      return {
        digimonId: normalizedToken,
        digimonName: map[normalizedToken]?.name || normalizedToken,
      };
    }

    const match = Object.entries(map).find(([, entry]) => {
      return entry && (entry.id === normalizedToken || entry.name === normalizedToken);
    });

    if (match) {
      const [key, entry] = match;
      return {
        digimonId: entry?.id || key,
        digimonName: entry?.name || normalizedToken,
      };
    }
  }

  return {
    digimonId: null,
    digimonName: normalizedToken,
  };
}

function sanitizeDigimonLogSnapshot(snapshot = {}) {
  const digimonId = typeof snapshot?.digimonId === "string" ? snapshot.digimonId.trim() : "";
  const digimonName =
    typeof snapshot?.digimonName === "string" ? snapshot.digimonName.trim() : "";

  return {
    ...(digimonId ? { digimonId } : {}),
    ...(digimonName ? { digimonName } : {}),
  };
}

function buildDigimonLogSnapshot(digimonId, ...maps) {
  const normalizedId = typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedId) return {};

  return sanitizeDigimonLogSnapshot({
    digimonId: normalizedId,
    digimonName: resolveDigimonLogName(normalizedId, ...maps),
  });
}

function getLifeStartDigimonId(slotVersion = "Ver.1", currentDigimonId = null) {
  const resolvedVersion =
    typeof slotVersion === "string" && slotVersion.trim()
      ? slotVersion
      : getDigimonVersionByDigimonId(currentDigimonId);

  return getStarterDigimonId(resolvedVersion);
}

;// ./src/logic/stats/careMistakeLedger.js


const CARE_MISTAKE_SYNC_TEXT = "[기록 동기화] 과거 케어미스 기록이 없어 카운터 기준으로 보정됨";

function careMistakeLedger_ensureTimestamp(value) {
  return time_toEpochMs(value);
}

function isSleepDisturbanceLike(log) {
  if (!log) return false;
  if (log.type === "SLEEP_DISTURBANCE") return true;
  const text = (log.text || "").trim();
  if (!text.includes("수면 방해")) return false;
  return log.type === "CARE_MISTAKE" || log.type === "CAREMISTAKE";
}

function isCareMistakeLog(log) {
  if (!log || isSleepDisturbanceLike(log)) return false;
  if (log.type === "CAREMISTAKE") return true;
  if (log.type === "CARE_MISTAKE") {
    const text = (log.text || "").trim();
    return text.includes("케어미스") || text.includes("Care Mistake");
  }
  return false;
}

function getCareMistakeReasonKeyFromText(text = "") {
  if (text.includes("배고픔 콜")) return "hunger_call";
  if (text.includes("힘 콜")) return "strength_call";
  if (text.includes("수면 조명 경고")) return "sleep_light_warning";
  if (text.includes("괴롭히기")) return "tease";
  if (text.includes("[기록 동기화]")) return "sync_repair";
  return "other";
}

function inferCareMistakeSource(text = "") {
  if (text.includes("[과거 재구성]")) return "backfill";
  if (text.includes("괴롭히기")) return "interaction";
  if (text.includes("[기록 동기화]")) return "sync";
  return "realtime";
}

function buildCareMistakeEventId(reasonKey, occurredAt) {
  const timestamp = careMistakeLedger_ensureTimestamp(occurredAt);
  return timestamp == null ? null : `${reasonKey}:${timestamp}`;
}

function getCareMistakeEventIdFromLog(log) {
  if (!isCareMistakeLog(log)) return null;
  const occurredAt = careMistakeLedger_ensureTimestamp(log.timestamp);
  if (occurredAt == null) return null;
  return buildCareMistakeEventId(getCareMistakeReasonKeyFromText(log.text || ""), occurredAt);
}

function normalizeLedgerEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const occurredAt = careMistakeLedger_ensureTimestamp(entry.occurredAt);
  if (occurredAt == null) return null;
  const reasonKey = entry.reasonKey || "other";
  return {
    id: entry.id || buildCareMistakeEventId(reasonKey, occurredAt),
    occurredAt,
    reasonKey,
    text: entry.text || "케어미스 발생",
    source: entry.source || inferCareMistakeSource(entry.text || ""),
    resolvedAt: careMistakeLedger_ensureTimestamp(entry.resolvedAt) ?? null,
    resolvedBy: entry.resolvedBy || null,
  };
}

function initializeCareMistakeLedger(existingLedger = []) {
  if (!Array.isArray(existingLedger)) return [];
  return existingLedger
    .map(normalizeLedgerEntry)
    .filter(Boolean)
    .sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));
}

function getActiveCareMistakeEntries(ledger = []) {
  return initializeCareMistakeLedger(ledger).filter((entry) => entry.resolvedAt == null);
}

function countActiveCareMistakeEntries(ledger = []) {
  return getActiveCareMistakeEntries(ledger).length;
}

function appendCareMistakeEntry(stats = {}, { occurredAt = Date.now(), reasonKey = "other", text = "케어미스 발생", source = "realtime", id = null } = {}) {
  const repairedStats = repairCareMistakeLedger(stats, stats.activityLogs || []).nextStats;
  const ledger = initializeCareMistakeLedger(repairedStats.careMistakeLedger);
  const timestamp = careMistakeLedger_ensureTimestamp(occurredAt) ?? Date.now();
  const eventId = id || buildCareMistakeEventId(reasonKey, timestamp);
  if (eventId && ledger.some((entry) => entry.id === eventId)) {
    return {
      added: false,
      entry: ledger.find((entry) => entry.id === eventId) || null,
      nextStats: {
        ...repairedStats,
        careMistakeLedger: ledger,
      },
    };
  }

  const entry = normalizeLedgerEntry({
    id: eventId,
    occurredAt: timestamp,
    reasonKey,
    text,
    source,
    resolvedAt: null,
    resolvedBy: null,
  });
  const nextLedger = [...ledger, entry].sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));

  return {
    added: true,
    entry,
    nextStats: {
      ...repairedStats,
      careMistakes: (repairedStats.careMistakes || 0) + 1,
      careMistakeLedger: nextLedger,
    },
  };
}

function resolveLatestCareMistakeEntry(stats = {}, { resolvedAt = Date.now(), resolvedBy = "play_or_snack" } = {}) {
  const repairedStats = repairCareMistakeLedger(stats, stats.activityLogs || []).nextStats;
  const ledger = initializeCareMistakeLedger(repairedStats.careMistakeLedger);
  const unresolved = getActiveCareMistakeEntries(ledger);
  const target = unresolved[unresolved.length - 1];

  if (!target) {
    return {
      resolved: false,
      resolvedEntry: null,
      nextStats: {
        ...repairedStats,
        careMistakeLedger: ledger,
        careMistakes: Math.max(0, repairedStats.careMistakes || 0),
      },
    };
  }

  const resolvedTimestamp = careMistakeLedger_ensureTimestamp(resolvedAt) ?? Date.now();
  const nextLedger = ledger.map((entry) => {
    if (entry.id !== target.id) return entry;
    return {
      ...entry,
      resolvedAt: resolvedTimestamp,
      resolvedBy,
    };
  });

  return {
    resolved: true,
    resolvedEntry: nextLedger.find((entry) => entry.id === target.id) || null,
    nextStats: {
      ...repairedStats,
      careMistakes: Math.max(0, (repairedStats.careMistakes || 0) - 1),
      careMistakeLedger: nextLedger,
    },
  };
}

function buildCareMistakeLedgerFromActivityLogs(activityLogs = [], currentStageStartedAt = null) {
  const stageStartedAt = careMistakeLedger_ensureTimestamp(currentStageStartedAt);
  const seen = new Set();
  return (Array.isArray(activityLogs) ? activityLogs : [])
    .filter((log) => isCareMistakeLog(log))
    .filter((log) => {
      const timestamp = careMistakeLedger_ensureTimestamp(log.timestamp);
      if (timestamp == null) return false;
      if (stageStartedAt == null) return true;
      return timestamp >= stageStartedAt;
    })
    .sort((a, b) => (careMistakeLedger_ensureTimestamp(a.timestamp) || 0) - (careMistakeLedger_ensureTimestamp(b.timestamp) || 0))
    .reduce((entries, log) => {
      const occurredAt = careMistakeLedger_ensureTimestamp(log.timestamp);
      const reasonKey = getCareMistakeReasonKeyFromText(log.text || "");
      const id = buildCareMistakeEventId(reasonKey, occurredAt);
      if (id == null || seen.has(id)) return entries;
      seen.add(id);
      entries.push({
        id,
        occurredAt,
        reasonKey,
        text: log.text || "케어미스 발생",
        source: inferCareMistakeSource(log.text || ""),
        resolvedAt: null,
        resolvedBy: null,
      });
      return entries;
    }, []);
}

function repairCareMistakeLedger(stats = {}, activityLogs = [], options = {}) {
  const currentStageStartedAt = options.currentStageStartedAt ?? stats.evolutionStageStartedAt ?? null;
  const targetCount = Math.max(0, Number(stats.careMistakes) || 0);
  let changed = false;
  let ledger = initializeCareMistakeLedger(stats.careMistakeLedger);

  const fallbackEntries = buildCareMistakeLedgerFromActivityLogs(activityLogs, currentStageStartedAt);
  const existingIds = new Set(ledger.map((entry) => entry.id));

  fallbackEntries.forEach((entry) => {
    if (existingIds.has(entry.id)) return;
    ledger.push(entry);
    existingIds.add(entry.id);
    changed = true;
  });

  ledger = ledger.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));

  let activeEntries = getActiveCareMistakeEntries(ledger);
  if (activeEntries.length > targetCount) {
    let remaining = activeEntries.length - targetCount;
    ledger = [...ledger];
    for (let index = ledger.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const entry = ledger[index];
      if (entry.resolvedAt != null) continue;
      ledger[index] = {
        ...entry,
        resolvedAt: entry.occurredAt,
        resolvedBy: null,
      };
      remaining -= 1;
      changed = true;
    }
  }

  activeEntries = getActiveCareMistakeEntries(ledger);
  const activeCount = activeEntries.length;
  if (activeCount < targetCount) {
    const baseTime = careMistakeLedger_ensureTimestamp(currentStageStartedAt) ?? Date.now();
    const placeholdersNeeded = targetCount - activeCount;
    for (let index = 0; index < placeholdersNeeded; index += 1) {
      let occurredAt = baseTime + activeCount + index;
      let id = buildCareMistakeEventId("sync_repair", occurredAt);
      while (id && existingIds.has(id)) {
        occurredAt += 1;
        id = buildCareMistakeEventId("sync_repair", occurredAt);
      }
      if (!id) continue;
      ledger.push({
        id,
        occurredAt,
        reasonKey: "sync_repair",
        text: CARE_MISTAKE_SYNC_TEXT,
        source: "sync",
        resolvedAt: null,
        resolvedBy: null,
      });
      existingIds.add(id);
      changed = true;
    }
  }

  const nextStats = changed
    ? { ...stats, careMistakeLedger: ledger.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0)) }
    : { ...stats, careMistakeLedger: ledger };

  return {
    repaired: changed,
    nextStats,
    activeEntries: getActiveCareMistakeEntries(nextStats.careMistakeLedger),
  };
}

function getDisplayCareMistakeEntries(stats = {}, activityLogs = [], options = {}) {
  const { nextStats, repaired, activeEntries } = repairCareMistakeLedger(stats, activityLogs, options);
  const targetCount = Math.max(0, Number(stats.careMistakes) || 0);
  if (activeEntries.length <= targetCount) {
    return {
      repaired,
      ledger: nextStats.careMistakeLedger,
      entries: activeEntries,
    };
  }
  return {
    repaired,
    ledger: nextStats.careMistakeLedger,
    entries: activeEntries.slice(activeEntries.length - targetCount),
  };
}

;// ./src/logic/stats/death.js


const DEATH_REASONS = {
  starvation: "STARVATION (굶주림)",
  exhaustion: "EXHAUSTION (힘 소진)",
  injuryOverload: "INJURY OVERLOAD (부상 과다: 15회)",
  injuryNeglect: "INJURY NEGLECT (부상 방치: 6시간)",
};

const DEATH_THRESHOLDS = {
  zeroStatMs: 12 * 60 * 60 * 1000,
  injuryNeglectMs: 6 * 60 * 60 * 1000,
  injuryOverloadCount: 15,
};

function buildDeathResult(isDead, reason = null, diedAt = null) {
  return { isDead, reason, diedAt };
}

function getElapsedSince(startAt, stats, nowMs, extraExcludedMs = 0) {
  const startMs = toTimestamp(startAt);
  if (startMs == null) return 0;

  return fridgeTime_getElapsedTimeExcludingFridge(
    startMs,
    nowMs,
    stats?.frozenAt,
    stats?.takeOutAt,
    extraExcludedMs
  );
}

function getTimedDeathAt(startAt, stats, nowMs, thresholdMs, elapsedMs) {
  const startMs = toTimestamp(startAt);
  if (startMs == null) return nowMs;

  const frozenAtMs = stats?.isFrozen ? toTimestamp(stats?.frozenAt) : null;
  const effectiveEndMs = frozenAtMs != null ? Math.min(nowMs, frozenAtMs) : nowMs;
  const exceededByMs = Math.max(0, elapsedMs - thresholdMs);
  return Math.max(startMs, effectiveEndMs - exceededByMs);
}

function death_evaluateDeathConditions(stats = {}, nowMs = Date.now()) {
  const safeNowMs = toTimestamp(nowMs) ?? Date.now();

  if (stats.fullness === 0 && stats.lastHungerZeroAt) {
    const elapsedSinceZero = getElapsedSince(
      stats.lastHungerZeroAt,
      stats,
      safeNowMs,
      stats?.hungerZeroFrozenDurationMs
    );
    if (elapsedSinceZero >= DEATH_THRESHOLDS.zeroStatMs) {
      return buildDeathResult(
        true,
        DEATH_REASONS.starvation,
        getTimedDeathAt(stats.lastHungerZeroAt, stats, safeNowMs, DEATH_THRESHOLDS.zeroStatMs, elapsedSinceZero)
      );
    }
  }

  if (stats.strength === 0 && stats.lastStrengthZeroAt) {
    const elapsedSinceZero = getElapsedSince(
      stats.lastStrengthZeroAt,
      stats,
      safeNowMs,
      stats?.strengthZeroFrozenDurationMs
    );
    if (elapsedSinceZero >= DEATH_THRESHOLDS.zeroStatMs) {
      return buildDeathResult(
        true,
        DEATH_REASONS.exhaustion,
        getTimedDeathAt(stats.lastStrengthZeroAt, stats, safeNowMs, DEATH_THRESHOLDS.zeroStatMs, elapsedSinceZero)
      );
    }
  }

  if ((stats.injuries || 0) >= DEATH_THRESHOLDS.injuryOverloadCount) {
    const injuryOccurredAt = toTimestamp(stats.injuredAt);
    return buildDeathResult(
      true,
      DEATH_REASONS.injuryOverload,
      injuryOccurredAt != null && injuryOccurredAt <= safeNowMs ? injuryOccurredAt : safeNowMs
    );
  }

  if (stats.isInjured && stats.injuredAt) {
    const elapsedSinceInjury = getElapsedSince(
      stats.injuredAt,
      stats,
      safeNowMs,
      stats?.injuryFrozenDurationMs
    );
    if (elapsedSinceInjury >= DEATH_THRESHOLDS.injuryNeglectMs) {
      return buildDeathResult(
        true,
        DEATH_REASONS.injuryNeglect,
        getTimedDeathAt(stats.injuredAt, stats, safeNowMs, DEATH_THRESHOLDS.injuryNeglectMs, elapsedSinceInjury)
      );
    }
  }

  if (stats.isDead) {
    return buildDeathResult(true, stats.deathReason ?? null, toTimestamp(stats.diedAt));
  }

  return buildDeathResult(false);
}

;// ./src/utils/activityLogEventId.js



const CARE_MISTAKE_TYPES = new Set(["CAREMISTAKE", "CARE_MISTAKE"]);

function normalizeLogType(type = "") {
  if (typeof type !== "string") return "";
  return type.trim().toUpperCase();
}

function normalizeLogText(text = "") {
  return typeof text === "string" ? text.trim() : "";
}

function hashEventIdentity(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function ensureActivityLogTimestampMs(value) {
  return toTimestamp(value);
}

function isCareMistakeActivityType(type = "") {
  return CARE_MISTAKE_TYPES.has(normalizeLogType(type));
}

function getPoopInjuryEventKindFromText(text = "") {
  const normalizedText = normalizeLogText(text);
  if (!normalizedText) return null;

  if (
    normalizedText.includes("Too much poop") ||
    normalizedText.includes("똥 8개로 인한 부상")
  ) {
    return "max_poop";
  }

  if (
    normalizedText.includes("8시간 경과") ||
    normalizedText.includes("추가 부상")
  ) {
    return "poop_penalty";
  }

  return null;
}

function buildCareMistakeActivityEventId(reasonKey = "other", occurredAt) {
  const timestampMs = ensureActivityLogTimestampMs(occurredAt);
  if (timestampMs == null) return null;
  return `caremistake:${reasonKey || "other"}:${timestampMs}`;
}

function buildPoopInjuryActivityEventId(kind = "general", occurredAt) {
  const timestampMs = ensureActivityLogTimestampMs(occurredAt);
  if (timestampMs == null) return null;
  return `poop:${kind || "general"}:${timestampMs}`;
}

function buildActivityLogEventId(log = {}) {
  if (typeof log?.eventId === "string" && log.eventId.trim()) {
    return log.eventId.trim();
  }

  const type = normalizeLogType(log?.type);
  const timestampMs = ensureActivityLogTimestampMs(log?.timestamp);
  if (!type || timestampMs == null) return null;

  const text = normalizeLogText(log?.text);

  if (isCareMistakeActivityType(type)) {
    return buildCareMistakeActivityEventId(
      getCareMistakeReasonKeyFromText(text),
      timestampMs
    );
  }

  if (type === "POOP") {
    const poopKind = getPoopInjuryEventKindFromText(text);
    if (!poopKind) return null;
    return buildPoopInjuryActivityEventId(poopKind, timestampMs);
  }

  const identity = [
    type,
    timestampMs,
    text,
    log?.digimonId || "",
    log?.digimonName || "",
  ].join("|");

  return `activity:${type.toLowerCase()}:${timestampMs}:${hashEventIdentity(identity)}`;
}

;// ./src/data/stats.js
// src/data/stats.js











const stats_FALLING_ASLEEP_DELAY_MS = 15 * 1000;
const stats_NAP_DURATION_MS = 3 * 60 * 60 * 1000;
const SLEEP_LIGHT_WARNING_TIMEOUT_MS = 30 * 60 * 1000;
const SLEEP_ANALYSIS_STEP_MS = 15 * 1000;
const MAX_SLEEP_ANALYSIS_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

function migrateLegacyPoopTimers(target, fallbackTime = null) {
  if ((target.poopCount || 0) < 8) {
    target.poopReachedMaxAt = null;
    target.lastPoopPenaltyAt = null;
    delete target.lastMaxPoopTime;
    return;
  }

  const fallbackMs = toTimestamp(fallbackTime);
  const legacyMaxTime = toTimestamp(target.lastMaxPoopTime);
  const existingReachedMaxAt = toTimestamp(target.poopReachedMaxAt);
  const existingPenaltyAt = toTimestamp(target.lastPoopPenaltyAt);
  const reachedMaxAt = existingReachedMaxAt ?? legacyMaxTime ?? existingPenaltyAt ?? fallbackMs;
  const penaltyAt = existingPenaltyAt ?? legacyMaxTime ?? reachedMaxAt;

  target.poopReachedMaxAt = reachedMaxAt ?? null;
  target.lastPoopPenaltyAt = penaltyAt ?? null;
  delete target.lastMaxPoopTime;
}

function applyPoopInjury(target, timestampMs, count = 1) {
  target.isInjured = true;
  target.injuredAt = timestampMs;
  target.injuryFrozenDurationMs = 0;
  target.injuries = (target.injuries || 0) + count;
  target.healedDosesCurrent = 0;
  target.injuryReason = "poop";
}

function clearPoopOverflowState(stats, lastSavedAt = Date.now()) {
  return {
    ...stats,
    poopCount: 0,
    poopReachedMaxAt: null,
    lastPoopPenaltyAt: null,
    poopPenaltyFrozenDurationMs: 0,
    lastSavedAt: stats_ensureTimestamp(lastSavedAt) ?? Date.now(),
  };
}

function clearActiveInjuryState(stats) {
  return {
    ...stats,
    isInjured: false,
    injuredAt: null,
    injuryFrozenDurationMs: 0,
    healedDosesCurrent: 0,
    injuryReason: null,
  };
}

function initializeStats(digiName, oldStats={}, dataMap={}){
  if(!dataMap[digiName]){
    console.error(`initializeStats: [${digiName}] not found in dataMap!`);
    digiName = getStarterDigimonIdFromDataMap(dataMap); // fallback
  }
  const custom = dataMap[digiName] || {};

  let merged= { ...defaultStats, ...custom };

  // 원본 v1 데이터(evolutionCriteria 내 timeToEvolveSeconds)를 쓰는 경로 대비: 진화까지 시간 반영
  if (merged.timeToEvolveSeconds === undefined || merged.timeToEvolveSeconds === 0) {
    const fromCriteria = custom.evolutionCriteria?.timeToEvolveSeconds;
    if (fromCriteria !== undefined && fromCriteria !== null) {
      merged.timeToEvolveSeconds = fromCriteria;
    }
  }

  // 새로운 시작(디지타마/디지타마V2 초기화)인지 확인
  const isNewStart =
    isStarterDigimonId(digiName) &&
    oldStats.totalReincarnations !== undefined;

  // 기존 이어받기 (나이, 수명)
  // 새로운 시작이면 age를 0으로, 그렇지 않으면 기존 값 유지
  if (isNewStart) {
    merged.age = 0;
    merged.birthTime = stats_ensureTimestamp(oldStats.birthTime) ?? Date.now();
    merged.isDead = false; // 새로운 시작이면 항상 false
    // 새로운 시작: 사망 관련 필드 완전 초기화
    merged.lastHungerZeroAt = null;
    merged.hungerZeroFrozenDurationMs = 0;
    merged.lastStrengthZeroAt = null;
    merged.strengthZeroFrozenDurationMs = 0;
    merged.hungerMistakeDeadline = null;
    merged.strengthMistakeDeadline = null;
    merged.injuredAt = null;
    merged.injuryFrozenDurationMs = 0;
    merged.isInjured = false;
    merged.injuries = 0;
    merged.deathReason = null; // 새로운 시작이면 deathReason 리셋
    merged.diedAt = null;
    // 새로운 시작: 기본 스탯 설정
    merged.fullness = 0;
    merged.strength = 0;
    // 새로운 시작: 이번 생애 누적 배틀 기록 초기화
    merged.totalBattles = 0;
    merged.totalBattlesWon = 0;
    merged.totalBattlesLost = 0;
    merged.totalWinRate = 0;
    // 새로운 시작: 똥 초기화
    merged.poopCount = 0;
    merged.poopReachedMaxAt = null;
    merged.lastPoopPenaltyAt = null;
    merged.poopPenaltyFrozenDurationMs = 0;
  } else {
    merged.age = oldStats.age || merged.age;
    merged.birthTime = stats_ensureTimestamp(oldStats.birthTime) ?? Date.now();
    // 진화 시에는 isDead를 명시적으로 false로 설정하지 않음 (기존 값 유지)
    // 하지만 defaultStats에 이미 false가 있으므로 문제 없음
  }

  merged.weight = oldStats.weight !== undefined ? oldStats.weight : merged.weight;
  merged.lifespanSeconds = Number.isFinite(oldStats.lifespanSeconds)
    ? oldStats.lifespanSeconds
    : (Number.isFinite(merged.lifespanSeconds) ? merged.lifespanSeconds : 0);

  // ★ strength, effort는 진화 시 리셋 (resetStats에서 0으로 설정됨)
  // merged.strength, merged.effort는 defaultStats에서 가져온 기본값 사용 (보통 0)

  // ★ trainings는 새 디지몬 생성(진화) 시 무조건 0
  merged.trainings = 0;

  // 매뉴얼 기반 필드 초기화 (진화 시 리셋되는 필드)
  merged.overfeeds = 0;
  merged.consecutiveMeatFed = 0; // 오버피드 연속 카운트도 리셋
  // proteinCount 제거됨 - strength로 통합
  merged.proteinOverdose = 0; // 단백질 과다 리셋
  merged.battlesForEvolution = 0;
  merged.careMistakes = 0;
  merged.careMistakeLedger = [];
  merged.injuries = isNewStart
    ? 0
    : (oldStats.injuries !== undefined ? oldStats.injuries : (merged.injuries || 0)); // 이번 생 누적 부상 횟수 유지
  merged.isInjured = false; // 부상 상태 리셋
  merged.injuredAt = null; // 부상 시간 리셋
  merged.injuryFrozenDurationMs = 0;
  merged.healedDosesCurrent = 0; // 치료제 횟수 리셋
  // 호출 상태 초기화 (진화 시 리셋)
  merged.callStatus = {
    hunger: { isActive: false, startedAt: null, isLogged: false },
    strength: { isActive: false, startedAt: null, isLogged: false },
    sleep: { isActive: false, startedAt: null, isLogged: false }
  };
  merged.fastSleepStart = null;
  merged.napUntil = null;
  merged.sleepLightOnStart = null;

  // 매뉴얼 기반 필드 초기화

  // Energy는 진화 시 리셋되므로, resetStats에서 이미 0으로 설정된 값을 사용
  merged.energy = oldStats.energy !== undefined ? oldStats.energy : (merged.energy || 0);

  // 이번 생애 누적 배틀 값 (진화 시 유지, 새로운 시작 시 초기화)
  merged.totalBattles = isNewStart
    ? 0
    : (oldStats.totalBattles !== undefined ? oldStats.totalBattles : (merged.totalBattles || 0));
  merged.totalBattlesWon = isNewStart
    ? 0
    : (oldStats.totalBattlesWon !== undefined ? oldStats.totalBattlesWon : (merged.totalBattlesWon || 0));
  merged.totalBattlesLost = isNewStart
    ? 0
    : (oldStats.totalBattlesLost !== undefined ? oldStats.totalBattlesLost : (merged.totalBattlesLost || 0));
  merged.totalWinRate = isNewStart
    ? 0
    : (oldStats.totalWinRate !== undefined ? oldStats.totalWinRate : (merged.totalWinRate || 0));

  // 환생 횟수 (진화 시 유지)
  merged.totalReincarnations = oldStats.totalReincarnations !== undefined ? oldStats.totalReincarnations : (merged.totalReincarnations || 0);
  merged.normalReincarnations = oldStats.normalReincarnations !== undefined ? oldStats.normalReincarnations : (merged.normalReincarnations || 0);
  merged.perfectReincarnations = oldStats.perfectReincarnations !== undefined ? oldStats.perfectReincarnations : (merged.perfectReincarnations || 0);

  // 현재 디지몬 배틀 값 (진화 시 리셋)
  // resetStats에서 이미 0으로 설정되거나, 없으면 기본값 0 사용
  merged.battles = oldStats.battles !== undefined ? oldStats.battles : 0;
  merged.battlesWon = oldStats.battlesWon !== undefined ? oldStats.battlesWon : 0;
  merged.battlesLost = oldStats.battlesLost !== undefined ? oldStats.battlesLost : 0;
  merged.winRate = oldStats.winRate !== undefined ? oldStats.winRate : 0;

  // 타이머 계산
  merged.hungerCountdown   = merged.hungerTimer   * 60;
  merged.strengthCountdown = merged.strengthTimer * 60;

  // poop 관련
  merged.poopCount = (oldStats.poopCount !== undefined)
    ? oldStats.poopCount
    : 0;
  merged.poopTimer = merged.poopTimer || 0;

  // poopCountdown 초기화: poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
  const oldPoopTimer = oldStats.poopTimer || 0;
  const newPoopTimer = merged.poopTimer || 0;
  const maxValidCountdown = newPoopTimer * 60; // 최대 유효한 countdown 값

  if (oldStats.poopCountdown !== undefined) {
    // poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
    if (oldPoopTimer !== newPoopTimer ||
        oldStats.poopCountdown < 0 ||
        oldStats.poopCountdown > maxValidCountdown ||
        isNaN(oldStats.poopCountdown)) {
      merged.poopCountdown = maxValidCountdown;
    } else {
      merged.poopCountdown = oldStats.poopCountdown;
    }
  } else {
    merged.poopCountdown = maxValidCountdown;
  }

  migrateLegacyPoopTimers(merged, null);

  // 야행성 모드 (진화 시 유지)
  merged.isNocturnal = oldStats.isNocturnal !== undefined ? oldStats.isNocturnal : false;

  // 현재 진화 단계 시작 시각 (케어미스 이력 필터: 이 시점 이후 로그만 표시 → 카운터와 일치)
  if (isNewStart) {
    merged.evolutionStageStartedAt =
      stats_ensureTimestamp(merged.birthTime) ?? Date.now();
  } else {
    merged.evolutionStageStartedAt = Date.now();
  }

  delete merged.lastMaxPoopTime;

  return merged;
}

function updateLifespan(stats, deltaSec=1, isSleeping=false, referenceTimeMs=Date.now()){
  if(stats.isDead) return stats;

  const s= { ...stats };
  const currentLifespan = typeof s.lifespanSeconds === 'number' && !Number.isNaN(s.lifespanSeconds)
    ? s.lifespanSeconds
    : 0;
  s.lifespanSeconds = currentLifespan + deltaSec;
  // undefined면 NaN 방지 및 디지타마 초기값 누락 대비 (0으로 간주해 감소만 적용)
  const currentTimeToEvolve = typeof s.timeToEvolveSeconds === 'number' && !Number.isNaN(s.timeToEvolveSeconds) ? s.timeToEvolveSeconds : 0;
  s.timeToEvolveSeconds = Math.max(0, currentTimeToEvolve - deltaSec);

  // 배고픔/힘 감소 로직은 handleHungerTick, handleStrengthTick으로 이동
  // 이 함수는 lifespanSeconds, timeToEvolveSeconds, poop만 처리

  if (s.fullness > 0) {
    s.lastHungerZeroAt = null;
    s.hungerZeroFrozenDurationMs = 0;
  }
  if (s.strength > 0) {
    s.lastStrengthZeroAt = null;
    s.strengthZeroFrozenDurationMs = 0;
  }

  // ★ (3) poop 로직 (수면 중에는 타이머 감소하지 않음)
  if(s.poopTimer>0 && !isSleeping){
    s.poopCountdown -= deltaSec;
    if(s.poopCountdown <= 0){
      if(s.poopCount < 8){
        s.poopCount++;
        s.poopCountdown = s.poopTimer*60;

        if (s.poopCount === 8 && !s.poopReachedMaxAt) {
          const reachedMaxAt = referenceTimeMs;
          s.poopReachedMaxAt = reachedMaxAt;
          s.lastPoopPenaltyAt = reachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(s, reachedMaxAt);
        }
      } else {
        if (!s.poopReachedMaxAt) {
          const reachedMaxAt = referenceTimeMs;
          s.poopReachedMaxAt = reachedMaxAt;
          s.lastPoopPenaltyAt = reachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(s, reachedMaxAt);
        } else if (!s.lastPoopPenaltyAt) {
          s.lastPoopPenaltyAt = s.poopReachedMaxAt;
          s.poopPenaltyFrozenDurationMs = 0;
        } else {
          const elapsedSincePenalty = getElapsedTimeExcludingFridge(
            s.lastPoopPenaltyAt,
            referenceTimeMs,
            s.frozenAt,
            s.takeOutAt,
            s.poopPenaltyFrozenDurationMs
          ) / 1000;
          const periods = Math.floor(elapsedSincePenalty / 28800);
          if (periods >= 1) {
            const penaltyTime = referenceTimeMs;
            applyPoopInjury(s, penaltyTime, periods);
            s.lastPoopPenaltyAt = penaltyTime;
            s.poopPenaltyFrozenDurationMs = 0;
          }
        }
        s.poopCountdown = s.poopTimer*60;
      }
    }
  }

  if ((s.poopCount || 0) < 8) {
    s.poopReachedMaxAt = null;
    s.lastPoopPenaltyAt = null;
    s.poopPenaltyFrozenDurationMs = 0;
  }

  const deathEvaluation = evaluateDeathConditions(s, referenceTimeMs);
  if (deathEvaluation.isDead) {
    s.isDead = true;
    if (deathEvaluation.reason) {
      s.deathReason = deathEvaluation.reason;
    }
    if (deathEvaluation.diedAt != null) {
      s.diedAt = deathEvaluation.diedAt;
    }
  }

  return s;
}

/**
 * 나이 업데이트 (자정 경과 확인)
 * 마지막으로 age가 증가한 날짜를 추적하여 하루에 한 번만 증가하도록 함
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯
 */
function updateAge(stats){
  const nowMs = Date.now();
  const currentKstDayStart = getStartOfKstDayMs(nowMs);
  const elapsedFromDayStart = nowMs - currentKstDayStart;

  // KST 자정 이후 첫 1분 안에서만 age를 증가시켜 실시간 루프의 오차를 허용한다.
  if (elapsedFromDayStart >= 0 && elapsedFromDayStart < 60 * 1000) {
    if (!isSameKstDay(stats.lastAgeUpdateDate, nowMs)) {
      return {
        ...stats,
        age: (stats.age || 0) + 1,
        lastAgeUpdateDate: currentKstDayStart,
      };
    }
  }
  return stats;
}

/**
 * Lazy Update용 나이 업데이트
 * 마지막 저장 시간부터 현재까지의 모든 자정을 체크하여 age 증가
 * @param {Object} stats - 현재 스탯
 * @param {Date} lastSaved - 마지막 저장 시간
 * @param {Date} now - 현재 시간
 * @returns {Object} 업데이트된 스탯
 */
function updateAgeWithLazyUpdate(stats, lastSaved, now) {
  let updatedStats = { ...stats };
  const lastSavedMs = stats_ensureTimestamp(lastSaved);
  const nowMs = stats_ensureTimestamp(now);
  let lastAgeUpdateDateMs = stats_ensureTimestamp(updatedStats.lastAgeUpdateDate);

  if (!Number.isFinite(lastSavedMs) || !Number.isFinite(nowMs) || lastSavedMs >= nowMs) {
    return updatedStats;
  }

  let checkDayStart = time_getStartOfKstDayMs(lastSavedMs) + KST_DAY_MS;

  while (checkDayStart <= nowMs) {
    if (
      !Number.isFinite(lastAgeUpdateDateMs) ||
      !time_isSameKstDay(lastAgeUpdateDateMs, checkDayStart)
    ) {
      updatedStats.age = (updatedStats.age || 0) + 1;
      updatedStats.lastAgeUpdateDate = checkDayStart;
      lastAgeUpdateDateMs = checkDayStart;
    }

    checkDayStart += KST_DAY_MS;
  }

  return updatedStats;
}

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function stats_ensureTimestamp(val) {
  return toTimestamp(val);
}

/**
 * 과거 재구성 시 activityLogs에 소급 시각으로 로그 한 건 추가 (이력 누락 방지)
 * @param {Array} activityLogs - 기존 활동 로그 배열
 * @param {string} type - 로그 타입 ('POOP', 'CAREMISTAKE' 등)
 * @param {string} text - 로그 텍스트
 * @param {number} timestampMs - 소급 적용할 시각 (ms)
 * @param {number} maxLogs - 최대 유지 개수
 * @returns {Array} 업데이트된 로그 배열
 */
function pushBackdatedActivityLog(
  activityLogs,
  type,
  text,
  timestampMs,
  maxLogs = MAX_ACTIVITY_LOGS,
  extraFields = {}
) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const baseLog = { type, text, timestamp: timestampMs, ...extraFields };
  const eventId = buildActivityLogEventId(baseLog);
  const nextLog = eventId ? { ...baseLog, eventId } : baseLog;
  const next = [...logs, nextLog];
  return next.length > maxLogs ? next.slice(-maxLogs) : next;
}

/**
 * 로그 항목의 timestamp를 ms 숫자로 정규화 (Firestore Timestamp 지원).
 * null/undefined 또는 파싱 실패 시 null 반환, 예외 없음.
 * @param {Object|null|undefined} log - 로그 객체 (timestamp 필드 보유)
 * @returns {number|null} ms 단위 타임스탬프 또는 null
 */
function logTimestampToMs(log) {
  if (log == null || typeof log !== 'object' || log.timestamp == null) return null;
  const t = log.timestamp;
  if (typeof t === 'number' && !Number.isNaN(t)) return t;
  if (typeof t === 'object' && t !== null && t.seconds != null) {
    const sec = Number(t.seconds);
    const nano = t.nanoseconds != null ? Number(t.nanoseconds) : 0;
    return Number.isNaN(sec) ? null : sec * 1000 + nano / 1e6;
  }
  try {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch (_) {
    return null;
  }
}

/** 이미 동일 이벤트(타입+타임스탬프+텍스트 패턴) 로그가 있으면 true. 중복 로그/카운터 방지용. Firestore timestamp 정규화 적용 */
function alreadyHasBackdatedLog(activityLogs, type, timestampMs, textContains = "", eventId = null) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const targetMs = typeof timestampMs === 'number' ? timestampMs : null;
  if (targetMs == null) return false;
  return logs.some((log) => {
    if (eventId && buildActivityLogEventId(log) === eventId) {
      return true;
    }
    if (log.type !== type) return false;
    if (textContains && (!log.text || !log.text.includes(textContains))) return false;
    const logMs = logTimestampToMs(log);
    return logMs != null && logMs === targetMs;
  });
}

function isSleepLikeStatus(status) {
  return (
    status === "NAPPING" ||
    status === "SLEEPING" ||
    status === "SLEEPING_LIGHT_ON"
  );
}

function getEffectiveFastSleepStartMs(stats = {}) {
  const explicitFastSleepStart = stats_ensureTimestamp(stats.fastSleepStart);
  if (explicitFastSleepStart != null) {
    return explicitFastSleepStart;
  }

  const napUntilMs = stats_ensureTimestamp(stats.napUntil);
  if (napUntilMs == null) {
    return null;
  }

  return napUntilMs - stats_NAP_DURATION_MS - stats_FALLING_ASLEEP_DELAY_MS;
}

function getLazySleepStatusAtMs(stats = {}, sleepSchedule, timestampMs) {
  const lightsOn = stats.isLightsOn !== undefined ? Boolean(stats.isLightsOn) : true;
  const wakeUntilMs = stats_ensureTimestamp(stats.wakeUntil);
  if (wakeUntilMs != null && wakeUntilMs > timestampMs) {
    return "AWAKE_INTERRUPTED";
  }

  const normalizedSchedule = sleepSchedule ? normalizeSleepSchedule(sleepSchedule) : null;
  const isSleepTime =
    normalizedSchedule != null &&
    isTimeWithinSleepSchedule(normalizedSchedule, new Date(timestampMs));

  const napUntilMs = stats_ensureTimestamp(stats.napUntil);
  const napStartAt =
    napUntilMs != null ? napUntilMs - stats_NAP_DURATION_MS : null;
  const isNapTime =
    napStartAt != null &&
    timestampMs >= napStartAt &&
    timestampMs < napUntilMs;

  const fastSleepStartMs = getEffectiveFastSleepStartMs(stats);
  const isFallingAsleep =
    fastSleepStartMs != null &&
    timestampMs >= fastSleepStartMs &&
    timestampMs < fastSleepStartMs + stats_FALLING_ASLEEP_DELAY_MS;

  if (isSleepTime) {
    if (lightsOn) {
      return "SLEEPING_LIGHT_ON";
    }
    if (isFallingAsleep) {
      return "FALLING_ASLEEP";
    }
    return "SLEEPING";
  }

  if (isNapTime) {
    if (lightsOn) {
      return "AWAKE";
    }
    if (isFallingAsleep) {
      return "FALLING_ASLEEP";
    }
    return "NAPPING";
  }

  return "AWAKE";
}

function analyzeSleepStatesInRange(stats = {}, startTime, endTime, sleepSchedule) {
  const startMs = stats_ensureTimestamp(startTime);
  const endMs = stats_ensureTimestamp(endTime);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return {
      sleepLikeSeconds: 0,
      sleepLightSegments: [],
      currentStatus: getLazySleepStatusAtMs(stats, sleepSchedule, endMs || Date.now()),
    };
  }

  const actualEnd = Math.min(endMs, startMs + MAX_SLEEP_ANALYSIS_RANGE_MS);
  let current = startMs;
  let sleepLikeMs = 0;
  let activeSleepLightStart = null;
  const sleepLightSegments = [];

  while (current < actualEnd) {
    const next = Math.min(current + SLEEP_ANALYSIS_STEP_MS, actualEnd);
    const status = getLazySleepStatusAtMs(stats, sleepSchedule, current);

    if (isSleepLikeStatus(status)) {
      sleepLikeMs += next - current;
    }

    if (status === "SLEEPING_LIGHT_ON") {
      if (activeSleepLightStart == null) {
        activeSleepLightStart = current;
      }
    } else if (activeSleepLightStart != null) {
      sleepLightSegments.push({
        startedAt: activeSleepLightStart,
        endedAt: current,
      });
      activeSleepLightStart = null;
    }

    current = next;
  }

  const currentStatus = getLazySleepStatusAtMs(stats, sleepSchedule, endMs);

  if (activeSleepLightStart != null) {
    sleepLightSegments.push({
      startedAt: activeSleepLightStart,
      endedAt: actualEnd,
    });
  }

  return {
    sleepLikeSeconds: Math.floor(sleepLikeMs / 1000),
    sleepLightSegments,
    currentStatus,
  };
}

function resolveSleepLightWarningStateInRange({
  stats = {},
  startTime,
  endTime,
  sleepSchedule = null,
  previousStartedAt = null,
  previousLogged = false,
} = {}) {
  const startMs = stats_ensureTimestamp(startTime);
  const sleepRangeAnalysis = analyzeSleepStatesInRange(
    stats,
    startTime,
    endTime,
    sleepSchedule
  );
  const previousStartedAtMs = stats_ensureTimestamp(previousStartedAt);
  const activeSleepLightSegment =
    sleepRangeAnalysis.currentStatus === "SLEEPING_LIGHT_ON"
      ? sleepRangeAnalysis.sleepLightSegments[
          sleepRangeAnalysis.sleepLightSegments.length - 1
        ] || null
      : null;
  const canCarryPreviousIncident =
    previousStartedAtMs != null &&
    Number.isFinite(startMs) &&
    sleepRangeAnalysis.sleepLightSegments.length > 0 &&
    sleepRangeAnalysis.sleepLightSegments[0].startedAt <=
      startMs + SLEEP_ANALYSIS_STEP_MS;

  let activeSleepLightEffectiveStart = null;
  let activeSleepLightResolvedSegment = null;

  const resolvedSleepLightSegments = sleepRangeAnalysis.sleepLightSegments.map(
    (segment, index) => {
      const isContinuingPersistedIncident =
        canCarryPreviousIncident && index === 0;
      const effectiveStartedAt = isContinuingPersistedIncident
        ? Math.min(previousStartedAtMs, segment.startedAt)
        : segment.startedAt;
      const isActiveSegment =
        activeSleepLightSegment != null &&
        activeSleepLightSegment.startedAt === segment.startedAt &&
        activeSleepLightSegment.endedAt === segment.endedAt;
      const resolvedSegment = {
        ...segment,
        effectiveStartedAt,
        isActiveSegment,
        isContinuingPersistedIncident,
        shouldSkipLoggedTimeout:
          isContinuingPersistedIncident && previousLogged,
      };

      if (isActiveSegment) {
        activeSleepLightEffectiveStart = effectiveStartedAt;
        activeSleepLightResolvedSegment = resolvedSegment;
      }

      return resolvedSegment;
    }
  );

  return {
    ...sleepRangeAnalysis,
    activeSleepLightSegment,
    activeSleepLightEffectiveStart,
    activeSleepLightResolvedSegment,
    resolvedSleepLightSegments,
  };
}

function stats_calculateSleepLikeSecondsInRange(startTime, endTime, stats, sleepSchedule) {
  return analyzeSleepStatesInRange(stats, startTime, endTime, sleepSchedule).sleepLikeSeconds;
}

function findWallTimeForActiveOffset(startMs, endMs, activeOffsetSeconds, stats, sleepSchedule) {
  if (activeOffsetSeconds <= 0) return startMs;

  let lowSeconds = 0;
  let highSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  while (lowSeconds < highSeconds) {
    const middleSeconds = Math.floor((lowSeconds + highSeconds) / 2);
    const middle = startMs + (middleSeconds * 1000);
    const sleepSeconds = stats_calculateSleepLikeSecondsInRange(
      startMs,
      middle,
      stats,
      sleepSchedule
    );
    const activeSeconds = Math.max(0, middleSeconds - sleepSeconds);

    if (activeSeconds >= activeOffsetSeconds) {
      highSeconds = middleSeconds;
    } else {
      lowSeconds = middleSeconds + 1;
    }
  }

  return Math.min(endMs, startMs + (highSeconds * 1000));
}

function repairFutureZeroTiming(target, nowMs, lastSavedMs, config) {
  const zeroAt = stats_ensureTimestamp(target[config.zeroAtKey]);
  if (zeroAt == null || zeroAt <= nowMs || target[config.statKey] !== 0) {
    return;
  }

  const cycleSeconds = Math.max(0, Number(target[config.timerKey]) || 0) * 60;
  const countdownSeconds = Math.min(
    cycleSeconds,
    Math.max(0, Number(target[config.countdownKey]) || 0)
  );
  const latestBoundaryAt = cycleSeconds > 0
    ? lastSavedMs - ((cycleSeconds - countdownSeconds) * 1000)
    : lastSavedMs;
  const repairedZeroAt = Math.min(nowMs, lastSavedMs, latestBoundaryAt);

  target[config.zeroAtKey] = repairedZeroAt;

  const callEntry = target.callStatus?.[config.callKey];
  if (callEntry && stats_ensureTimestamp(callEntry.startedAt) > nowMs) {
    callEntry.startedAt = repairedZeroAt;
  }
  if (stats_ensureTimestamp(target[config.deadlineKey]) > nowMs) {
    target[config.deadlineKey] = repairedZeroAt + (10 * 60 * 1000);
  }
}

function clearResolvedNeedCallMetadata(target, {
  statKey,
  zeroAtKey,
  frozenDurationKey,
  deadlineKey,
  callKey,
}) {
  if ((target[statKey] || 0) <= 0) return;

  target[zeroAtKey] = null;
  target[frozenDurationKey] = 0;
  target[deadlineKey] = null;

  if (target.callStatus?.[callKey]) {
    target.callStatus = {
      ...target.callStatus,
      [callKey]: {
        ...target.callStatus[callKey],
        isActive: false,
        startedAt: null,
        isLogged: false,
      },
    };
  }
}

function clearResolvedNeedCalls(target) {
  clearResolvedNeedCallMetadata(target, {
    statKey: "fullness",
    zeroAtKey: "lastHungerZeroAt",
    frozenDurationKey: "hungerZeroFrozenDurationMs",
    deadlineKey: "hungerMistakeDeadline",
    callKey: "hunger",
  });
  clearResolvedNeedCallMetadata(target, {
    statKey: "strength",
    zeroAtKey: "lastStrengthZeroAt",
    frozenDurationKey: "strengthZeroFrozenDurationMs",
    deadlineKey: "strengthMistakeDeadline",
    callKey: "strength",
  });
}

function finalizeNoElapsedLazyUpdate(stats = {}, savedAtMs, digimonSnapshot = null) {
  const nextStats = cloneStatsForProjection(stats);
  migrateLegacyPoopTimers(nextStats);
  clearResolvedNeedCalls(nextStats);

  if (
    (nextStats.poopCount || 0) >= 8 &&
    nextStats.poopReachedMaxAt &&
    !nextStats.isInjured
  ) {
    const injuryLogText =
      "Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]";
    const injuryLogEventId = buildActivityLogEventId({
      type: "POOP",
      text: injuryLogText,
      timestamp: nextStats.poopReachedMaxAt,
    });
    applyPoopInjury(nextStats, nextStats.poopReachedMaxAt);

    if (
      !alreadyHasBackdatedLog(
        nextStats.activityLogs,
        "POOP",
        nextStats.poopReachedMaxAt,
        "Too much poop",
        injuryLogEventId
      )
    ) {
      nextStats.activityLogs = pushBackdatedActivityLog(
        nextStats.activityLogs,
        "POOP",
        injuryLogText,
        nextStats.poopReachedMaxAt,
        MAX_ACTIVITY_LOGS,
        digimonSnapshot
      );
    }
  }

  nextStats.lastSavedAt = savedAtMs;
  delete nextStats.lastMaxPoopTime;
  return nextStats;
}

function cloneCallStatus(callStatus) {
  if (!callStatus || typeof callStatus !== "object") {
    return callStatus;
  }

  return {
    ...callStatus,
    hunger: callStatus.hunger ? { ...callStatus.hunger } : callStatus.hunger,
    strength: callStatus.strength ? { ...callStatus.strength } : callStatus.strength,
    sleep: callStatus.sleep ? { ...callStatus.sleep } : callStatus.sleep,
  };
}

function cloneStatsForProjection(stats = {}) {
  return {
    ...stats,
    callStatus: cloneCallStatus(stats.callStatus),
    activityLogs: Array.isArray(stats.activityLogs) ? [...stats.activityLogs] : stats.activityLogs,
    careMistakeLedger: Array.isArray(stats.careMistakeLedger) ? [...stats.careMistakeLedger] : stats.careMistakeLedger,
    injuryHistory: Array.isArray(stats.injuryHistory) ? [...stats.injuryHistory] : stats.injuryHistory,
  };
}

function projectContinuousStats(state, { nowMs, elapsedSeconds }) {
  const currentLifespan = typeof state.lifespanSeconds === 'number' && !Number.isNaN(state.lifespanSeconds)
    ? state.lifespanSeconds
    : 0;
  const currentTte = typeof state.timeToEvolveSeconds === 'number' && !Number.isNaN(state.timeToEvolveSeconds)
    ? state.timeToEvolveSeconds
    : 0;

  return {
    birthTime: state.birthTime || nowMs,
    lifespanSeconds: currentLifespan + elapsedSeconds,
    timeToEvolveSeconds: Math.max(0, currentTte - elapsedSeconds),
  };
}

function calculateActiveSecondsForNeeds({
  elapsedSeconds,
  lastSavedAtMs,
  nowMs,
  stats,
  sleepSchedule,
}) {
  if (sleepSchedule || stats.napUntil || stats.fastSleepStart || stats.wakeUntil) {
    const sleepSeconds = stats_calculateSleepLikeSecondsInRange(
      lastSavedAtMs,
      nowMs,
      stats,
      sleepSchedule
    );
    return elapsedSeconds - sleepSeconds;
  }

  return elapsedSeconds;
}

function applyActiveCountdown(countdown, activeSeconds) {
  return activeSeconds > 0 ? countdown - activeSeconds : countdown;
}

/**
 * 저장된 상태를 특정 시각의 현재 상태로 투영한다.
 *
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {number} nowMs - 투영 기준 시각(ms)
 * @param {Object} options - projection 옵션
 * @returns {Object} 업데이트된 스탯
 */
function projectState(
  stats,
  nowMs,
  options = {}
) {
  const {
    lastSavedAt,
    sleepSchedule = null,
    maxEnergy = null,
  } = options;
  if (!Number.isFinite(Number(nowMs))) {
    throw new Error("projectState requires a finite nowMs");
  }
  nowMs = Number(nowMs);

  if (!lastSavedAt) {
    // 마지막 저장 시간이 없으면 현재 시간으로 설정
    return finalizeNoElapsedLazyUpdate(stats, nowMs);
  }

  // 마지막 저장 시간을 Date 객체로 변환 (Firestore Timestamp 지원)
  let lastSaved;
  const lastSavedTimestamp = stats_ensureTimestamp(lastSavedAt);
  if (lastSavedTimestamp != null) {
    lastSaved = new Date(lastSavedTimestamp);
  } else {
    // 알 수 없는 형식이면 현재 시간으로 설정
    return finalizeNoElapsedLazyUpdate(stats, nowMs);
  }

  const digimonSnapshot = sanitizeDigimonLogSnapshot(options?.digimonSnapshot);

  // 냉장고 시간을 제외한 경과 시간 계산
  let elapsedSeconds;
  if (stats.isFrozen && stats.frozenAt) {
    // 냉장고 상태: 냉장고에 넣은 시간 이후의 시간만 제외
    const frozenTime = typeof stats.frozenAt === 'number'
      ? stats.frozenAt
      : new Date(stats.frozenAt).getTime();
    const lastSavedTime = lastSaved.getTime();

    // 냉장고에 넣은 시간이 마지막 저장 시간보다 이후인 경우
    if (frozenTime > lastSavedTime) {
      // 냉장고에 넣기 전의 시간만 계산 (냉장고에 넣은 이후의 시간은 제외)
      elapsedSeconds = Math.floor((frozenTime - lastSavedTime) / 1000);
    } else {
      // 냉장고에 넣은 시간이 마지막 저장 시간보다 이전이거나 같은 경우
      // (냉장고에 넣은 후 저장했을 수 있음)
      // 냉장고에 넣은 이후의 시간은 모두 제외하므로 경과 시간 = 0
      elapsedSeconds = 0;
    }

    // 경과 시간이 0이면 스탯 변경 없음
    if (elapsedSeconds <= 0) {
      // 냉장고에 넣은 이후의 시간만 있었으므로 스탯 변경 없음
      // lastSavedAt만 업데이트하여 다음 lazy update가 정상 작동하도록 함
      return finalizeNoElapsedLazyUpdate(stats, nowMs, digimonSnapshot);
    }
    // 냉장고에 넣기 전의 시간이 있었다면 그 시간만큼만 스탯 변경
  } else {
    // 냉장고 상태가 아니면 일반 경과 시간 계산
    elapsedSeconds = Math.floor((nowMs - lastSaved.getTime()) / 1000);
  }

  // 경과 시간이 없거나 음수면 그대로 반환
  if (elapsedSeconds <= 0) {
    return finalizeNoElapsedLazyUpdate(stats, nowMs, digimonSnapshot);
  }

  // 사망한 경우 더 이상 업데이트하지 않음
  if (stats.isDead) {
    return finalizeNoElapsedLazyUpdate(stats, nowMs, digimonSnapshot);
  }

  // 경과 시간만큼 한 번에 업데이트
  let updatedStats = cloneStatsForProjection(stats);
  migrateLegacyPoopTimers(updatedStats);
  repairFutureZeroTiming(updatedStats, nowMs, lastSaved.getTime(), {
    statKey: "fullness",
    timerKey: "hungerTimer",
    countdownKey: "hungerCountdown",
    zeroAtKey: "lastHungerZeroAt",
    deadlineKey: "hungerMistakeDeadline",
    callKey: "hunger",
  });
  repairFutureZeroTiming(updatedStats, nowMs, lastSaved.getTime(), {
    statKey: "strength",
    timerKey: "strengthTimer",
    countdownKey: "strengthCountdown",
    zeroAtKey: "lastStrengthZeroAt",
    deadlineKey: "strengthMistakeDeadline",
    callKey: "strength",
  });

  updatedStats = {
    ...updatedStats,
    ...projectContinuousStats(updatedStats, {
      nowMs,
      elapsedSeconds,
    }),
  };

  // 배고픔 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.hungerTimer > 0) {
    const initialFullness = Math.max(0, Number(updatedStats.fullness) || 0);
    const rawHungerCountdown = Number(updatedStats.hungerCountdown);
    const initialHungerCountdown = Number.isFinite(rawHungerCountdown)
      ? Math.max(0, rawHungerCountdown)
      : updatedStats.hungerTimer * 60;
    if (updatedStats.fullness > 0) {
      updatedStats.lastHungerZeroAt = null;
      updatedStats.hungerZeroFrozenDurationMs = 0;
    }

    // 실제 수면 구간(정규 수면/낮잠/수면 조명 경고)만 제외한 활동 시간 계산
    const activeSeconds = calculateActiveSecondsForNeeds({
      elapsedSeconds,
      lastSavedAtMs: lastSaved.getTime(),
      nowMs,
      stats: updatedStats,
      sleepSchedule,
    });

    // 활동 시간만큼만 hungerCountdown 감소
    updatedStats.hungerCountdown = applyActiveCountdown(
      updatedStats.hungerCountdown,
      activeSeconds
    );

    // countdown이 0 이하가 되면 fullness 감소
    while (updatedStats.hungerCountdown <= 0) {
      updatedStats.fullness = Math.max(0, updatedStats.fullness - 1);
      updatedStats.hungerCountdown += updatedStats.hungerTimer * 60;

      // fullness가 0이 되면 lastHungerZeroAt 기록
      if (updatedStats.fullness === 0 && !updatedStats.lastHungerZeroAt) {
        const activeOffsetSeconds = initialHungerCountdown +
          (Math.max(0, initialFullness - 1) * updatedStats.hungerTimer * 60);
        updatedStats.lastHungerZeroAt = findWallTimeForActiveOffset(
          lastSaved.getTime(),
          nowMs,
          activeOffsetSeconds,
          updatedStats,
          sleepSchedule
        );
        updatedStats.hungerZeroFrozenDurationMs = 0;
      }
    }
  }

  // 힘 감소 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.strengthTimer > 0) {
    const initialStrength = Math.max(0, Number(updatedStats.strength) || 0);
    const rawStrengthCountdown = Number(updatedStats.strengthCountdown);
    const initialStrengthCountdown = Number.isFinite(rawStrengthCountdown)
      ? Math.max(0, rawStrengthCountdown)
      : updatedStats.strengthTimer * 60;
    if (updatedStats.strength > 0) {
      updatedStats.lastStrengthZeroAt = null;
      updatedStats.strengthZeroFrozenDurationMs = 0;
    }

    // 실제 수면 구간(정규 수면/낮잠/수면 조명 경고)만 제외한 활동 시간 계산
    const activeSeconds = calculateActiveSecondsForNeeds({
      elapsedSeconds,
      lastSavedAtMs: lastSaved.getTime(),
      nowMs,
      stats: updatedStats,
      sleepSchedule,
    });

    // 활동 시간만큼만 strengthCountdown 감소
    updatedStats.strengthCountdown = applyActiveCountdown(
      updatedStats.strengthCountdown,
      activeSeconds
    );

    // countdown이 0 이하가 되면 strength 감소
    while (updatedStats.strengthCountdown <= 0) {
      // strength -1 (최소 0)
      updatedStats.strength = Math.max(0, updatedStats.strength - 1);
      updatedStats.strengthCountdown += updatedStats.strengthTimer * 60;

      // strength가 0이 되면 lastStrengthZeroAt 기록
      if (updatedStats.strength === 0 && !updatedStats.lastStrengthZeroAt) {
        const activeOffsetSeconds = initialStrengthCountdown +
          (Math.max(0, initialStrength - 1) * updatedStats.strengthTimer * 60);
        updatedStats.lastStrengthZeroAt = findWallTimeForActiveOffset(
          lastSaved.getTime(),
          nowMs,
          activeOffsetSeconds,
          updatedStats,
          sleepSchedule
        );
        updatedStats.strengthZeroFrozenDurationMs = 0;
      }
    }
  }

  // 배변 처리 (수면 중에는 타이머 감소하지 않음)
  if (updatedStats.poopTimer > 0) {
    const maxValidCountdown = updatedStats.poopTimer * 60;

    // poopCountdown 초기화 체크 (undefined, null, NaN, 음수, 또는 잘못된 값)
    if (updatedStats.poopCountdown === undefined ||
        updatedStats.poopCountdown === null ||
        isNaN(updatedStats.poopCountdown) ||
        updatedStats.poopCountdown < 0 ||
        updatedStats.poopCountdown > maxValidCountdown) {
      // 초기화: poopTimer * 60 (초 단위)
      updatedStats.poopCountdown = maxValidCountdown;
    }

    // 실제 수면 구간(정규 수면/낮잠/수면 조명 경고)만 제외한 활동 시간 계산
    const activeSeconds = calculateActiveSecondsForNeeds({
      elapsedSeconds,
      lastSavedAtMs: lastSaved.getTime(),
      nowMs,
      stats: updatedStats,
      sleepSchedule,
    });

    // 활동 시간만큼만 poopCountdown 감소
    updatedStats.poopCountdown = applyActiveCountdown(
      updatedStats.poopCountdown,
      activeSeconds
    );

    while (updatedStats.poopCountdown <= 0) {
      const poopEventTime = nowMs + (updatedStats.poopCountdown * 1000);

      if (updatedStats.poopCount < 8) {
        updatedStats.poopCount++;

        if (updatedStats.poopCount === 8 && !updatedStats.poopReachedMaxAt) {
          const timeToMax = poopEventTime;
          const injuryLogText = 'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]';
          const injuryLogEventId = buildActivityLogEventId({
            type: "POOP",
            text: injuryLogText,
            timestamp: timeToMax,
          });
          updatedStats.poopReachedMaxAt = timeToMax;
          updatedStats.lastPoopPenaltyAt = timeToMax;
          updatedStats.poopPenaltyFrozenDurationMs = 0;
          applyPoopInjury(updatedStats, timeToMax);
          if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', timeToMax, 'Too much poop', injuryLogEventId)) {
            updatedStats.activityLogs = pushBackdatedActivityLog(
              updatedStats.activityLogs,
              'POOP',
              injuryLogText,
              timeToMax,
              MAX_ACTIVITY_LOGS,
              digimonSnapshot
            );
          }
        }
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      } else {
        migrateLegacyPoopTimers(updatedStats, poopEventTime);

        if (updatedStats.poopReachedMaxAt && !updatedStats.isInjured) {
          const injuryLogText = 'Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]';
          const injuryLogEventId = buildActivityLogEventId({
            type: "POOP",
            text: injuryLogText,
            timestamp: updatedStats.poopReachedMaxAt,
          });
          applyPoopInjury(updatedStats, updatedStats.poopReachedMaxAt);
          if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', updatedStats.poopReachedMaxAt, 'Too much poop', injuryLogEventId)) {
            updatedStats.activityLogs = pushBackdatedActivityLog(
              updatedStats.activityLogs,
              'POOP',
              injuryLogText,
              updatedStats.poopReachedMaxAt,
              MAX_ACTIVITY_LOGS,
              digimonSnapshot
            );
          }
        }

        const penaltyAnchor = stats_ensureTimestamp(updatedStats.lastPoopPenaltyAt) ?? stats_ensureTimestamp(updatedStats.poopReachedMaxAt);
        if (penaltyAnchor) {
          const elapsedSincePenaltyMs = fridgeTime_getElapsedTimeExcludingFridge(
            penaltyAnchor,
            nowMs,
            updatedStats.frozenAt,
            updatedStats.takeOutAt,
            updatedStats.poopPenaltyFrozenDurationMs
          );
          const periods = Math.floor((elapsedSincePenaltyMs / 1000) / 28800);
          if (periods >= 1) {
            const penaltyLogText = `똥 8개 방치 8시간 경과 x${periods} - 추가 부상 [과거 재구성]`;
            const penaltyLogEventId = buildActivityLogEventId({
              type: "POOP",
              text: penaltyLogText,
              timestamp: nowMs,
            });
            applyPoopInjury(updatedStats, nowMs, periods);
            updatedStats.lastPoopPenaltyAt = nowMs;
            updatedStats.poopPenaltyFrozenDurationMs = 0;
            if (!alreadyHasBackdatedLog(updatedStats.activityLogs, 'POOP', nowMs, '8시간 경과', penaltyLogEventId)) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'POOP',
                penaltyLogText,
                nowMs,
                MAX_ACTIVITY_LOGS,
                digimonSnapshot
              );
            }
          }
        }

        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      }
    }
  }

  // 사망 체크는 공통 evaluator를 기준으로 단일화
  if (!updatedStats.isDead) {
    const deathEvaluation = death_evaluateDeathConditions(updatedStats, nowMs);
    if (deathEvaluation.isDead) {
      updatedStats.isDead = true;
      if (deathEvaluation.reason) {
        updatedStats.deathReason = deathEvaluation.reason;
      }
      if (deathEvaluation.diedAt != null) {
        updatedStats.diedAt = deathEvaluation.diedAt;
      }
    }
  }

  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false }
    };
  }
  if (updatedStats.callStatus.hunger && updatedStats.callStatus.hunger.isLogged === undefined) {
    updatedStats.callStatus.hunger.isLogged = false;
  }
  if (updatedStats.callStatus.strength && updatedStats.callStatus.strength.isLogged === undefined) {
    updatedStats.callStatus.strength.isLogged = false;
  }
  if (updatedStats.callStatus.sleep && updatedStats.callStatus.sleep.isLogged === undefined) {
    updatedStats.callStatus.sleep.isLogged = false;
  }

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const STRENGTH_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const previousSleepCallStartedAt =
    stats_ensureTimestamp(callStatus.sleep.startedAt) ??
    stats_ensureTimestamp(updatedStats.sleepLightOnStart);
  const previousSleepCallLogged = callStatus.sleep.isLogged === true;
  const sleepLightWarningState = resolveSleepLightWarningStateInRange({
    stats: updatedStats,
    startTime: lastSaved.getTime(),
    endTime: nowMs,
    sleepSchedule,
    previousStartedAt: previousSleepCallStartedAt,
    previousLogged: previousSleepCallLogged,
  });
  const sleepRangeAnalysis = sleepLightWarningState;
  const activeSleepLightSegment = sleepLightWarningState.activeSleepLightSegment;
  const activeSleepLightEffectiveStart =
    sleepLightWarningState.activeSleepLightEffectiveStart;
  const activeSleepLightResolvedSegment =
    sleepLightWarningState.activeSleepLightResolvedSegment;
  const resolvedSleepLightSegments =
    sleepLightWarningState.resolvedSleepLightSegments;
  const expiredNapUntil = stats_ensureTimestamp(updatedStats.napUntil);
  if (expiredNapUntil != null && expiredNapUntil <= nowMs) {
    updatedStats.napUntil = null;
  }
  if (sleepRangeAnalysis.currentStatus !== "FALLING_ASLEEP") {
    updatedStats.fastSleepStart = null;
  }
  const expiredWakeUntil = stats_ensureTimestamp(updatedStats.wakeUntil);
  if (expiredWakeUntil != null && expiredWakeUntil <= nowMs) {
    updatedStats.wakeUntil = null;
  }

  // Hunger 호출 처리
  if (updatedStats.fullness === 0) {
    const hungerZeroTime = stats_ensureTimestamp(updatedStats.lastHungerZeroAt);
    const hungerStartedAt = stats_ensureTimestamp(callStatus.hunger.startedAt);
    const alreadyLogged = callStatus.hunger.isLogged === true;

    if (hungerZeroTime && alreadyLogged) {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      updatedStats.hungerMistakeDeadline = null;
    } else if (hungerZeroTime) {
      if (!hungerStartedAt) {
        callStatus.hunger.isActive = true;
        callStatus.hunger.startedAt = hungerZeroTime;
      } else {
        callStatus.hunger.isActive = true;
      }

      if (!updatedStats.hungerMistakeDeadline) {
        updatedStats.hungerMistakeDeadline = hungerZeroTime + HUNGER_CALL_TIMEOUT;
      }

      const activeStartedAt = stats_ensureTimestamp(callStatus.hunger.startedAt);
      if (activeStartedAt) {
        const elapsed = nowMs - activeStartedAt;
        if (elapsed < HUNGER_CALL_TIMEOUT) {
          callStatus.hunger.isLogged = false;
        }
      }

      if (activeStartedAt) {
        const sleepDuringCall = stats_calculateSleepLikeSecondsInRange(
          activeStartedAt,
          nowMs,
          updatedStats,
          sleepSchedule
        );
        const totalElapsedMs = nowMs - activeStartedAt;
        const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);

        if (activeCallDurationMs > HUNGER_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + HUNGER_CALL_TIMEOUT;
          const careMistakeLogText = '케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]';
          const careMistakeEventId = buildActivityLogEventId({
            type: "CAREMISTAKE",
            text: careMistakeLogText,
            timestamp: timeoutOccurredAt,
          });
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "hunger_call",
              text: careMistakeLogText,
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '배고픔 콜', careMistakeEventId)) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                careMistakeLogText,
                timeoutOccurredAt
              );
            }
            callStatus.hunger.isLogged = true;
          }
          callStatus.hunger.isActive = false;
          callStatus.hunger.startedAt = null;
          updatedStats.hungerMistakeDeadline = null;
        } else {
          const pushedStart = activeStartedAt + (sleepDuringCall * 1000);
          callStatus.hunger.startedAt = Math.min(nowMs, pushedStart);
          updatedStats.hungerMistakeDeadline =
            callStatus.hunger.startedAt + HUNGER_CALL_TIMEOUT;
        }
      }
    } else {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      updatedStats.hungerMistakeDeadline = null;
    }
  } else {
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    callStatus.hunger.isLogged = false;
    updatedStats.lastHungerZeroAt = null;
    updatedStats.hungerZeroFrozenDurationMs = 0;
    updatedStats.hungerMistakeDeadline = null;
  }

  // Strength 호출 처리
  if (updatedStats.strength === 0) {
    const strengthZeroTime = stats_ensureTimestamp(updatedStats.lastStrengthZeroAt);
    const strengthStartedAt = stats_ensureTimestamp(callStatus.strength.startedAt);
    const alreadyLogged = callStatus.strength.isLogged === true;

    if (strengthZeroTime && alreadyLogged) {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      updatedStats.strengthMistakeDeadline = null;
    } else if (strengthZeroTime) {
      if (!strengthStartedAt) {
        callStatus.strength.isActive = true;
        callStatus.strength.startedAt = strengthZeroTime;
      } else {
        callStatus.strength.isActive = true;
      }

      if (!updatedStats.strengthMistakeDeadline) {
        updatedStats.strengthMistakeDeadline = strengthZeroTime + STRENGTH_CALL_TIMEOUT;
      }

      const activeStartedAt = stats_ensureTimestamp(callStatus.strength.startedAt);
      if (activeStartedAt) {
        const strengthElapsed = nowMs - activeStartedAt;
        if (strengthElapsed < STRENGTH_CALL_TIMEOUT) {
          callStatus.strength.isLogged = false;
        }
      }

      if (activeStartedAt) {
        const sleepDuringCall = stats_calculateSleepLikeSecondsInRange(
          activeStartedAt,
          nowMs,
          updatedStats,
          sleepSchedule
        );
        const totalElapsedMs = nowMs - activeStartedAt;
        const activeCallDurationMs = totalElapsedMs - (sleepDuringCall * 1000);

        if (activeCallDurationMs > STRENGTH_CALL_TIMEOUT) {
          const timeoutOccurredAt = activeStartedAt + STRENGTH_CALL_TIMEOUT;
          const careMistakeLogText = '케어미스(사유: 힘 콜 10분 무시) [과거 재구성]';
          const careMistakeEventId = buildActivityLogEventId({
            type: "CAREMISTAKE",
            text: careMistakeLogText,
            timestamp: timeoutOccurredAt,
          });
          if (!alreadyLogged) {
            const result = appendCareMistakeEntry(updatedStats, {
              occurredAt: timeoutOccurredAt,
              reasonKey: "strength_call",
              text: careMistakeLogText,
              source: "backfill",
            });
            updatedStats.careMistakes = result.nextStats.careMistakes;
            updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
            if (result.added &&
                !alreadyHasBackdatedLog(updatedStats.activityLogs, 'CAREMISTAKE', timeoutOccurredAt, '힘 콜', careMistakeEventId)) {
              updatedStats.activityLogs = pushBackdatedActivityLog(
                updatedStats.activityLogs,
                'CAREMISTAKE',
                careMistakeLogText,
                timeoutOccurredAt
              );
            }
            callStatus.strength.isLogged = true;
          }
          callStatus.strength.isActive = false;
          callStatus.strength.startedAt = null;
          updatedStats.strengthMistakeDeadline = null;
        } else {
          const pushedStart = activeStartedAt + (sleepDuringCall * 1000);
          callStatus.strength.startedAt = Math.min(nowMs, pushedStart);
          updatedStats.strengthMistakeDeadline =
            callStatus.strength.startedAt + STRENGTH_CALL_TIMEOUT;
        }
      }
    } else {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      updatedStats.strengthMistakeDeadline = null;
    }
  } else {
    callStatus.strength.isActive = false;
    callStatus.strength.startedAt = null;
    callStatus.strength.isLogged = false;
    updatedStats.lastStrengthZeroAt = null;
    updatedStats.strengthZeroFrozenDurationMs = 0;
    updatedStats.strengthMistakeDeadline = null;
  }

  // 수면 조명 경고는 offline/lazy update 복귀 시에도 사건 단위로 복원한다.
  if (activeSleepLightSegment) {
    callStatus.sleep.isActive = true;
    callStatus.sleep.startedAt = activeSleepLightEffectiveStart;
    updatedStats.sleepLightOnStart = activeSleepLightEffectiveStart;
    callStatus.sleep.isLogged = Boolean(
      previousSleepCallLogged &&
        activeSleepLightResolvedSegment?.isContinuingPersistedIncident
    );
  } else {
    callStatus.sleep.isActive = false;
    callStatus.sleep.startedAt = null;
    callStatus.sleep.isLogged = false;
    updatedStats.sleepLightOnStart = null;
  }

  resolvedSleepLightSegments.forEach((segment) => {
    const effectiveStartedAt = segment.effectiveStartedAt;
    const segmentDurationMs = Math.max(0, segment.endedAt - effectiveStartedAt);
    if (segmentDurationMs < SLEEP_LIGHT_WARNING_TIMEOUT_MS) {
      return;
    }

    if (segment.shouldSkipLoggedTimeout) {
      return;
    }

    const timeoutOccurredAt = effectiveStartedAt + SLEEP_LIGHT_WARNING_TIMEOUT_MS;
    const careMistakeLogText = "케어미스(사유: 수면 조명 경고 30분 방치) [과거 재구성]";
    const careMistakeEventId = buildActivityLogEventId({
      type: "CAREMISTAKE",
      text: careMistakeLogText,
      timestamp: timeoutOccurredAt,
    });
    const result = appendCareMistakeEntry(updatedStats, {
      occurredAt: timeoutOccurredAt,
      reasonKey: "sleep_light_warning",
      text: careMistakeLogText,
      source: "backfill",
    });
    updatedStats.careMistakes = result.nextStats.careMistakes;
    updatedStats.careMistakeLedger = result.nextStats.careMistakeLedger;
    if (
      result.added &&
      !alreadyHasBackdatedLog(
        updatedStats.activityLogs,
        "CAREMISTAKE",
        timeoutOccurredAt,
        "수면 조명 경고",
        careMistakeEventId
      )
    ) {
      updatedStats.activityLogs = pushBackdatedActivityLog(
        updatedStats.activityLogs,
        "CAREMISTAKE",
        careMistakeLogText,
        timeoutOccurredAt
      );
    }

    if (segment.isActiveSegment) {
      callStatus.sleep.isLogged = true;
    }
  });

  // 나이 업데이트: 마지막 저장 시간부터 현재까지의 모든 자정 체크
  updatedStats = updateAgeWithLazyUpdate(updatedStats, lastSavedTimestamp, nowMs);

  // 마지막 저장 시간 업데이트
  updatedStats.lastSavedAt = nowMs;
  delete updatedStats.lastMaxPoopTime;

  return updatedStats;
}

/**
 * Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간을 계산하여
 * 스탯(배고픔, 수명 등)을 한 번에 차감
 *
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date|number|string|Object} lastSavedAt - 마지막 저장 시간 (Date, timestamp, ISO string, 또는 Firestore Timestamp)
 * @param {Object} sleepSchedule - 수면 스케줄 (선택적)
 * @param {number} maxEnergy - 최대 에너지 (선택적)
 * @returns {Object} 업데이트된 스탯
 */
function applyLazyUpdate(
  stats,
  lastSavedAt,
  sleepSchedule = null,
  maxEnergy = null,
  options = {}
) {
  const nowMs = Number.isFinite(Number(options?.nowMs))
    ? Number(options.nowMs)
    : Date.now();

  return projectState(stats, nowMs, {
    ...options,
    lastSavedAt,
    sleepSchedule,
    maxEnergy,
  });
}

;// ./src/server/gameProjectionEntry.js


module.exports = __webpack_exports__;
/******/ })()
;
