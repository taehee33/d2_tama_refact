import {
  normalizeGameRevision,
  replaySafeActions,
} from "../../persistence/gameRevision";

export const PENDING_HYDRATION_STATUS = {
  NONE: "none",
  APPLY: "apply",
  CONFLICT: "conflict",
};

function conflict(reason, expectedRevision, actualRevision) {
  return {
    status: PENDING_HYDRATION_STATUS.CONFLICT,
    reason,
    expectedRevision,
    actualRevision,
  };
}

/**
 * 서버 hydration 결과에 안전한 pending action만 재생할 수 있는지 판정합니다.
 * pending snapshot 자체는 신뢰하지 않고 terminal state 검증과 action replay에만 사용합니다.
 */
export function resolvePendingHydration({
  pendingState,
  serverRevision,
  serverHydrationResult,
} = {}) {
  const stateEnvelope = pendingState?.state;
  const localSnapshot = stateEnvelope?.stateSnapshot;
  if (!localSnapshot || !serverHydrationResult?.digimonStats) {
    return { status: PENDING_HYDRATION_STATUS.NONE };
  }

  const rawBaseRevision = Number(stateEnvelope.baseRevision);
  const hasValidBaseRevision =
    Number.isSafeInteger(rawBaseRevision) && rawBaseRevision >= 0;
  const expectedRevision = normalizeGameRevision(stateEnvelope.baseRevision);
  const actualRevision = normalizeGameRevision(serverRevision);
  if (!hasValidBaseRevision || expectedRevision !== actualRevision) {
    return conflict("base_revision_mismatch", expectedRevision, actualRevision);
  }

  if (stateEnvelope.hasUnreplayableChanges) {
    return conflict("unsafe_transition", expectedRevision, actualRevision);
  }

  const serverSelectedDigimon = serverHydrationResult.selectedDigimon || null;
  const localSelectedDigimon = localSnapshot.selectedDigimon || serverSelectedDigimon;
  if (localSelectedDigimon !== serverSelectedDigimon) {
    return conflict("unsafe_transition", expectedRevision, actualRevision);
  }

  const serverIsDead = Boolean(serverHydrationResult.digimonStats.isDead);
  const localIsDead = Boolean(localSnapshot.isDead);
  if (serverIsDead !== localIsDead) {
    return conflict("terminal_state_regression", expectedRevision, actualRevision);
  }
  if (
    serverIsDead &&
    (localSnapshot.diedAt ?? null) !==
      (serverHydrationResult.digimonStats.diedAt ?? null)
  ) {
    return conflict("terminal_state_regression", expectedRevision, actualRevision);
  }

  const replayResult = replaySafeActions(
    {
      ...serverHydrationResult.digimonStats,
      ...serverHydrationResult.rootSlotFields,
    },
    stateEnvelope.actions || []
  );
  if (replayResult.status !== "replayed") {
    return conflict("unsafe_transition", expectedRevision, actualRevision);
  }

  return {
    status: PENDING_HYDRATION_STATUS.APPLY,
    expectedRevision,
    actualRevision,
    lastSavedAt: localSnapshot.lastSavedAt ?? pendingState.updatedAt ?? null,
    selectedDigimon: serverSelectedDigimon,
    activityLogs:
      localSnapshot.activityLogs || serverHydrationResult.activityLogs || [],
    digimonStats: {
      ...localSnapshot,
      ...(serverSelectedDigimon
        ? { selectedDigimon: serverSelectedDigimon }
        : {}),
    },
  };
}
