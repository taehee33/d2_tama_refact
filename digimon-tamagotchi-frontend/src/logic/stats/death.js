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
      return { isDead: true, reason: DEATH_REASONS.starvation };
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
      return { isDead: true, reason: DEATH_REASONS.exhaustion };
    }
  }

  if ((stats.injuries || 0) >= DEATH_THRESHOLDS.injuryOverloadCount) {
    return { isDead: true, reason: DEATH_REASONS.injuryOverload };
  }

  if (stats.isInjured && stats.injuredAt) {
    const elapsedSinceInjury = getElapsedSince(
      stats.injuredAt,
      stats,
      safeNowMs,
      stats?.injuryFrozenDurationMs
    );
    if (elapsedSinceInjury >= DEATH_THRESHOLDS.injuryNeglectMs) {
      return { isDead: true, reason: DEATH_REASONS.injuryNeglect };
    }
  }

  if (stats.isDead) {
    return { isDead: true, reason: stats.deathReason ?? null };
  }

  return { isDead: false, reason: null };
}
