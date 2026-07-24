import {
  normalizeGameRevision,
  replaySafeActions,
} from "../../persistence/gameRevision";

export const PENDING_HYDRATION_STATUS = {
  NONE: "none",
  CLEANUP: "cleanup",
  APPLY: "apply",
  CONFLICT: "conflict",
};

export const PENDING_CONFLICT_CLASSIFICATION = {
  UNSENT_LOCAL_SAVE: "UNSENT_LOCAL_SAVE",
  TRUE_REMOTE_CONFLICT: "TRUE_REMOTE_CONFLICT",
  INVALID_LOCAL_SNAPSHOT: "INVALID_LOCAL_SNAPSHOT",
  TERMINAL_STATE_MISMATCH: "TERMINAL_STATE_MISMATCH",
  FORM_MISMATCH: "FORM_MISMATCH",
};

function normalizeComparableValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) {
        result[key] = normalizeComparableValue(value[key]);
      }
      return result;
    }, {});
}

export function areComparableSnapshotsEqual(left, right) {
  if (!left || !right) return false;
  return JSON.stringify(normalizeComparableValue(left)) ===
    JSON.stringify(normalizeComparableValue(right));
}

function conflict(
  reason,
  classification,
  expectedRevision,
  actualRevision,
  localSavedAt = null
) {
  return {
    status: PENDING_HYDRATION_STATUS.CONFLICT,
    reason,
    classification,
    expectedRevision,
    actualRevision,
    localSavedAt,
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
  localComparableSnapshot,
  serverComparableSnapshot,
} = {}) {
  const stateEnvelope = pendingState?.state;
  const localSnapshot = stateEnvelope?.stateSnapshot;
  if (!pendingState) {
    return { status: PENDING_HYDRATION_STATUS.NONE };
  }

  const localSavedAt = localSnapshot?.lastSavedAt ?? pendingState.updatedAt ?? null;
  if (
    !stateEnvelope ||
    !localSnapshot ||
    typeof localSnapshot !== "object" ||
    Array.isArray(localSnapshot) ||
    !serverHydrationResult?.digimonStats ||
    !localComparableSnapshot ||
    !serverComparableSnapshot
  ) {
    return conflict(
      "invalid_local_snapshot",
      PENDING_CONFLICT_CLASSIFICATION.INVALID_LOCAL_SNAPSHOT,
      normalizeGameRevision(stateEnvelope?.baseRevision),
      normalizeGameRevision(serverRevision),
      localSavedAt
    );
  }

  const rawBaseRevision = Number(stateEnvelope.baseRevision);
  const hasValidBaseRevision =
    Number.isSafeInteger(rawBaseRevision) && rawBaseRevision >= 0;
  const expectedRevision = normalizeGameRevision(stateEnvelope.baseRevision);
  const actualRevision = normalizeGameRevision(serverRevision);
  if (!hasValidBaseRevision) {
    return conflict(
      "invalid_base_revision",
      PENDING_CONFLICT_CLASSIFICATION.INVALID_LOCAL_SNAPSHOT,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }
  if (expectedRevision !== actualRevision) {
    return conflict(
      "base_revision_mismatch",
      PENDING_CONFLICT_CLASSIFICATION.TRUE_REMOTE_CONFLICT,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }

  if (areComparableSnapshotsEqual(localComparableSnapshot, serverComparableSnapshot)) {
    return {
      status: PENDING_HYDRATION_STATUS.CLEANUP,
      expectedRevision,
      actualRevision,
      localSavedAt,
    };
  }

  const serverSelectedDigimon = serverHydrationResult.selectedDigimon || null;
  const localSelectedDigimon = localSnapshot.selectedDigimon || null;
  if (localSelectedDigimon !== serverSelectedDigimon) {
    return conflict(
      "form_mismatch",
      PENDING_CONFLICT_CLASSIFICATION.FORM_MISMATCH,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }

  const serverIsDead = Boolean(serverHydrationResult.digimonStats.isDead);
  const localIsDead = Boolean(localSnapshot.isDead);
  if (serverIsDead !== localIsDead) {
    return conflict(
      "terminal_state_regression",
      PENDING_CONFLICT_CLASSIFICATION.TERMINAL_STATE_MISMATCH,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }
  if (
    serverIsDead &&
    (localSnapshot.diedAt ?? null) !==
      (serverHydrationResult.digimonStats.diedAt ?? null)
  ) {
    return conflict(
      "terminal_state_regression",
      PENDING_CONFLICT_CLASSIFICATION.TERMINAL_STATE_MISMATCH,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }

  if (stateEnvelope.hasUnreplayableChanges) {
    return conflict(
      "unsafe_transition",
      PENDING_CONFLICT_CLASSIFICATION.UNSENT_LOCAL_SAVE,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }

  const replayResult = replaySafeActions(
    {
      ...serverHydrationResult.digimonStats,
      ...serverHydrationResult.rootSlotFields,
    },
    stateEnvelope.actions || []
  );
  if (replayResult.status !== "replayed") {
    return conflict(
      "unsafe_transition",
      PENDING_CONFLICT_CLASSIFICATION.UNSENT_LOCAL_SAVE,
      expectedRevision,
      actualRevision,
      localSavedAt
    );
  }

  return {
    status: PENDING_HYDRATION_STATUS.APPLY,
    expectedRevision,
    actualRevision,
    classification: PENDING_CONFLICT_CLASSIFICATION.UNSENT_LOCAL_SAVE,
    lastSavedAt: localSavedAt,
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
