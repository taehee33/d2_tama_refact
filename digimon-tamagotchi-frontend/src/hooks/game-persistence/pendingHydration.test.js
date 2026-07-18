import {
  PENDING_HYDRATION_STATUS,
  resolvePendingHydration,
} from "./pendingHydration";

function createParams(overrides = {}) {
  return {
    serverRevision: 4,
    serverHydrationResult: {
      selectedDigimon: "Agumon",
      rootSlotFields: { isLightsOn: true, wakeUntil: null },
      activityLogs: [],
      digimonStats: { fullness: 2, strength: 3, isDead: false },
    },
    pendingState: {
      updatedAt: 1000,
      state: {
        baseRevision: 4,
        hasUnreplayableChanges: false,
        stateSnapshot: {
          selectedDigimon: "Agumon",
          fullness: 3,
          strength: 3,
          isDead: false,
          lastSavedAt: 900,
          activityLogs: [{ type: "FEED", timestamp: 900 }],
        },
        actions: [
          {
            eventId: "feed-1",
            type: "FEED",
            timestamp: 900,
            safe: true,
            operations: [{ field: "fullness", kind: "delta", value: 1 }],
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("resolvePendingHydration", () => {
  test("동일 revision의 안전한 action만 검증하고 pending 시점 snapshot을 반환한다", () => {
    const result = resolvePendingHydration(createParams());

    expect(result.status).toBe(PENDING_HYDRATION_STATUS.APPLY);
    expect(result.digimonStats.fullness).toBe(3);
    expect(result.digimonStats.strength).toBe(3);
    expect(result.lastSavedAt).toBe(900);
    expect(result.activityLogs).toHaveLength(1);
  });

  test("base revision이 다르면 pending snapshot을 적용하지 않는다", () => {
    const params = createParams();
    params.pendingState.state.baseRevision = 3;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "base_revision_mismatch",
      expectedRevision: 3,
      actualRevision: 4,
    });
  });

  test("base revision이 없는 구형 pending도 revision 0으로 추정하지 않는다", () => {
    const params = createParams({ serverRevision: 0 });
    delete params.pendingState.state.baseRevision;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "base_revision_mismatch",
    });
  });

  test("서버가 사망인데 pending이 생존이면 terminal state 역행으로 격리한다", () => {
    const params = createParams();
    params.serverHydrationResult.digimonStats.isDead = true;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "terminal_state_regression",
    });
  });

  test("unsafe transition이 포함되면 자동 replay하지 않는다", () => {
    const params = createParams();
    params.pendingState.state.actions = [
      { eventId: "death-1", type: "DEATH", safe: false, operations: [] },
    ];

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "unsafe_transition",
    });
  });
});
