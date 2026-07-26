import { getInternalCounterTimerDisplay } from "../../utils/internalCounterTimerDisplay";

/**
 * @typedef {Object} StatsPopupStats
 * @property {number} [maxEnergy]
 * @property {number} [maxStamina]
 * @property {number} [hungerTimer]
 * @property {number} [strengthTimer]
 * @property {number} [poopTimer]
 * @property {number} [hungerCountdown]
 * @property {number} [strengthCountdown]
 * @property {number} [poopCountdown]
 * @property {number} [power]
 * @property {string} [evolutionStage]
 * @property {number} [evolutionStageStartedAt]
 * @property {number} [birthTime]
 * @property {number} [careMistakes]
 * @property {number} [injuries]
 * @property {Object} [callStatus]
 * @property {Array<Object>} [careMistakeLedger]
 * @property {Array<Object>} [battleLogs]
 */

export function formatStatsPopupDuration(seconds = 0) {
  const safeSeconds = typeof seconds === "number" && Number.isFinite(seconds)
    ? seconds
    : 0;
  const days = Math.floor(safeSeconds / 86400);
  const remainder = safeSeconds % 86400;
  const hours = Math.floor(remainder / 3600);
  const minutes = Math.floor((remainder % 3600) / 60);
  const remainingSeconds = remainder % 60;

  return `${days} day ${hours} hour ${minutes} min ${remainingSeconds} sec`;
}

export function formatStatsPopupValueWithOverflow(value = 0) {
  const base = Math.min(5, value);
  const overflow = value > 5 ? value - 5 : 0;
  return `${base}${overflow > 0 ? `(+${overflow})` : ""}`;
}

/**
 * StatsPopup의 기존 냉장고 제외 계산 계약을 보존합니다.
 * @param {number} startTime
 * @param {number} endTime
 * @param {number|string|Date|null} frozenAt
 * @param {number|string|Date|null} takeOutAt
 * @param {number} extraExcludedMs
 */
export function getStatsPopupElapsedTimeExcludingFridge(
  startTime,
  endTime,
  frozenAt = null,
  takeOutAt = null,
  extraExcludedMs = 0
) {
  const pausedMs = Number.isFinite(Number(extraExcludedMs))
    ? Math.max(0, Number(extraExcludedMs))
    : 0;
  if (!frozenAt || !startTime) {
    return Math.max(0, (endTime - startTime) - pausedMs);
  }
  const frozenTime = typeof frozenAt === "number"
    ? frozenAt
    : new Date(String(frozenAt)).getTime();
  const takeOutTime = takeOutAt
    ? (typeof takeOutAt === "number" ? takeOutAt : new Date(String(takeOutAt)).getTime())
    : endTime;
  if (frozenTime < startTime) return Math.max(0, endTime - startTime);
  if (frozenTime >= endTime) return Math.max(0, endTime - startTime);
  const frozenDuration = takeOutTime - frozenTime;
  return Math.max(0, (endTime - startTime) - frozenDuration - pausedMs);
}

function formatSleepTime(currentSleepSchedule, speciesData) {
  if (currentSleepSchedule.start !== undefined) {
    const startHour = currentSleepSchedule.start;
    const endHour = currentSleepSchedule.end;
    const startPeriod = startHour >= 12 ? "PM" : "AM";
    const endPeriod = endHour >= 12 ? "PM" : "AM";
    const startHour12 = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
    const endHour12 = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
    return `${startHour12}:00 ${startPeriod} - ${endHour12}:00 ${endPeriod}`;
  }

  const sleepTime = speciesData.sleepTime;
  if (!sleepTime || sleepTime === "N/A") return "N/A";
  const [hour, minute] = sleepTime.split(":").map(Number);
  if (Number.isNaN(hour)) return sleepTime;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function getNextEnergyRecoveryText(currentTimeMs) {
  const now = new Date(currentTimeMs);
  const currentMinute = now.getMinutes();
  const nextRecoveryTime = new Date(now);
  nextRecoveryTime.setSeconds(0);
  nextRecoveryTime.setMilliseconds(0);

  if (currentMinute < 30) {
    nextRecoveryTime.setMinutes(30);
  } else {
    nextRecoveryTime.setMinutes(0);
    nextRecoveryTime.setHours(nextRecoveryTime.getHours() + 1);
  }

  const differenceMs = nextRecoveryTime.getTime() - now.getTime();
  const minutes = Math.floor(differenceMs / 60000);
  const seconds = Math.floor((differenceMs % 60000) / 1000);
  return minutes > 0 ? `${minutes}분 ${seconds}초 후` : `${seconds}초 후`;
}

/**
 * @param {{
 *   stats?: StatsPopupStats,
 *   digimonData?: {stats?: Object}|null,
 *   sleepSchedule?: Object|null,
 *   currentTimeMs: number,
 *   getTimeUntilWakeFn: (schedule: Object, now: Date) => string,
 * }} input
 */
export function buildOverviewViewModel({
  stats = {},
  digimonData = null,
  sleepSchedule = null,
  currentTimeMs,
  getTimeUntilWakeFn,
}) {
  const speciesData = digimonData?.stats || {};
  const currentSleepSchedule = sleepSchedule || speciesData.sleepSchedule || {};
  const maxEnergy = stats.maxEnergy || stats.maxStamina || 0;

  return {
    speciesData,
    currentSleepSchedule,
    sleepTime: formatSleepTime(currentSleepSchedule, speciesData),
    speciesHungerTimer: speciesData.hungerCycle || stats.hungerTimer || 0,
    speciesStrengthTimer: speciesData.strengthCycle || stats.strengthTimer || 0,
    speciesPower: speciesData.basePower || stats.power || 0,
    speciesHealDoses: speciesData.healDoses || 1,
    wakeEnergyRecoveryText:
      currentSleepSchedule.end === undefined
        ? "정보 없음"
        : getTimeUntilWakeFn(currentSleepSchedule, new Date(currentTimeMs)),
    nextEnergyRecoveryText: getNextEnergyRecoveryText(currentTimeMs),
    hungerTimerDisplay: getInternalCounterTimerDisplay({
      evolutionStage: stats.evolutionStage,
      timerKind: "hunger",
      timerMinutes: stats.hungerTimer,
      countdownSeconds: stats.hungerCountdown,
    }),
    strengthTimerDisplay: getInternalCounterTimerDisplay({
      evolutionStage: stats.evolutionStage,
      timerKind: "strength",
      timerMinutes: stats.strengthTimer,
      countdownSeconds: stats.strengthCountdown,
    }),
    poopTimerDisplay: getInternalCounterTimerDisplay({
      evolutionStage: stats.evolutionStage,
      timerKind: "poop",
      timerMinutes: stats.poopTimer,
      countdownSeconds: stats.poopCountdown,
    }),
    maxEnergy,
  };
}

function getSleepStatusLabel(visibleSleepStatus) {
  switch (visibleSleepStatus) {
    case "FALLING_ASLEEP":
      return "잠들기 준비 중";
    case "NAPPING":
      return "낮잠 중";
    case "SLEEPING":
      return "수면 중";
    case "SLEEPING_LIGHT_ON":
      return "수면 중(불 켜짐 경고!)";
    case "AWAKE_INTERRUPTED":
      return "강제 기상 중";
    case "AWAKE":
    default:
      return "깨어있음";
  }
}

/**
 * @param {{stats?: StatsPopupStats, sleepStatus: string, isLightsOn: boolean}} input
 */
export function buildSleepViewModel({ stats = {}, sleepStatus, isLightsOn }) {
  const visibleSleepStatus = sleepStatus === "TIRED" || sleepStatus === "SLEEPY"
    ? "SLEEPING_LIGHT_ON"
    : sleepStatus;
  return {
    visibleSleepStatus,
    sleepStatusLabel: getSleepStatusLabel(visibleSleepStatus),
    isSleepLightCareMistakeProcessed:
      visibleSleepStatus === "SLEEPING_LIGHT_ON" &&
      isLightsOn &&
      stats.callStatus?.sleep?.isLogged === true,
    isSleepingLikeStatus: [
      "NAPPING",
      "SLEEPING",
      "SLEEPING_LIGHT_ON",
    ].includes(visibleSleepStatus),
  };
}

/**
 * @param {{
 *   stats?: StatsPopupStats,
 *   activityLogs?: Array<Object>,
 *   sleepStatus: string,
 *   isLightsOn: boolean,
 *   currentTimeMs: number,
 *   buildCallStatusFn: (input: Object) => {activeCalls: Array<Object>},
 *   getDisplayCareMistakesFn: (stats: StatsPopupStats, logs: Array<Object>, options: Object) => {entries: Array<Object>},
 *   getActiveCareMistakesFn: (ledger: Array<Object>) => Array<Object>,
 * }} input
 */
export function buildCareViewModel({
  stats = {},
  activityLogs = [],
  sleepStatus,
  isLightsOn,
  currentTimeMs,
  buildCallStatusFn,
  getDisplayCareMistakesFn,
  getActiveCareMistakesFn,
}) {
  const statsForCallUi = { ...stats, activityLogs };
  const callStatusViewModel = buildCallStatusFn({
    digimonStats: statsForCallUi,
    sleepStatus,
    isLightsOn,
    currentTime: currentTimeMs,
  });
  const careMistakeHistoryEntries = getDisplayCareMistakesFn(
    stats,
    activityLogs,
    { currentStageStartedAt: stats.evolutionStageStartedAt ?? null }
  ).entries;
  const activeCareMistakeCount = getActiveCareMistakesFn(
    stats.careMistakeLedger || []
  ).length;

  return {
    callStatusViewModel,
    activeCallMap: new Map(
      callStatusViewModel.activeCalls.map((call) => [call.type, call])
    ),
    careMistakeHistoryEntries,
    careMistakeDiagnosticMessage:
      (stats.careMistakes || 0) === activeCareMistakeCount
        ? null
        : "진단: 현재 케어미스 값과 원본 이력이 완전히 일치하지 않습니다. 과거 중복 로그나 레거시 슬롯 데이터가 남아 있을 수 있으며, 기존 기록은 유지한 채 새 로그부터만 중복을 막습니다.",
  };
}

/**
 * @param {{
 *   stats?: StatsPopupStats,
 *   fallbackStats?: StatsPopupStats,
 *   activityLogs?: Array<Object>,
 *   selectedDigimonId?: string|null,
 *   slotVersion?: string,
 *   digimonDataMap?: Object|null,
 *   getDisplayInjuriesFn: (input: Object) => Array<Object>,
 * }} input
 */
export function buildHealthRiskViewModel({
  stats = {},
  fallbackStats = {},
  activityLogs = [],
  selectedDigimonId = null,
  slotVersion = "Ver.1",
  digimonDataMap = null,
  getDisplayInjuriesFn,
}) {
  const injuryHistoryEntries = getDisplayInjuriesFn({
    activityLogs,
    battleLogs: stats.battleLogs || fallbackStats.battleLogs || [],
    currentLifeStartedAt: stats.birthTime ?? null,
    currentDigimonId: selectedDigimonId,
    slotVersion,
    digimonDataMap,
  });

  return {
    injuryHistoryEntries,
    injuryDiagnosticMessage:
      (stats.injuries || 0) === injuryHistoryEntries.length
        ? null
        : "진단: 이번 생 누적 부상 횟수와 표시 이력이 완전히 일치하지 않습니다. 과거 중복 로그, 레거시 기록, 또는 과거 재구성 집계 방식 차이로 보일 수 있으며 기존 데이터는 수정하지 않습니다.",
  };
}
