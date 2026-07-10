/** 개발자 전체 조건 무시 옵션이 실제로 적용되는지 판정한다. */
export function isIgnoringAllEvolutionConditions(developerMode, ignoreEvolutionTime) {
  return Boolean(developerMode && ignoreEvolutionTime);
}

/** 개발자 모드에서는 진화 시간만 만료된 것으로 판정한다. */
export function buildEvolutionStatsForCheck(stats, developerMode) {
  if (!developerMode) return stats;

  return { ...stats, timeToEvolveSeconds: 0 };
}

/** 조그레스를 제외한 개발자용 일반 진화 후보를 만든다. */
export function getNormalEvolutionCandidates(currentDigimonData, digimonDataMap = {}) {
  const evolutions = Array.isArray(currentDigimonData?.evolutions)
    ? currentDigimonData.evolutions
    : [];

  return evolutions.reduce((candidates, evolution) => {
    if (evolution?.jogress) return candidates;

    const targetId = evolution?.targetId || evolution?.targetName || evolution?.target;
    if (!targetId) return candidates;

    const targetData =
      digimonDataMap[targetId] ||
      Object.values(digimonDataMap).find((entry) => entry?.id === targetId);

    candidates.push({
      targetId,
      label: targetData?.name || targetData?.id || targetId,
    });
    return candidates;
  }, []);
}
