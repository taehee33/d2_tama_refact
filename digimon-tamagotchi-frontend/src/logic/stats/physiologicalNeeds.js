/**
 * 생리 요구사항이 적용되지 않는 디지타마의 과거 저장 잔여 상태를 정리한다.
 * 감사용 케어미스/incident/활동 로그와 누적값은 절대 건드리지 않는다.
 */

function emptyNeedCall() {
  return { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false };
}

function isSameValue(left, right) {
  return left === right;
}

function hasNeedCallState(entry = {}) {
  return Boolean(
    entry?.isActive ||
    entry?.startedAt != null ||
    entry?.sleepStartAt != null ||
    entry?.isLogged
  );
}

/**
 * @param {Object} stats
 * @param {boolean} [needsApplicable=true]
 * @returns {{stats:Object, changed:boolean}}
 */
export function cleanupInapplicablePhysiologicalNeeds(stats = {}, needsApplicable = true) {
  if (needsApplicable) return { stats, changed: false };

  const callStatus = stats.callStatus || {};
  const needsCallCleanup = ["hunger", "strength", "sleep"].some((key) =>
    hasNeedCallState(callStatus[key])
  );
  const scalarKeys = [
    "hungerMistakeDeadline",
    "strengthMistakeDeadline",
    "lastHungerZeroAt",
    "lastStrengthZeroAt",
    "hungerZeroFrozenDurationMs",
    "strengthZeroFrozenDurationMs",
    "napUntil",
    "fastSleepStart",
    "sleepLightOnStart",
    "wakeUntil",
  ];
  const needsScalarCleanup = scalarKeys.some((key) => !isSameValue(stats[key], null));

  if (!needsCallCleanup && !needsScalarCleanup) {
    return { stats, changed: false };
  }

  return {
    stats: {
      ...stats,
      callStatus: {
        ...callStatus,
        hunger: emptyNeedCall(),
        strength: emptyNeedCall(),
        sleep: emptyNeedCall(),
      },
      hungerMistakeDeadline: null,
      strengthMistakeDeadline: null,
      lastHungerZeroAt: null,
      lastStrengthZeroAt: null,
      hungerZeroFrozenDurationMs: null,
      strengthZeroFrozenDurationMs: null,
      napUntil: null,
      fastSleepStart: null,
      sleepLightOnStart: null,
      wakeUntil: null,
    },
    changed: true,
  };
}

/**
 * root 슬롯의 강제기상도 수면 요구사항 transient 상태이므로 함께 정규화한다.
 * 이미 정리된 입력은 각 원본 참조를 보존한다.
 */
export function cleanupPhysiologicalNeedsState({
  stats = {},
  rootSlotFields = null,
  needsApplicable = true,
} = {}) {
  const statsResult = cleanupInapplicablePhysiologicalNeeds(stats, needsApplicable);
  const rootChanged = !needsApplicable && rootSlotFields?.wakeUntil != null;
  return {
    stats: statsResult.stats,
    rootSlotFields: rootChanged
      ? { ...rootSlotFields, wakeUntil: null }
      : rootSlotFields,
    changed: statsResult.changed || rootChanged,
  };
}
