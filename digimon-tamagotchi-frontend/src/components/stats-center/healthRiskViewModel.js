import {
  DEATH_REASONS,
  DEATH_THRESHOLDS,
} from "../../logic/stats/death";
import {
  getElapsedTimeExcludingFridge,
  toTimestamp,
} from "../../utils/fridgeTime";
import { getDeathStatusText } from "../../utils/deathReasonDisplay";

const POOP_INJURY_INTERVAL_MS = 8 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function formatDuration(totalMs) {
  const safeSeconds = Math.floor(Math.max(0, toFiniteNumber(totalMs)) / 1000);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${hours}시간 ${minutes}분 ${seconds}초`;
}

function formatLifeDuration(totalSeconds) {
  const safeSeconds = Math.floor(Math.max(0, toFiniteNumber(totalSeconds)));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

function formatTimestamp(value, missingText = "없음") {
  const timestamp = toTimestamp(value);
  if (timestamp == null) {
    return missingText;
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
  }).format(new Date(timestamp));
}

function buildTimeGauge(elapsedMs, thresholdMs, segmentCount, available = true) {
  return {
    available,
    value: Math.min(thresholdMs, Math.max(0, elapsedMs)),
    max: thresholdMs,
    segmentCount,
    filledSegments: Math.min(
      segmentCount,
      Math.floor(Math.max(0, elapsedMs) / ONE_HOUR_MS)
    ),
    label: `${segmentCount}시간 게이지 (각 칸 = 1시간)`,
  };
}

function getReferenceTime(stats, currentTime) {
  return stats.isDead ? toTimestamp(stats.diedAt) : currentTime;
}

function getFixedDeadline(currentTime, elapsedMs, remainingMs, thresholdMs) {
  if (remainingMs > 0) {
    return currentTime + remainingMs;
  }

  return currentTime - Math.max(0, elapsedMs - thresholdMs);
}

function getElapsedMs(stats, startedAt, currentTime, excludedDurationKey) {
  return getElapsedTimeExcludingFridge(
    startedAt,
    currentTime,
    stats.frozenAt,
    stats.takeOutAt,
    stats[excludedDurationKey]
  );
}

function buildTimedDeathRisk({
  stats,
  currentTime,
  key,
  title,
  rule,
  isConditionActive,
  startedAt,
  startedAtLabel,
  excludedDurationKey,
  thresholdMs,
  deathReason,
}) {
  const startedAtMs = toTimestamp(startedAt);
  const isDead = Boolean(stats.isDead);
  const isDeadFromCause = isDead && stats.deathReason === deathReason;
  const isConditionMet = Boolean(isConditionActive);
  const isActive = Boolean(isConditionMet && startedAtMs != null);
  const referenceTime = getReferenceTime(stats, currentTime);
  const hasStoppedTime = !isDead || referenceTime != null;
  const canCalculateElapsed = isActive && hasStoppedTime;
  const elapsedMs = canCalculateElapsed
    ? getElapsedMs(stats, startedAtMs, referenceTime, excludedDurationKey)
    : isDeadFromCause
      ? thresholdMs
      : 0;
  const remainingMs = Math.max(0, thresholdMs - elapsedMs);

  let state = "inactive";
  let statusText = "현재 조건 미충족";

  if (isDeadFromCause) {
    state = "dead";
    statusText = "사망 원인 · 카운터 정지";
  } else if (isDead && isConditionMet) {
    state = "dead";
    statusText = "사망 · 카운터 정지";
  } else if (isDead) {
    statusText = "사망 시점 조건 미충족";
  } else if (isActive && stats.isFrozen) {
    state = "paused";
    statusText = "수명·카운터 일시정지";
  } else if (isActive && remainingMs <= 0) {
    state = "danger";
    statusText = "사망 위험";
  } else if (isActive) {
    state = "active";
    statusText = "카운트다운 진행 중";
  } else if (isConditionMet) {
    state = "active";
    statusText = "발생 시각 기록 없음";
  }

  const deadline = isActive && !stats.isFrozen && !isDead
    ? formatTimestamp(getFixedDeadline(currentTime, elapsedMs, remainingMs, thresholdMs))
    : stats.isFrozen && isActive
      ? "냉장고 해제 후 재계산"
      : "없음";

  const details = [
    { label: startedAtLabel, value: formatTimestamp(startedAtMs) },
    {
      label: "남은 시간",
      value: isConditionMet || isDeadFromCause
        ? canCalculateElapsed || isDeadFromCause
          ? formatDuration(remainingMs)
          : "기록 없음"
        : "없음",
    },
  ];

  if (isDead) {
    details.push({
      label: "정지 시각",
      value: formatTimestamp(referenceTime, "기록 없음"),
    });
  } else {
    details.push({ label: "데드라인", value: deadline });
  }

  return {
    key,
    title,
    rule,
    state,
    statusText,
    details,
    gauge: buildTimeGauge(
      elapsedMs,
      thresholdMs,
      thresholdMs / ONE_HOUR_MS,
      !isConditionMet || canCalculateElapsed || isDeadFromCause
    ),
  };
}

function buildPoopRisk(stats, currentTime) {
  const poopReachedMaxAt = toTimestamp(stats.poopReachedMaxAt ?? stats.lastMaxPoopTime);
  const lastPoopPenaltyAt = toTimestamp(stats.lastPoopPenaltyAt ?? poopReachedMaxAt);
  const isConditionMet = toFiniteNumber(stats.poopCount) >= 8;
  const isActive = isConditionMet && poopReachedMaxAt != null;
  const isDead = Boolean(stats.isDead);
  const referenceTime = getReferenceTime(stats, currentTime);
  const canCalculateElapsed = isActive && lastPoopPenaltyAt != null && referenceTime != null;
  const elapsedMs = canCalculateElapsed
    ? getElapsedTimeExcludingFridge(
      lastPoopPenaltyAt,
      referenceTime,
      stats.frozenAt,
      stats.takeOutAt,
      stats.poopPenaltyFrozenDurationMs
    )
    : 0;
  const elapsedInCycleMs = elapsedMs % POOP_INJURY_INTERVAL_MS;
  const remainingMs = isActive
    ? POOP_INJURY_INTERVAL_MS - elapsedInCycleMs
    : POOP_INJURY_INTERVAL_MS;
  const state = isDead && isConditionMet
    ? "dead"
    : isActive
      ? stats.isFrozen ? "paused" : "active"
      : "inactive";
  const statusText = isDead
    ? isConditionMet
      ? "사망 · 카운터 정지"
      : "사망 시점 조건 미충족"
    : isActive
      ? stats.isFrozen
      ? "수명·카운터 일시정지"
      : "즉시 부상 발생 · 다음 부상 카운트 중"
      : isConditionMet
        ? "도달 시각 기록 없음"
        : "현재 조건 미충족";

  const details = [
    { label: "8개 도달 시각", value: formatTimestamp(poopReachedMaxAt) },
    {
      label: "다음 부상까지",
      value: isConditionMet
        ? canCalculateElapsed ? formatDuration(remainingMs) : "기록 없음"
        : "없음",
    },
  ];

  if (isDead) {
    details.push({
      label: "정지 시각",
      value: formatTimestamp(referenceTime, "기록 없음"),
    });
  } else {
    details.push({
      label: "데드라인",
      value: isActive
        ? stats.isFrozen
          ? "냉장고 해제 후 재계산"
          : formatTimestamp(getFixedDeadline(
            currentTime,
            elapsedInCycleMs,
            remainingMs,
            POOP_INJURY_INTERVAL_MS
          ))
        : "없음",
    });
  }

  return {
    key: "poop",
    title: "배변 8개",
    rule: "8개 도달 시 즉시 부상, 이후 8시간마다 추가 부상",
    state,
    statusText,
    details,
    gauge: buildTimeGauge(
      elapsedInCycleMs,
      POOP_INJURY_INTERVAL_MS,
      8,
      !isConditionMet || canCalculateElapsed
    ),
  };
}

function buildInjuryCountRisk(stats) {
  const injuries = Math.max(0, toFiniteNumber(stats.injuries));
  const isDead = Boolean(stats.isDead);
  const isDeadFromCause = isDead && stats.deathReason === DEATH_REASONS.injuryOverload;
  const displayedInjuries = isDeadFromCause
    ? Math.max(injuries, DEATH_THRESHOLDS.injuryOverloadCount)
    : injuries;

  let state = "inactive";
  let statusText = "정상 범위";
  if (isDeadFromCause) {
    state = "dead";
    statusText = "사망 원인 · 카운터 정지";
  } else if (isDead && injuries >= 10) {
    state = "dead";
    statusText = "사망 · 카운터 정지";
  } else if (isDead) {
    statusText = "사망 시점 조건 미충족";
  } else if (injuries >= DEATH_THRESHOLDS.injuryOverloadCount) {
    state = "danger";
    statusText = "사망 위험";
  } else if (injuries >= 10) {
    state = stats.isFrozen ? "paused" : "active";
    statusText = stats.isFrozen ? "수명·카운터 일시정지" : "주의 단계";
  }

  return {
    key: "injury-overload",
    title: "누적 부상",
    rule: `${DEATH_THRESHOLDS.injuryOverloadCount}회 도달 시 사망`,
    state,
    statusText,
    details: [
      {
        label: "현재 횟수",
        value: `${displayedInjuries}/${DEATH_THRESHOLDS.injuryOverloadCount}회`,
      },
      {
        label: "사망까지",
        value: `${Math.max(0, DEATH_THRESHOLDS.injuryOverloadCount - displayedInjuries)}회`,
      },
    ],
    gauge: {
      value: Math.min(displayedInjuries, DEATH_THRESHOLDS.injuryOverloadCount),
      max: DEATH_THRESHOLDS.injuryOverloadCount,
      segmentCount: DEATH_THRESHOLDS.injuryOverloadCount,
      filledSegments: Math.min(displayedInjuries, DEATH_THRESHOLDS.injuryOverloadCount),
      label: `${DEATH_THRESHOLDS.injuryOverloadCount}회 게이지 (각 칸 = 1회)`,
    },
  };
}

/**
 * 사망·질병 위험을 화면에 표시할 값으로만 변환합니다.
 * 게임 상태를 평가하거나 저장하지 않으며 원본 객체를 변경하지 않습니다.
 */
export function buildHealthRiskViewModel(stats = {}, currentTime = Date.now()) {
  const safeStats = stats || {};
  const safeCurrentTime = toTimestamp(currentTime) ?? Date.now();

  return {
    healthRiskItems: [
      buildTimedDeathRisk({
        stats: safeStats,
        currentTime: safeCurrentTime,
        key: "hunger-zero",
        title: "배고픔 0 지속",
        rule: "12시간 후 사망",
        isConditionActive: safeStats.fullness === 0,
        startedAt: safeStats.lastHungerZeroAt,
        startedAtLabel: "배고픔 0 발생 시각",
        excludedDurationKey: "hungerZeroFrozenDurationMs",
        thresholdMs: DEATH_THRESHOLDS.zeroStatMs,
        deathReason: DEATH_REASONS.starvation,
      }),
      buildTimedDeathRisk({
        stats: safeStats,
        currentTime: safeCurrentTime,
        key: "strength-zero",
        title: "힘 0 지속",
        rule: "12시간 후 사망",
        isConditionActive: safeStats.strength === 0,
        startedAt: safeStats.lastStrengthZeroAt,
        startedAtLabel: "힘 0 발생 시각",
        excludedDurationKey: "strengthZeroFrozenDurationMs",
        thresholdMs: DEATH_THRESHOLDS.zeroStatMs,
        deathReason: DEATH_REASONS.exhaustion,
      }),
      buildPoopRisk(safeStats, safeCurrentTime),
      buildTimedDeathRisk({
        stats: safeStats,
        currentTime: safeCurrentTime,
        key: "injury-neglect",
        title: "부상 방치",
        rule: "6시간 후 사망",
        isConditionActive: Boolean(safeStats.isInjured),
        startedAt: safeStats.injuredAt,
        startedAtLabel: "부상 발생 시각",
        excludedDurationKey: "injuryFrozenDurationMs",
        thresholdMs: DEATH_THRESHOLDS.injuryNeglectMs,
        deathReason: DEATH_REASONS.injuryNeglect,
      }),
      buildInjuryCountRisk(safeStats),
    ],
    lifespanInfo: {
      label: "누적 수명",
      value: formatLifeDuration(safeStats.lifespanSeconds),
      state: safeStats.isDead ? "dead" : safeStats.isFrozen ? "paused" : "active",
      statusText: safeStats.isDead
        ? getDeathStatusText(safeStats.deathReason)
        : safeStats.isFrozen
          ? "수명 증가 일시정지"
          : "상한 없이 누적 중",
      ...(safeStats.isDead
        ? {
          stoppedAtLabel: "사망 시각",
          stoppedAtValue: formatTimestamp(safeStats.diedAt, "기록 없음"),
        }
        : {}),
    },
  };
}
