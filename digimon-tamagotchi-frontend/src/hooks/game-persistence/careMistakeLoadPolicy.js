import { CARE_MISTAKE_RECONCILIATION_STATUS } from "../../logic/stats/careMistakeProjection";

export const CARE_MISTAKE_LOAD_ACTION = Object.freeze({
  BLOCK: "block",
  WAIT_FOR_LOCAL: "wait_for_local",
  ACCEPT_VERIFIED: "accept_verified",
  RECONCILE: "reconcile",
});

/**
 * 다른 기기의 reconciliation lease가 끝난 직후 슬롯을 다시 읽기 위한 지연값입니다.
 * Firestore에서 받은 절대 시각만 사용하며 잘못된 값은 자동 재시도하지 않습니다.
 */
export function resolveCareMistakeReconciliationRetryDelay(
  retryAt,
  nowMs = Date.now()
) {
  if (!Number.isSafeInteger(retryAt) || !Number.isSafeInteger(nowMs)) {
    return null;
  }
  return Math.max(0, retryAt - nowMs);
}

/**
 * 슬롯 로드 중 케어미스 정합성 처리 방향만 결정하는 순수 정책입니다.
 * 원격의 오래된 ambiguous/in_progress 문자열은 영구 차단 근거로 쓰지 않고,
 * 실제 활성 작업 여부는 reconciliation lease가 판정합니다.
 */
export function resolveCareMistakeLoadPolicy({
  hasReadFailure = false,
  plan = null,
  hasPendingCareTransitions = false,
  remoteReconciliationStatus = null,
  remoteProjectionMatchesPlan = false,
} = {}) {
  if (hasReadFailure || !plan?.canActivateProjection) {
    return {
      action: CARE_MISTAKE_LOAD_ACTION.BLOCK,
      status: hasReadFailure
        ? CARE_MISTAKE_RECONCILIATION_STATUS.AMBIGUOUS
        : plan?.status || CARE_MISTAKE_RECONCILIATION_STATUS.AMBIGUOUS,
    };
  }
  if (hasPendingCareTransitions) {
    return {
      action: CARE_MISTAKE_LOAD_ACTION.WAIT_FOR_LOCAL,
      status: CARE_MISTAKE_RECONCILIATION_STATUS.IN_PROGRESS,
    };
  }
  if (
    remoteReconciliationStatus === CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED &&
    remoteProjectionMatchesPlan &&
    plan.recoveryBasis?.legacyRecoveryCount === 0
  ) {
    return {
      action: CARE_MISTAKE_LOAD_ACTION.ACCEPT_VERIFIED,
      status: CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
    };
  }
  return {
    action: CARE_MISTAKE_LOAD_ACTION.RECONCILE,
    status: CARE_MISTAKE_RECONCILIATION_STATUS.IN_PROGRESS,
  };
}
