import {
  deriveOverallReceipt,
  isStatsPopupComponentSettled,
  isStatsPopupRetrySuperseded,
  persistStatsPopupReceiptComponents,
  shouldRetryStatsPopupComponent,
} from "./statsPopupSaveReceipt";

const expectedMatrix = {
  synced: {
    synced: "saved",
    queued: "pending",
    blocked: "warning",
    failed: "warning",
  },
  queued: {
    synced: "pending",
    queued: "pending",
    blocked: "warning",
    failed: "warning",
  },
  conflict: {
    synced: "conflict",
    queued: "conflict",
    blocked: "conflict",
    failed: "conflict",
  },
  blocked: {
    synced: "blocked",
    queued: "blocked",
    blocked: "blocked",
    failed: "blocked",
  },
  failed: {
    synced: "warning",
    queued: "warning",
    blocked: "failed",
    failed: "failed",
  },
};

describe("deriveOverallReceipt", () => {
  Object.entries(expectedMatrix).forEach(([stateStatus, logCases]) => {
    Object.entries(logCases).forEach(([logStatus, expected]) => {
      test(`${stateStatus} × ${logStatus} → ${expected}`, () => {
        expect(deriveOverallReceipt({
          state: { status: stateStatus },
          log: { status: logStatus },
        })).toMatchObject({ status: expected });
      });
    });
  });

  test("failed 구성요소만 재시도 대상으로 표시한다", () => {
    expect(deriveOverallReceipt({
      state: { status: "synced" },
      log: { status: "failed" },
    })).toMatchObject({
      retryComponents: { state: false, log: true },
      retryable: true,
    });
  });
});

test("synced와 queued는 완료된 구성요소로 취급한다", () => {
  expect(isStatsPopupComponentSettled({ status: "synced" })).toBe(true);
  expect(isStatsPopupComponentSettled({ status: "queued" })).toBe(true);
  expect(shouldRetryStatsPopupComponent({ status: "failed" })).toBe(true);
  expect(shouldRetryStatsPopupComponent({ status: "blocked" })).toBe(false);
});

test("같은 필드의 최신 command sequence가 다르면 이전 재시도를 폐기한다", () => {
  expect(isStatsPopupRetrySuperseded({ retrySequence: 3, latestSequence: 4 })).toBe(true);
  expect(isStatsPopupRetrySuperseded({ retrySequence: 4, latestSequence: 4 })).toBe(false);
});

test("재시도는 failed 구성요소만 다시 호출한다", async () => {
  const persistState = jest.fn().mockResolvedValue({ status: "synced" });
  const persistLog = jest.fn().mockResolvedValue({ status: "synced" });
  const result = await persistStatsPopupReceiptComponents({
    previousReceipt: {
      state: { status: "queued", mutationId: "state-1" },
      log: { status: "failed", eventId: "event-1" },
    },
    persistState,
    persistLog,
  });

  expect(persistState).not.toHaveBeenCalled();
  expect(persistLog).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    status: "pending",
    state: { status: "queued", mutationId: "state-1" },
    log: { status: "synced" },
  });
});

test("한 구성요소가 예외를 던져도 다른 구성요소 receipt를 수집한다", async () => {
  const persistState = jest.fn().mockRejectedValue(Object.assign(
    new Error("state failure"),
    { code: "state/offline" }
  ));
  const persistLog = jest.fn().mockResolvedValue({ status: "synced" });

  await expect(persistStatsPopupReceiptComponents({
    persistState,
    persistLog,
  })).resolves.toMatchObject({
    status: "warning",
    state: { status: "failed", errorCode: "state/offline" },
    log: { status: "synced" },
    retryComponents: { state: true, log: false },
  });
  expect(persistLog).toHaveBeenCalledTimes(1);
});
