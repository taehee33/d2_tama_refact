import { buildHealthRiskViewModel } from "./healthRiskViewModel";
import { buildCareMistakeHistoryViewModel } from "./careMistakeHistoryViewModel";
import { formatTimestamp as formatActivityTimestamp } from "../../utils/dateUtils";
import { selectCurrentStageSleepDisturbanceLogs } from "../../utils/sleepDisturbanceLogs";

const DEFAULT_HEART_MAX = 5;
const MAX_POOP_COUNT = 8;

const SLEEP_STATUS_LABELS = Object.freeze({
  AWAKE: "깨어 있음",
  FALLING_ASLEEP: "잠드는 중",
  NAPPING: "낮잠 중",
  SLEEPING: "수면 중",
  SLEEPING_LIGHT_ON: "수면 중(불 켜짐 경고!)",
  AWAKE_INTERRUPTED: "수면 방해로 깨어 있음",
});

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function toNonNegativeCount(value) {
  return Math.max(0, toFiniteNumber(value));
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const normalized = Number(value);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
  }
  return null;
}

function formatHeartValue(value) {
  const normalized = toFiniteNumber(value);
  const visibleValue = Math.min(DEFAULT_HEART_MAX, normalized);
  const overflow = normalized > DEFAULT_HEART_MAX
    ? normalized - DEFAULT_HEART_MAX
    : 0;

  return `${visibleValue}${overflow > 0 ? `(+${overflow})` : ""}/${DEFAULT_HEART_MAX}`;
}

function formatBoolean(value) {
  return value ? "예" : "아니오";
}

function formatOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return "없음";
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? `${normalized}` : "없음";
}

function formatMinutesSeconds(totalSeconds) {
  const safeSeconds = Math.floor(Math.max(0, toFiniteNumber(totalSeconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}분 ${seconds}초`;
}

function formatTimerMinutes(minutes) {
  return formatMinutesSeconds(toFiniteNumber(minutes) * 60);
}

function formatLifeDuration(totalSeconds) {
  const safeSeconds = Math.floor(Math.max(0, toFiniteNumber(totalSeconds)));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

function toDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  if (typeof value?.toMillis === "function") {
    const date = new Date(value.toMillis());
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value) {
  const date = toDate(value);
  if (!date) {
    return "없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSleepStatus(sleepStatus) {
  const normalizedSleepStatus = sleepStatus === "TIRED" || sleepStatus === "SLEEPY"
    ? "SLEEPING_LIGHT_ON"
    : sleepStatus;

  return SLEEP_STATUS_LABELS[normalizedSleepStatus] || "상태 정보 없음";
}

function buildStatusItems({ stats, digimonData, sleepStatus }) {
  const speciesStats = digimonData?.stats || digimonData || {};
  const fullness = firstDefined(stats.fullness, stats.hunger, 0);
  const winRate = firstDefined(stats.winRate, stats.winRatio, 0);
  const energy = toFiniteNumber(stats.energy);
  const maxEnergy = firstPositiveNumber(
    stats.maxEnergy,
    stats.maxStamina,
    speciesStats.maxEnergy,
    speciesStats.energy
  );

  return [
    { key: "age", label: "나이", value: `${toFiniteNumber(stats.age)}일` },
    { key: "weight", label: "몸무게", value: `${toFiniteNumber(stats.weight)}g` },
    { key: "hunger", label: "배고픔", value: formatHeartValue(fullness) },
    { key: "strength", label: "힘", value: formatHeartValue(stats.strength) },
    {
      key: "energy",
      label: "에너지(DP)",
      value: maxEnergy ? `${energy}/${maxEnergy}` : `${energy}`,
    },
    { key: "winRate", label: "승률", value: `${toFiniteNumber(winRate)}%` },
    { key: "effort", label: "노력치", value: `${toFiniteNumber(stats.effort)}` },
    { key: "careMistakes", label: "케어 미스", value: `${toFiniteNumber(stats.careMistakes)}회` },
    {
      key: "sleepDisturbances",
      label: "수면 방해",
      value: `${toNonNegativeCount(stats.sleepDisturbances)}회`,
    },
    { key: "sleep", label: "수면", value: formatSleepStatus(sleepStatus) },
    { key: "injury", label: "부상", value: stats.isInjured ? "치료 필요" : "정상" },
  ];
}

function buildSleepDisturbanceHistory(stats, activityLogs) {
  const counter = toNonNegativeCount(stats.sleepDisturbances);
  const { logs, isLegacyRange } = selectCurrentStageSleepDisturbanceLogs({
    activityLogs,
    currentStageStartedAt: stats.evolutionStageStartedAt,
  });

  return {
    counter,
    detailCount: logs.length,
    hasMissingDetails: logs.length < counter,
    isLegacyRange,
    entries: logs.map((log, index) => ({
      id: `${toFiniteNumber(log?.timestamp)}-${index}`,
      text: log?.text || "수면 방해 발생",
      timestampLabel: formatActivityTimestamp(log?.timestamp),
    })),
  };
}

function buildDiagnosticSections(stats) {
  const careMistakeLedgerCount = Array.isArray(stats.careMistakeLedger)
    ? stats.careMistakeLedger.length
    : 0;
  const hungerCall = stats.callStatus?.hunger?.isActive;
  const strengthCall = stats.callStatus?.strength?.isActive;
  const sleepCall = stats.callStatus?.sleep?.isActive;

  return [
    {
      key: "counters",
      title: "내부 카운터",
      items: [
        { label: "훈련 횟수", value: `${toFiniteNumber(stats.trainings)}회` },
        { label: "과식 횟수", value: `${toFiniteNumber(stats.overfeeds)}회` },
        { label: "프로틴 과다", value: `${toFiniteNumber(stats.proteinOverdose)}회` },
        { label: "진화용 배틀", value: `${toFiniteNumber(stats.battlesForEvolution)}회` },
        { label: "현재 형태 배틀", value: `${toFiniteNumber(stats.battles)}회` },
        { label: "현재 형태 승리", value: `${toFiniteNumber(stats.battlesWon)}회` },
        { label: "현재 형태 패배", value: `${toFiniteNumber(stats.battlesLost)}회` },
        { label: "이번 생애 누적 배틀", value: `${toFiniteNumber(stats.totalBattles)}회` },
        { label: "배변 횟수", value: `${toFiniteNumber(stats.poopCount)}/${MAX_POOP_COUNT}` },
        { label: "누적 부상", value: `${toFiniteNumber(stats.injuries)}회` },
        { label: "치료제 투여", value: `${toFiniteNumber(stats.healedDosesCurrent)}회` },
        { label: "케어 미스 상세 기록", value: `${careMistakeLedgerCount}건` },
      ],
    },
    {
      key: "timers",
      title: "주기·타이머",
      items: [
        { label: "배고픔 주기", value: formatTimerMinutes(stats.hungerTimer) },
        { label: "배고픔 남은 시간", value: formatMinutesSeconds(stats.hungerCountdown) },
        { label: "힘 주기", value: formatTimerMinutes(stats.strengthTimer) },
        { label: "힘 남은 시간", value: formatMinutesSeconds(stats.strengthCountdown) },
        { label: "배변 주기", value: formatTimerMinutes(stats.poopTimer) },
        { label: "배변 남은 시간", value: formatMinutesSeconds(stats.poopCountdown) },
        { label: "누적 수명", value: formatLifeDuration(stats.lifespanSeconds) },
        { label: "진화까지 남은 시간", value: formatMinutesSeconds(stats.timeToEvolveSeconds) },
      ],
    },
    {
      key: "flags",
      title: "상태 플래그·호출",
      items: [
        { label: "부상", value: formatBoolean(stats.isInjured) },
        { label: "냉장고 보관", value: formatBoolean(stats.isFrozen) },
        { label: "사망", value: formatBoolean(stats.isDead) },
        { label: "배고픔 호출", value: formatBoolean(hungerCall) },
        { label: "힘 호출", value: formatBoolean(strengthCall) },
        { label: "수면 호출", value: formatBoolean(sleepCall) },
      ],
    },
    {
      key: "metadata",
      title: "내부 메타데이터",
      items: [
        { label: "리비전", value: formatOptionalNumber(stats.revision) },
        { label: "마지막 저장 시각", value: formatTimestamp(stats.lastSavedAt) },
        { label: "탄생 시각", value: formatTimestamp(stats.birthTime) },
        { label: "현재 단계 시작 시각", value: formatTimestamp(stats.evolutionStageStartedAt) },
        { label: "부상 발생 시각", value: formatTimestamp(stats.injuredAt) },
        { label: "배변 한도 도달 시각", value: formatTimestamp(stats.poopReachedMaxAt) },
        { label: "마지막 배변 페널티 시각", value: formatTimestamp(stats.lastPoopPenaltyAt) },
        { label: "냉장고 보관 시각", value: formatTimestamp(stats.frozenAt) },
        { label: "냉장고에서 나온 시각", value: formatTimestamp(stats.takeOutAt) },
      ],
    },
  ];
}

/**
 * 신규 스탯 센터의 표시용 값만 정규화합니다.
 * 원본 변경, 저장 payload 생성, lazy update, 게임 규칙 재계산은 하지 않습니다.
 *
 * @param {{stats?: Object, digimonData?: Object|null, sleepStatus?: string, currentTime?: Date|number|string, activityLogs?: Array<Object>}} input
 * @returns {{statusItems: Array<{key: string, label: string, value: string}>, careMistakeHistory: Object, sleepDisturbanceHistory: Object, healthRiskItems: Array<Object>, lifespanInfo: Object, diagnosticSections: Array<Object>}}
 */
export function buildStatsCenterViewModel({
  stats = {},
  digimonData = null,
  sleepStatus = "AWAKE",
  currentTime = Date.now(),
  activityLogs = [],
} = {}) {
  const safeStats = stats || {};
  const healthRiskViewModel = buildHealthRiskViewModel(safeStats, currentTime);

  return {
    statusItems: buildStatusItems({
      stats: safeStats,
      digimonData,
      sleepStatus,
    }),
    careMistakeHistory: buildCareMistakeHistoryViewModel({
      stats: safeStats,
      activityLogs,
    }),
    sleepDisturbanceHistory: buildSleepDisturbanceHistory(safeStats, activityLogs),
    ...healthRiskViewModel,
    diagnosticSections: buildDiagnosticSections(safeStats),
  };
}

export function getDiagnosticsAccessState({
  canViewDiagnostics = false,
  isOperatorStatusLoading = false,
} = {}) {
  if (isOperatorStatusLoading) {
    return "loading";
  }

  return canViewDiagnostics ? "allowed" : "denied";
}
