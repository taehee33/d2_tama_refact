export const STATS_POPUP_OVERALL_STATUS = {
  SAVED: "saved",
  PENDING: "pending",
  WARNING: "warning",
  CONFLICT: "conflict",
  BLOCKED: "blocked",
  FAILED: "failed",
};

const SETTLED_COMPONENT_STATUSES = new Set(["synced", "queued"]);

export function shouldRetryStatsPopupComponent(receipt) {
  return receipt?.status === "failed";
}

export function isStatsPopupComponentSettled(receipt) {
  return SETTLED_COMPONENT_STATUSES.has(receipt?.status);
}

export function isStatsPopupRetrySuperseded({ retrySequence, latestSequence } = {}) {
  return retrySequence != null && latestSequence != null && retrySequence !== latestSequence;
}

/** state와 log의 독립 저장 결과를 사용자에게 표시할 하나의 결과로 합성합니다. */
export function deriveOverallReceipt({ state, log } = {}) {
  const stateStatus = state?.status || "failed";
  const logStatus = log?.status || "failed";
  let status = STATS_POPUP_OVERALL_STATUS.FAILED;

  if (stateStatus === "conflict") {
    status = STATS_POPUP_OVERALL_STATUS.CONFLICT;
  } else if (stateStatus === "blocked") {
    status = STATS_POPUP_OVERALL_STATUS.BLOCKED;
  } else if (stateStatus === "synced" && logStatus === "synced") {
    status = STATS_POPUP_OVERALL_STATUS.SAVED;
  } else if (
    (stateStatus === "synced" || stateStatus === "queued") &&
    (logStatus === "synced" || logStatus === "queued")
  ) {
    status = STATS_POPUP_OVERALL_STATUS.PENDING;
  } else if (
    (stateStatus === "synced" || stateStatus === "queued") ||
    (logStatus === "synced" || logStatus === "queued")
  ) {
    status = STATS_POPUP_OVERALL_STATUS.WARNING;
  }

  const retryComponents = {
    state: shouldRetryStatsPopupComponent(state),
    log: shouldRetryStatsPopupComponent(log),
  };
  return {
    status,
    state,
    log,
    retryComponents,
    retryable: retryComponents.state || retryComponents.log,
  };
}

/** 최초 시도는 둘 다 실행하고, 재시도는 failed 구성요소만 실행합니다. */
export async function persistStatsPopupReceiptComponents({
  previousReceipt = null,
  persistState,
  persistLog,
} = {}) {
  const runComponent = async (persistComponent) => {
    try {
      return await persistComponent();
    } catch (error) {
      return {
        status: "failed",
        errorCode: String(error?.code || "UNKNOWN"),
      };
    }
  };
  const state = !previousReceipt || shouldRetryStatsPopupComponent(previousReceipt.state)
    ? await runComponent(persistState)
    : previousReceipt.state;
  const log = !previousReceipt || shouldRetryStatsPopupComponent(previousReceipt.log)
    ? await runComponent(persistLog)
    : previousReceipt.log;
  return deriveOverallReceipt({ state, log });
}
