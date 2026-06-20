import { getElapsedTimeExcludingFridge, toTimestamp } from "../../utils/fridgeTime";

export const DEATH_REASONS = {
  starvation: "STARVATION (굶주림)",
  exhaustion: "EXHAUSTION (힘 소진)",
  injuryOverload: "INJURY OVERLOAD (부상 과다: 15회)",
  injuryNeglect: "INJURY NEGLECT (부상 방치: 6시간)",
};

export const DEATH_THRESHOLDS = {
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

  return getElapsedTimeExcludingFridge(
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

export function evaluateDeathConditions(stats = {}, nowMs = Date.now()) {
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
