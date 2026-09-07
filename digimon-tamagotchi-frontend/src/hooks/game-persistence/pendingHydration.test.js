import {
  PENDING_CONFLICT_CLASSIFICATION,
  PENDING_HYDRATION_STATUS,
  areComparableSnapshotsEqual,
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
    serverComparableSnapshot: {
      selectedDigimon: "Agumon",
      digimonStats: { fullness: 2, strength: 3, isDead: false },
      isLightsOn: true,
      wakeUntil: null,
    },
    localComparableSnapshot: {
      selectedDigimon: "Agumon",
      digimonStats: { fullness: 3, strength: 3, isDead: false },
      isLightsOn: true,
      wakeUntil: null,
    },
    ...overrides,
  };
}

describe("areComparableSnapshotsEqual", () => {
  test("필드 순서가 달라도 정규화된 snapshot이 같으면 동일하다", () => {
    expect(areComparableSnapshotsEqual(
      { selectedDigimon: "Agumon", digimonStats: { strength: 3, fullness: 2 } },
      { digimonStats: { fullness: 2, strength: 3 }, selectedDigimon: "Agumon" }
    )).toBe(true);
  });
});

describe("resolvePendingHydration", () => {
  test("동일 revision의 안전한 action만 검증하고 pending 시점 snapshot을 반환한다", () => {
    const result = resolvePendingHydration(createParams());

    expect(result.status).toBe(PENDING_HYDRATION_STATUS.APPLY);
    expect(result.digimonStats.fullness).toBe(3);
    expect(result.digimonStats.strength).toBe(3);
    expect(result.lastSavedAt).toBe(900);
    expect(result.activityLogs).toHaveLength(1);
    expect(result.classification).toBe(PENDING_CONFLICT_CLASSIFICATION.UNSENT_LOCAL_SAVE);
  });

  test("동일 revision의 canonical snapshot이 같으면 state pending 자동 정리를 요청한다", () => {
    const params = createParams();
    params.localComparableSnapshot = { ...params.serverComparableSnapshot };

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CLEANUP,
      expectedRevision: 4,
      actualRevision: 4,
    });
  });

  test("base revision이 다르면 pending snapshot을 적용하지 않는다", () => {
    const params = createParams();
    params.pendingState.state.baseRevision = 3;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "base_revision_mismatch",
      classification: PENDING_CONFLICT_CLASSIFICATION.TRUE_REMOTE_CONFLICT,
      expectedRevision: 3,
      actualRevision: 4,
    });
  });

  test("base revision이 없는 구형 pending도 revision 0으로 추정하지 않는다", () => {
    const params = createParams({ serverRevision: 0 });
    delete params.pendingState.state.baseRevision;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "invalid_base_revision",
      classification: PENDING_CONFLICT_CLASSIFICATION.INVALID_LOCAL_SNAPSHOT,
    });
  });

  test("서버가 사망인데 pending이 생존이면 terminal state 역행으로 격리한다", () => {
    const params = createParams();
    params.serverHydrationResult.digimonStats.isDead = true;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "terminal_state_regression",
      classification: PENDING_CONFLICT_CLASSIFICATION.TERMINAL_STATE_MISMATCH,
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
      classification: PENDING_CONFLICT_CLASSIFICATION.UNSENT_LOCAL_SAVE,
    });
  });

  test("디지몬 형태가 다르면 form mismatch로 격리한다", () => {
    const params = createParams();
    params.pendingState.state.stateSnapshot.selectedDigimon = "Gabumon";
    params.localComparableSnapshot.selectedDigimon = "Gabumon";

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      reason: "form_mismatch",
      classification: PENDING_CONFLICT_CLASSIFICATION.FORM_MISMATCH,
    });
  });

  test("snapshot 본문이 없으면 invalid local snapshot으로 격리한다", () => {
    const params = createParams();
    delete params.pendingState.state.stateSnapshot;

    expect(resolvePendingHydration(params)).toMatchObject({
      status: PENDING_HYDRATION_STATUS.CONFLICT,
      classification: PENDING_CONFLICT_CLASSIFICATION.INVALID_LOCAL_SNAPSHOT,
    });
  });
});
