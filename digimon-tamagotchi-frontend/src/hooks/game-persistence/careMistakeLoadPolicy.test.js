import {
  CARE_MISTAKE_LOAD_ACTION,
  resolveCareMistakeLoadPolicy,
  resolveCareMistakeReconciliationRetryDelay,
} from "./careMistakeLoadPolicy";

function verifiedPlan(legacyRecoveryCount = 0) {
  return {
    canActivateProjection: true,
    status: "verified",
    recoveryBasis: { legacyRecoveryCount },
  };
}

test.each(["ambiguous", "in_progress"])(
  "stale %s 상태 문자열은 playable 슬롯을 영구 차단하지 않는다",
  (remoteReconciliationStatus) => {
    expect(resolveCareMistakeLoadPolicy({
      plan: verifiedPlan(0),
      remoteReconciliationStatus,
      remoteProjectionMatchesPlan: true,
    })).toEqual({
      action: CARE_MISTAKE_LOAD_ACTION.RECONCILE,
      status: "in_progress",
    });
  }
);

test("부족분 복구가 없고 원격 verified projection이 같으면 재쓰지 않는다", () => {
  expect(resolveCareMistakeLoadPolicy({
    plan: verifiedPlan(0),
    remoteReconciliationStatus: "verified",
    remoteProjectionMatchesPlan: true,
  }).action).toBe(CARE_MISTAKE_LOAD_ACTION.ACCEPT_VERIFIED);
});

test("legacy recovery가 필요하면 원격 projection 숫자가 같아도 reconciliation한다", () => {
  expect(resolveCareMistakeLoadPolicy({
    plan: verifiedPlan(2),
    remoteReconciliationStatus: "verified",
    remoteProjectionMatchesPlan: true,
  }).action).toBe(CARE_MISTAKE_LOAD_ACTION.RECONCILE);
});

test("읽기 실패와 손상 plan은 쓰지 않고 차단한다", () => {
  expect(resolveCareMistakeLoadPolicy({
    hasReadFailure: true,
    plan: verifiedPlan(),
  }).action).toBe(CARE_MISTAKE_LOAD_ACTION.BLOCK);
  expect(resolveCareMistakeLoadPolicy({
    plan: { canActivateProjection: false, status: "ambiguous" },
  }).action).toBe(CARE_MISTAKE_LOAD_ACTION.BLOCK);
});

test("활성 reconciliation lease 만료 시각을 자동 재시도 지연으로 변환한다", () => {
  expect(resolveCareMistakeReconciliationRetryDelay(10_000, 7_500)).toBe(2_500);
  expect(resolveCareMistakeReconciliationRetryDelay(7_000, 7_500)).toBe(0);
  expect(resolveCareMistakeReconciliationRetryDelay(null, 7_500)).toBeNull();
});
