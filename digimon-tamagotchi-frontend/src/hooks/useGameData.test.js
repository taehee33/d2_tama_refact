import {
  buildFallbackSlotHydrationResult,
  createNextSlotLoadAccess,
  createGameSaveQueue,
  enqueueCareV2Patch,
  buildLazyUpdateRuntimeResult,
  buildLoadedSlotCollectionsState,
  buildLoadedSlotHydrationResult,
  buildLoadedSlotHydrationPlan,
  buildLoadedSlotRuntimeState,
  hasCompletePersistedGameplayState,
  buildComparableSlotSnapshot,
  buildSlotDocumentUpdatePayload,
  buildDigimonDisplayName,
  loadSlotCollectionsState,
  loadCareMistakeIncidents,
  loadCareMistakeReconciliationLogs,
  resolveActionLazyUpdateRuntimeContext,
  resolveLastSavedAtSource,
  resolveLazyUpdateBaseStats,
  resolvePendingNewLifeRetry,
  resolveRootSlotFields,
  raiseGameSaveError,
  sanitizeDigimonStatsForSlotDocument,
  isCurrentSlotLoadRequest,
} from "./useGameData";
import { buildFeedSummaryUpdate } from "./game-persistence/useDurableGamePersistence";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";
import { initializeStats } from "../data/stats";

describe("raiseGameSaveError", () => {
  test("저장 오류를 상태에 남기고 호출자에게 다시 전달한다", () => {
    const error = new Error("저장 실패");
    const setError = jest.fn();

    expect(() => raiseGameSaveError(error, setError)).toThrow(error);
    expect(setError).toHaveBeenCalledWith(error);
  });
});

describe("resolvePendingNewLifeRetry", () => {
  test("수동 재시도에서 pending의 기존 transitionId·identity·snapshot을 그대로 재사용한다", () => {
    const pendingTransition = {
      transitionType: "NEW_LIFE",
      transitionId: "new-life-original",
      nextDigimonInstanceId: "life-original",
      nextCombatRevision: 1,
    };
    const pendingSnapshot = {
      selectedDigimon: "DigitamaV3",
      digimonInstanceId: "life-original",
    };
    const result = resolvePendingNewLifeRetry({
      pendingState: {
        state: {
          transition: pendingTransition,
          stateSnapshot: pendingSnapshot,
        },
      },
      fallbackTransition: {
        transitionType: "NEW_LIFE",
        transitionId: "new-life-replacement",
        nextDigimonInstanceId: "life-replacement",
      },
      fallbackStatsSnapshot: { selectedDigimon: "DigitamaV3" },
    });

    expect(result.pendingTransition).toBe(pendingTransition);
    expect(result.transition.transitionId).toBe("new-life-original");
    expect(result.transition.nextDigimonInstanceId).toBe("life-original");
    expect(result.statsSnapshot).toBe(pendingSnapshot);
  });

  test("일반 사망 pending은 새 생애 snapshot으로 재사용하지 않는다", () => {
    const deadPendingSnapshot = {
      selectedDigimon: "Death5",
      isDead: true,
      deathReason: "STARVATION (굶주림)",
    };
    const newLifeSnapshot = {
      selectedDigimon: "DigitamaV5",
      isDead: false,
      deathReason: null,
    };
    const fallbackTransition = {
      transitionType: "NEW_LIFE",
      transitionId: "new-life-current",
      nextDigimonInstanceId: "life-current",
    };

    const result = resolvePendingNewLifeRetry({
      pendingState: {
        state: {
          stateSnapshot: deadPendingSnapshot,
        },
      },
      fallbackTransition,
      fallbackStatsSnapshot: newLifeSnapshot,
    });

    expect(result.pendingTransition).toBeNull();
    expect(result.transition).toBe(fallbackTransition);
    expect(result.statsSnapshot).toBe(newLifeSnapshot);
  });
});

describe("slot load generation", () => {
  test("재시도마다 generation을 올리고 이전 loaded identity를 폐기한다", () => {
    const first = createNextSlotLoadAccess({
      phase: "failed",
      generation: 4,
      loadedIdentity: { uid: "user-1", slotId: 1 },
    });
    const second = createNextSlotLoadAccess(first);

    expect(first).toMatchObject({ phase: "loading", generation: 5, loadedIdentity: null });
    expect(second).toMatchObject({ phase: "loading", generation: 6, loadedIdentity: null });
  });

  test("최신 generation의 응답만 현재 요청으로 인정한다", () => {
    const access = { generation: 8 };
    expect(isCurrentSlotLoadRequest(access, 8)).toBe(true);
    expect(isCurrentSlotLoadRequest(access, 7)).toBe(false);
  });
});

describe("buildFeedSummaryUpdate", () => {
  test("15분 bucket의 먹이 종류와 결과를 누적한다", () => {
    const result = buildFeedSummaryUpdate({
      bucketStartAt: 0,
      events: [
        { eventId: "feed-1", occurredAt: 100, payload: { kind: "meat", result: "accepted" } },
        { eventId: "feed-2", occurredAt: 200, payload: { kind: "protein", result: "refused" } },
      ],
    });

    expect(result.payload).toMatchObject({
      type: "FEED_SUMMARY",
      eventCount: 2,
      countsByKind: { meat: 1, protein: 1 },
      countsByResult: { accepted: 1, refused: 1 },
      firstOccurredAt: 100,
      lastOccurredAt: 200,
    });
  });

  test("이미 반영된 eventId는 다시 집계하지 않는다", () => {
    expect(buildFeedSummaryUpdate({
      bucketStartAt: 0,
      existing: { sourceEventIds: ["feed-1"], eventCount: 1 },
      events: [
        { eventId: "feed-1", occurredAt: 100, payload: { kind: "meat" } },
      ],
    })).toBeNull();
  });
});

describe("createGameSaveQueue", () => {
  test("겹친 저장을 호출 순서대로 직렬 실행한다", async () => {
    const queue = createGameSaveQueue();
    const order = [];
    let releaseFirst;

    const first = queue.enqueue(async () => {
      order.push("first:start");
      await new Promise((resolve) => {
        releaseFirst = resolve;
      });
      order.push("first:end");
    });
    const second = queue.enqueue(async () => {
      order.push("second");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(queue.isBusy()).toBe(true);
    expect(order).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(["first:start", "first:end", "second"]);
    expect(queue.isBusy()).toBe(false);
  });

  test("앞 저장이 실패해도 다음 저장을 계속 실행한다", async () => {
    const queue = createGameSaveQueue();
    const nextTask = jest.fn();

    await expect(
      queue.enqueue(() => Promise.reject(new Error("첫 저장 실패")))
    ).rejects.toThrow("첫 저장 실패");
    await queue.enqueue(nextTask);

    expect(nextTask).toHaveBeenCalledTimes(1);
  });
});

describe("enqueueCareV2Patch", () => {
  test("동시에 요청된 V2 patch는 앞 결과의 revision과 state를 이어서 직렬 commit한다", async () => {
    const saveQueue = createGameSaveQueue();
    let access = {
      loadedRevision: 1,
      loadedIdentity: { digimonInstanceId: "life-a" },
      careMistakeState: {
        schemaVersion: 2,
        rootReceiptId: "root-a",
        receiptId: "receipt-1",
        evolutionStageInstanceId: "stage-a",
      },
    };
    const expectedRevisions = [];
    let activeCommits = 0;
    let maxActiveCommits = 0;
    const commitCommand = jest.fn(async (_user, _slotId, command) => {
      expectedRevisions.push(command.expectedRevision);
      activeCommits += 1;
      maxActiveCommits = Math.max(maxActiveCommits, activeCommits);
      await Promise.resolve();
      activeCommits -= 1;
      const revision = command.expectedRevision + 1;
      return {
        revision,
        careMistakeState: {
          ...access.careMistakeState,
          receiptId: `receipt-${revision}`,
        },
      };
    });
    const common = {
      saveQueue,
      getAccess: () => access,
      currentUser: { uid: "canary-user" },
      slotId: 1,
      commitCommand,
      updateAccess: (patch) => { access = { ...access, ...patch }; },
      setRevision: jest.fn(),
    };

    const first = enqueueCareV2Patch({
      ...common,
      commandId: "background-a",
      payload: { updateData: { backgroundSettings: { theme: "a" } } },
    });
    const second = enqueueCareV2Patch({
      ...common,
      commandId: "immersive-a",
      payload: { updateData: { immersiveSettings: { enabled: true } } },
    });

    const results = await Promise.all([first, second]);

    expect(expectedRevisions).toEqual([1, 2]);
    expect(results.map((result) => result.revision)).toEqual([2, 3]);
    expect(access.loadedRevision).toBe(3);
    expect(access.careMistakeState.receiptId).toBe("receipt-3");
    expect(maxActiveCommits).toBe(1);
  });
});

describe("resolveRootSlotFields", () => {
  test("newStats에 최신 조명/기상 값이 있으면 그 값을 우선 사용한다", () => {
    const result = resolveRootSlotFields(
      {
        isLightsOn: false,
        wakeUntil: 123456789,
      },
      {
        isLightsOn: true,
        wakeUntil: null,
      }
    );

    expect(result).toEqual({
      isLightsOn: false,
      wakeUntil: 123456789,
    });
  });

  test("newStats에 루트 필드가 없으면 현재 훅 상태를 fallback으로 사용한다", () => {
    const result = resolveRootSlotFields(
      {},
      {
        isLightsOn: true,
        wakeUntil: 987654321,
      }
    );

    expect(result).toEqual({
      isLightsOn: true,
      wakeUntil: 987654321,
    });
  });
});

describe("buildDigimonDisplayName", () => {
  test("별명이 있으면 한글명과 함께 표시명을 만든다", () => {
    const result = buildDigimonDisplayName("Agumon", "태희", {
      Agumon: { name: "아구몬" },
    });

    expect(result).toBe("태희(아구몬)");
  });

  test("별명이 없으면 디지몬 이름만 반환한다", () => {
    const result = buildDigimonDisplayName("Agumon", "", {
      Agumon: { name: "아구몬" },
    });

    expect(result).toBe("아구몬");
  });
});

describe("sanitizeDigimonStatsForSlotDocument", () => {
  test("루트 전용 필드와 로그 컬렉션 필드를 제거한다", () => {
    const result = sanitizeDigimonStatsForSlotDocument({
      fullness: 4,
      isLightsOn: false,
      wakeUntil: 1234,
      dailySleepMistake: true,
      lastSavedAt: new Date("2026-04-07T00:00:00.000Z"),
      activityLogs: [{ type: "CALL" }],
      battleLogs: [{ mode: "quest" }],
      selectedDigimon: "Agumon",
      spriteBasePath: null,
    });

    expect(result).toEqual({
      fullness: 4,
    });
  });

  test("게임 시간 필드는 epoch ms 숫자로 정규화한다", () => {
    const result = sanitizeDigimonStatsForSlotDocument({
      birthTime: {
        seconds: 1712559600,
        nanoseconds: 500000000,
      },
      injuredAt: new Date("2026-04-07T01:23:45.000Z"),
      diedAt: new Date("2026-04-07T02:00:00.000Z"),
      callStatus: {
        hunger: {
          startedAt: "2026-04-07T03:00:00.000Z",
        },
      },
    });

    expect(result.birthTime).toBe(1712559600500);
    expect(result.injuredAt).toBe(Date.parse("2026-04-07T01:23:45.000Z"));
    expect(result.diedAt).toBe(Date.parse("2026-04-07T02:00:00.000Z"));
    expect(result.callStatus.hunger.startedAt).toBe(
      Date.parse("2026-04-07T03:00:00.000Z")
    );
  });
});

describe("buildComparableSlotSnapshot", () => {
  test("슬롯 저장 allowlist를 재사용해 로그·UI 시각은 빼고 게임 identity와 root 상태는 포함한다", () => {
    const result = buildComparableSlotSnapshot({
      stats: {
        selectedDigimon: "Agumon",
        fullness: 4,
        combatIdentity: { lifeId: "life-1" },
        evolutionStageStartedAt: new Date("2026-07-24T00:00:00.000Z"),
        activityLogs: [{ type: "FEED" }],
        battleLogs: [{ result: "win" }],
        lastSavedAt: 123,
        isLightsOn: false,
        wakeUntil: 456,
      },
      rootSlotFields: { isLightsOn: true, wakeUntil: null },
    });

    expect(result).toEqual({
      selectedDigimon: "Agumon",
      digimonStats: {
        fullness: 4,
        combatIdentity: { lifeId: "life-1" },
        evolutionStageStartedAt: Date.parse("2026-07-24T00:00:00.000Z"),
      },
      isLightsOn: false,
      wakeUntil: 456,
    });
  });
});

describe("buildSlotDocumentUpdatePayload", () => {
  test("기본 payload에 정리된 스탯, 루트 필드, 저장 시각 정보를 담는다", () => {
    const result = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
        isLightsOn: false,
        wakeUntil: 1234,
        dailySleepMistake: true,
        lastSavedAt: 4567,
        activityLogs: [{ type: "CALL" }],
      },
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: 1234,
      },
      nowMs: 9999,
    });

    expect(result).toMatchObject({
      digimonStats: {
        fullness: 4,
      },
      isLightsOn: false,
      wakeUntil: 1234,
      lastSavedAt: 4567,
    });
    expect(result.dailySleepMistake).toBeDefined();
    expect(result.lastSavedAtServer).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(result.backgroundSettings).toBeUndefined();
    expect(result.notificationEligible).toBe(false);
    expect(result.selectedDigimon).toBeUndefined();
    expect(result.digimonDisplayName).toBeUndefined();
  });

  test("로드 완료 후 선택된 디지몬이 있을 때만 표시명을 함께 저장한다", () => {
    const loadedResult = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
      },
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      selectedDigimon: "Agumon",
      digimonNickname: "태희",
      evolutionDataForSlot: {
        Agumon: { name: "아구몬" },
      },
      isLoadingSlot: false,
    });

    expect(loadedResult.selectedDigimon).toBe("Agumon");
    expect(loadedResult.digimonDisplayName).toBe("태희(아구몬)");
    expect(loadedResult.notificationEligible).toBe(true);

    const loadingResult = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
      },
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      selectedDigimon: "Agumon",
      digimonNickname: "태희",
      evolutionDataForSlot: {
        Agumon: { name: "아구몬" },
      },
      isLoadingSlot: true,
    });

    expect(loadingResult.selectedDigimon).toBeUndefined();
    expect(loadingResult.digimonDisplayName).toBeUndefined();
    expect(loadingResult.notificationEligible).toBe(false);
  });

  test("보관함/냉장 상태와 빈 슬롯은 알림 대상에서 제외한다", () => {
    const emptyResult = buildSlotDocumentUpdatePayload({
      stats: { fullness: 4 },
      isLoadingSlot: false,
    });
    const frozenResult = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
        isFrozen: true,
      },
      selectedDigimon: "Agumon",
      isLoadingSlot: false,
    });
    const refrigeratedResult = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
        isRefrigerated: true,
      },
      selectedDigimon: "Agumon",
      isLoadingSlot: false,
    });
    const restoredResult = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
        isFrozen: false,
        isRefrigerated: false,
      },
      selectedDigimon: "Agumon",
      isLoadingSlot: false,
    });

    expect(emptyResult.notificationEligible).toBe(false);
    expect(frozenResult.notificationEligible).toBe(false);
    expect(refrigeratedResult.notificationEligible).toBe(false);
    expect(restoredResult.notificationEligible).toBe(true);
  });

  test("배경화면 설정은 전달된 경우에만 포함한다", () => {
    const result = buildSlotDocumentUpdatePayload({
      stats: {
        fullness: 4,
      },
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      backgroundSettings: {
        sceneId: "forest",
        parallaxEnabled: true,
      },
    });

    expect(result.backgroundSettings).toEqual({
      sceneId: "forest",
      parallaxEnabled: true,
    });
  });
});

describe("buildLoadedSlotHydrationResult", () => {
  test("로드된 슬롯 문서를 setter 입력용 hydration 결과로 조립한다", () => {
    const result = buildLoadedSlotHydrationResult({
      slotData: {
        slotName: "내 슬롯",
        createdAt: "2026-04-11",
        device: "COLOR",
        digimonNickname: "태희",
        backgroundSettings: {
          selectedId: "forest",
          mode: "2",
        },
        immersiveSettings: {
          layoutMode: "landscape",
          skinId: "brick-ver1",
          landscapeSide: "left",
        },
      },
      slotId: 2,
      slotVersionLabel: "Ver.2",
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: 123456,
      },
      activityLogs: [{ type: "CARE", timestamp: 10 }],
      selectedDigimon: "Agumon",
      digimonStats: {
        fullness: 4,
      },
    });

    expect(result).toMatchObject({
      slotName: "내 슬롯",
      slotCreatedAt: "2026-04-11",
      slotDevice: "COLOR",
      slotVersion: "Ver.2",
      digimonNickname: "태희",
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: 123456,
      },
      backgroundSettings: {
        selectedId: "forest",
        mode: "2",
      },
      immersiveSettings: {
        layoutMode: "landscape",
        skinId: "brick-ver1",
        landscapeSide: "left",
      },
      activityLogs: [{ type: "CARE", timestamp: 10 }],
      selectedDigimon: "Agumon",
      digimonStats: {
        fullness: 4,
        selectedDigimon: "Agumon",
      },
    });
  });

  test("배경화면과 몰입형 설정이 없으면 기본값으로 hydration 한다", () => {
    const result = buildLoadedSlotHydrationResult({
      slotData: {},
      slotId: 3,
      slotVersionLabel: "Ver.1",
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      digimonStats: {
        fullness: 2,
      },
    });

    expect(result.slotName).toBe("슬롯3");
    expect(result.backgroundSettings).toEqual(DEFAULT_BACKGROUND_SETTINGS);
    expect(result.immersiveSettings).toEqual(DEFAULT_IMMERSIVE_SETTINGS);
  });

  test("선택된 디지몬과 deathReason을 hydration 결과에 함께 복원한다", () => {
    const result = buildLoadedSlotHydrationResult({
      slotData: {},
      slotId: 1,
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: 999,
      },
      digimonStats: {
        fullness: 0,
        selectedDigimon: "Greymon",
        deathReason: "굶주림",
      },
    });

    expect(result.selectedDigimon).toBe("Greymon");
    expect(result.digimonStats.selectedDigimon).toBe("Greymon");
    expect(result.deathReason).toBe("굶주림");
  });
});

describe("buildFallbackSlotHydrationResult", () => {
  test("fallback starter와 기본 설정을 함께 조립한다", () => {
    const dataMap = {
      Digitama: {
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Digitama",
        evolutionStage: "Digitama",
      },
    };

    const result = buildFallbackSlotHydrationResult({
      slotId: 4,
      dataMap,
      slotVersionLabel: "Ver.1",
    });

    expect(result.slotName).toBe("슬롯4");
    expect(result.slotVersion).toBe("Ver.1");
    expect(result.selectedDigimon).toBe("Digitama");
    expect(result.backgroundSettings).toEqual(DEFAULT_BACKGROUND_SETTINGS);
    expect(result.immersiveSettings).toEqual(DEFAULT_IMMERSIVE_SETTINGS);
    expect(result.digimonStats.birthTime).toBeDefined();
  });
});

describe("loadSlotCollectionsState", () => {
  test("subcollection loader가 값을 주면 그 결과를 우선 사용한다", async () => {
    const result = await loadSlotCollectionsState({
      slotCreatedAt: 1000,
      legacyActivityLogs: [{ type: "LEGACY", timestamp: 500 }],
      legacyBattleLogs: [{ mode: "legacy", text: "old", timestamp: 500 }],
      loadActivityEntries: async () => [
        { type: "CARE", timestamp: { seconds: 2, nanoseconds: 0 } },
      ],
      loadBattleEntries: async () => [
        { mode: "quest", text: "승리", timestamp: { seconds: 3, nanoseconds: 0 } },
      ],
    });

    expect(result.loadedActivityLogs).toEqual([
      { type: "CARE", timestamp: 2000 },
    ]);
    expect(result.loadedBattleLogs).toEqual([
      { mode: "quest", text: "승리", timestamp: 3000 },
    ]);
  });

  test("subcollection 결과가 없거나 실패하면 legacy 로그로 fallback 한다", async () => {
    const result = await loadSlotCollectionsState({
      slotCreatedAt: 1000,
      legacyActivityLogs: [{ type: "LEGACY", timestamp: { seconds: 2, nanoseconds: 0 } }],
      legacyBattleLogs: [{ mode: "legacy", text: "old", timestamp: { seconds: 4, nanoseconds: 0 } }],
      loadActivityEntries: async () => [],
      loadBattleEntries: async () => {
        throw new Error("battle read failed");
      },
    });

    expect(result.loadedActivityLogs).toEqual([
      { type: "LEGACY", timestamp: 2000 },
    ]);
    expect(result.loadedBattleLogs).toEqual([
      { mode: "legacy", text: "old", timestamp: 4000 },
    ]);
  });

  test("identity schema 적용 후에는 현재 디지몬 생애 로그만 최대 50건 로드한다", async () => {
    const currentEntries = Array.from({ length: 55 }, (_, index) => ({
      id: `current-${index}`,
      type: "CARE",
      timestamp: 1000 - index,
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-current",
    }));
    const result = await loadSlotCollectionsState({
      slotCreatedAt: 1,
      currentLifeStartedAt: 100,
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-current",
      logIdentitySchemaVersion: 1,
      legacyActivityLogs: [{ type: "OLD_ROOT", timestamp: 900 }],
      loadActivityEntries: async () => [
        ...currentEntries,
        {
          id: "previous-life",
          type: "CARE",
          timestamp: 999,
          slotInstanceId: "slot-life-1",
          digimonInstanceId: "digimon-life-old",
        },
      ],
      loadBattleEntries: async () => [],
    });

    expect(result.loadedActivityLogs).toHaveLength(50);
    expect(result.loadedActivityLogs[0].id).toBe("current-0");
    expect(result.loadedActivityLogs.some((entry) => entry.id === "previous-life"))
      .toBe(false);
    expect(result.loadedActivityLogs.some((entry) => entry.type === "OLD_ROOT"))
      .toBe(false);
  });

  test("legacy schema에서는 현재 birthTime 이후의 무식별 로그만 backfill 대상으로 반환한다", async () => {
    const result = await loadSlotCollectionsState({
      slotCreatedAt: 100,
      currentLifeStartedAt: 1000,
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-current",
      logIdentitySchemaVersion: null,
      loadActivityEntries: async () => [
        { id: "legacy-current", type: "CARE", timestamp: 1100 },
        { id: "legacy-old", type: "CARE", timestamp: 900 },
      ],
      loadBattleEntries: async () => [],
    });

    expect(result.loadedActivityLogs.map((entry) => entry.id)).toEqual([
      "legacy-current",
    ]);
    expect(result.legacyActivityEntriesToBackfill.map((entry) => entry.id)).toEqual([
      "legacy-current",
    ]);
  });
});

describe("loadCareMistakeReconciliationLogs", () => {
  test("화면 상한 50건과 무관하게 현재 stage 전체 로그를 유지한다", async () => {
    const currentStageLogs = Array.from({ length: 75 }, (_, index) => ({
      id: `current-${index}`,
      type: "CAREMISTAKE",
      timestamp: 1000 + index,
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
    }));

    const result = await loadCareMistakeReconciliationLogs({
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageStartedAt: 1000,
      loadLogs: async () => [
        { id: "previous-stage", timestamp: 999 },
        ...currentStageLogs,
        {
          id: "other-life",
          timestamp: 1100,
          slotInstanceId: "slot-life-1",
          digimonInstanceId: "digimon-life-old",
        },
      ],
    });

    expect(result).toHaveLength(75);
    expect(result[0].id).toBe("current-0");
    expect(result[74].id).toBe("current-74");
  });

  test("전체 감사 조회 실패를 빈 로그로 숨기지 않는다", async () => {
    await expect(loadCareMistakeReconciliationLogs({
      loadLogs: async () => {
        throw new Error("read failed");
      },
    })).rejects.toThrow("read failed");
  });

  test("timestamp가 손상된 care 로그는 plan 검증을 위해 버리지 않는다", async () => {
    const result = await loadCareMistakeReconciliationLogs({
      evolutionStageStartedAt: 1000,
      loadLogs: async () => [{
        id: "broken-care",
        type: "CAREMISTAKE",
        text: "케어미스",
        timestamp: "not-a-date",
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("broken-care");
  });
});

describe("loadCareMistakeIncidents", () => {
  test("필수 stage/timestamp가 손상된 raw incident를 plan 전에 숨기지 않는다", async () => {
    const incidents = [{
      incidentId: "broken-incident",
      digimonInstanceId: "life-1",
      occurredAt: null,
    }];
    await expect(loadCareMistakeIncidents({
      digimonInstanceId: "life-1",
      evolutionStageInstanceId: "stage-1",
      loadIncidents: async () => incidents,
    })).resolves.toEqual(incidents);
  });
});

describe("buildLoadedSlotCollectionsState", () => {
  test("로드한 activity/battle logs를 저장된 stats에 합치고 cleanup 힌트를 반환한다", () => {
    const result = buildLoadedSlotCollectionsState({
      savedStats: {
        fullness: 4,
        proteinCount: 3,
      },
      loadedActivityLogs: [
        { type: "CARE", timestamp: 2000 },
        { type: "BATTLE", timestamp: 1000 },
      ],
      loadedBattleLogs: [
        {
          mode: "quest",
          text: "승리",
          timestamp: { seconds: 1, nanoseconds: 500000000 },
        },
      ],
    });

    expect(result.needsProteinCountCleanup).toBe(true);
    expect(result.savedStats.proteinCount).toBeUndefined();
    expect(result.savedStats.activityLogs.map((entry) => entry.type)).toEqual([
      "BATTLE",
      "CARE",
    ]);
    expect(result.savedStats.battleLogs[0].timestamp).toBe(1500);
  });
});

describe("buildLazyUpdateRuntimeResult", () => {
  test("lazy update 결과와 새로 생긴 로그 목록을 함께 반환한다", () => {
    const dataMap = {
      Agumon: {
        name: "아구몬",
        sprite: 42,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Child",
        evolutionStage: "Child",
        stats: {
          maxEnergy: 10,
          sleepSchedule: { start: 21, end: 7 },
        },
      },
    };
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);

    const result = buildLazyUpdateRuntimeResult({
      baseStats: {
        ...initializeStats("Agumon", {}, dataMap),
        activityLogs: [{ type: "CARE", timestamp: 900 }],
      },
      lastSavedAt: 1000,
      sleepSchedule: { start: 21, end: 7 },
      maxEnergy: 10,
      selectedDigimon: "Agumon",
      evolutionDataForSlot: dataMap,
      dataMap,
      slotRuntimeDataMap: dataMap,
      runtimeAdaptedDataMaps: { "Ver.1": dataMap },
    });

    expect(result.digimonStats.activityLogs).toEqual([
      { type: "CARE", timestamp: 900 },
    ]);
    expect(result.reconstructedLogsToPersist).toEqual([]);

    nowSpy.mockRestore();
  });

  test("30분 지난 pending 스냅샷을 실행 시각까지 한 번만 투영한다", () => {
    const lastSavedAt = Date.parse("2026-07-26T11:30:00.000Z");
    const executionNow = Date.parse("2026-07-26T12:00:00.000Z");
    const dataMap = {
      Agumon: {
        name: "아구몬",
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Child",
        evolutionStage: "Child",
        stats: { maxEnergy: 10 },
      },
    };
    const pendingStats = {
      ...initializeStats("Agumon", {}, dataMap),
      selectedDigimon: "Agumon",
      evolutionStage: "Child",
      lifespanSeconds: 100,
      timeToEvolveSeconds: 10_000,
      lastSavedAt,
      activityLogs: [],
    };

    const first = buildLazyUpdateRuntimeResult({
      baseStats: pendingStats,
      lastSavedAt,
      selectedDigimon: "Agumon",
      dataMap,
      nowMs: executionNow,
    }).digimonStats;
    const second = buildLazyUpdateRuntimeResult({
      baseStats: first,
      lastSavedAt: first.lastSavedAt,
      selectedDigimon: "Agumon",
      dataMap,
      nowMs: executionNow,
    }).digimonStats;

    expect(first.lifespanSeconds).toBe(1_900);
    expect(first.lastSavedAt).toBe(executionNow);
    expect(second.lifespanSeconds).toBe(first.lifespanSeconds);
    expect(second.timeToEvolveSeconds).toBe(first.timeToEvolveSeconds);
  });
});

describe("resolveActionLazyUpdateRuntimeContext", () => {
  test("같은 단계가 여러 개면 selectedDigimon 데이터를 우선 사용한다", () => {
    const dataMap = {
      Greymon: {
        evolutionStage: "Adult",
        stage: "Adult",
        stats: { maxEnergy: 10, sleepSchedule: { start: 22, end: 6 } },
      },
      Devimon: {
        evolutionStage: "Adult",
        stage: "Adult",
        stats: { maxEnergy: 14, sleepSchedule: { start: 1, end: 9 } },
      },
    };

    const result = resolveActionLazyUpdateRuntimeContext({
      digimonStats: { evolutionStage: "Adult" },
      slotRuntimeDataMap: dataMap,
      selectedDigimon: "Devimon",
    });

    expect(result).toEqual({
      currentDigimonName: "Devimon",
      sleepSchedule: { start: 1, end: 9 },
      maxEnergy: 14,
      needsApplicable: true,
    });
  });

  test("evolutionStage로 현재 디지몬을 찾아 sleepSchedule과 maxEnergy를 반환한다", () => {
    const dataMap = {
      Agumon: {
        evolutionStage: "Child",
        stage: "Child",
        stats: {
          maxEnergy: 10,
          sleepSchedule: { start: 21, end: 7 },
        },
      },
    };

    const result = resolveActionLazyUpdateRuntimeContext({
      digimonStats: {
        evolutionStage: "Child",
        maxEnergy: 4,
      },
      slotRuntimeDataMap: dataMap,
    });

    expect(result).toEqual({
      currentDigimonName: "Agumon",
      sleepSchedule: { start: 21, end: 7 },
      maxEnergy: 10,
      needsApplicable: true,
    });
  });

  test("sleepSchedule이 없으면 stage 기본 수면시간으로 fallback 한다", () => {
    const dataMap = {
      Greymon: {
        evolutionStage: "Adult",
        stage: "Adult",
        stats: {},
      },
    };

    const result = resolveActionLazyUpdateRuntimeContext({
      digimonStats: {
        evolutionStage: "Adult",
        maxStamina: 6,
      },
      slotRuntimeDataMap: dataMap,
    });

    expect(result).toEqual({
      currentDigimonName: "Greymon",
      sleepSchedule: { start: 22, end: 6 },
      maxEnergy: 6,
      needsApplicable: true,
    });
  });

  test("런타임 데이터가 없으면 Digitama/null context를 반환한다", () => {
    const result = resolveActionLazyUpdateRuntimeContext({
      digimonStats: {
        evolutionStage: "Child",
      },
      slotRuntimeDataMap: null,
    });

    expect(result).toEqual({
      currentDigimonName: "Digitama",
      sleepSchedule: null,
      maxEnergy: null,
      needsApplicable: false,
    });
  });
});

describe("buildLoadedSlotRuntimeState", () => {
  test("저장된 슬롯 stats를 runtime digimonStats로 재구성한다", () => {
    const dataMap = {
      Agumon: {
        name: "아구몬",
        sprite: 42,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Child",
        evolutionStage: "Child",
        stats: {
          maxEnergy: 10,
          sleepSchedule: { start: 21, end: 7 },
        },
      },
    };
    const baseStats = initializeStats("Agumon", {}, dataMap);
    const collectionsState = buildLoadedSlotCollectionsState({
      savedStats: {
        ...baseStats,
        sprite: 1,
        proteinCount: 3,
      },
      loadedActivityLogs: [
        { type: "CARE", timestamp: 2000 },
        { type: "BATTLE", timestamp: 1000 },
      ],
      loadedBattleLogs: [
        {
          mode: "quest",
          text: "승리",
          timestamp: { seconds: 1, nanoseconds: 500000000 },
        },
      ],
    });
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);

    const result = buildLoadedSlotRuntimeState({
      slotData: {
        lastSavedAt: 1000,
      },
      savedName: "Agumon",
      savedStats: collectionsState.savedStats,
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: null,
      },
      dataMap,
      slotRuntimeDataMap: dataMap,
      runtimeAdaptedDataMaps: { "Ver.1": dataMap },
      evolutionDataForSlot: dataMap,
    });

    expect(result.digimonStats.activityLogs.map((entry) => entry.type)).toEqual([
      "BATTLE",
      "CARE",
    ]);
    expect(result.digimonStats.battleLogs[0].timestamp).toBe(1500);
    expect(result.digimonStats.sprite).toBe(42);
    expect(result.reconstructedLogsToPersist).toEqual([]);

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test("스타터 디지몬의 timeToEvolveSeconds가 비어 있으면 데이터맵 기본값으로 보정한다", () => {
    const dataMap = {
      Digitama: {
        name: "디지타마",
        sprite: 7,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Digitama",
        evolutionStage: "Digitama",
        timeToEvolveSeconds: 600,
        stats: {
          maxEnergy: 0,
          sleepSchedule: { start: 20, end: 8 },
        },
      },
    };
    const baseStats = initializeStats("Digitama", {}, dataMap);
    const collectionsState = buildLoadedSlotCollectionsState({
      savedStats: {
        ...baseStats,
        timeToEvolveSeconds: 0,
      },
      loadedActivityLogs: [],
      loadedBattleLogs: [],
    });
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);

    const result = buildLoadedSlotRuntimeState({
      slotData: {
        lastSavedAt: 1000,
      },
      savedName: "Digitama",
      savedStats: collectionsState.savedStats,
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      dataMap,
      slotRuntimeDataMap: dataMap,
      runtimeAdaptedDataMaps: { "Ver.1": dataMap },
      evolutionDataForSlot: dataMap,
    });

    expect(result.digimonStats.timeToEvolveSeconds).toBe(600);

    nowSpy.mockRestore();
  });
});

describe("buildLoadedSlotHydrationPlan", () => {
  test("저장된 stats가 없으면 자동 초기화 없이 hydration을 차단한다", () => {
    const dataMap = {
      Digitama: {
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Digitama",
        evolutionStage: "Digitama",
      },
    };
    expect(() => buildLoadedSlotHydrationPlan({
      slotData: { slotName: "빈 슬롯" },
      slotId: 1,
      slotVersionLabel: "Ver.1",
      rootSlotFields: { isLightsOn: true, wakeUntil: null },
      loadedActivityLogs: [{ type: "CARE", timestamp: 1000 }],
      savedName: "Digitama",
      savedStats: {},
      dataMap,
    })).toThrow(expect.objectContaining({ code: "game/slot-load-incomplete" }));
  });

  test("저장된 stats가 있으면 runtime rebuild를 거친 hydration 결과를 반환한다", () => {
    const dataMap = {
      Agumon: {
        name: "아구몬",
        sprite: 42,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Child",
        evolutionStage: "Child",
        stats: {
          maxEnergy: 10,
          sleepSchedule: { start: 21, end: 7 },
        },
      },
    };
    const baseStats = initializeStats("Agumon", {}, dataMap);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = buildLoadedSlotHydrationPlan({
      slotData: {
        slotName: "저장 슬롯",
        lastSavedAt: 1000,
      },
      slotId: 2,
      slotVersionLabel: "Ver.1",
      rootSlotFields: {
        isLightsOn: false,
        wakeUntil: null,
      },
      loadedActivityLogs: [{ type: "CARE", timestamp: 900 }],
      savedName: "Agumon",
      savedStats: {
        ...baseStats,
        birthTime: 1000,
        evolutionStageStartedAt: 1000,
        sprite: 1,
        activityLogs: [{ type: "CARE", timestamp: 900 }],
        battleLogs: [],
      },
      dataMap,
      slotRuntimeDataMap: dataMap,
      runtimeAdaptedDataMaps: { "Ver.1": dataMap },
      evolutionDataForSlot: dataMap,
    });

    expect(result.reconstructedLogsToPersist).toEqual([]);
    expect(result.hydrationResult.slotName).toBe("저장 슬롯");
    expect(result.hydrationResult.selectedDigimon).toBe("Agumon");
    expect(result.hydrationResult.digimonStats.sprite).toBe(42);

    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test("reconciliation projection만 있는 부분 stats는 자동 초기화 없이 차단한다", () => {
    const dataMap = {
      Digitama: {
        sprite: 7,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Digitama",
        evolutionStage: "Digitama",
        timeToEvolveSeconds: 600,
      },
    };

    expect(() => buildLoadedSlotHydrationPlan({
      slotData: {
        slotName: "새 슬롯",
        createdAt: 1000,
        lastSavedAt: 1000,
      },
      slotId: 5,
      slotVersionLabel: "Ver.1",
      rootSlotFields: { isLightsOn: true, wakeUntil: null },
      loadedActivityLogs: [],
      savedName: "Digitama",
      savedStats: {
        careMistakes: 0,
        unresolvedCareMistakeCount: 0,
        careMistakeReconciliationStatus: "verified",
        evolutionStageInstanceId: "stage:life-5:Digitama:1000",
        activityLogs: [],
        battleLogs: [],
      },
      dataMap,
    })).toThrow(expect.objectContaining({ code: "game/slot-load-incomplete" }));
  });

  test.each([
    ["빈 stats", {}],
    ["projection-only", {
      careMistakes: 0,
      careMistakeSchemaVersion: 2,
      evolutionStageInstanceId: "stage-a",
    }],
    ["일부 gameplay field", { birthTime: 1000 }],
  ])("%s는 load invariant를 충족하지 않는다", (_name, savedStats) => {
    expect(hasCompletePersistedGameplayState({
      slotData: { lastSavedAt: 1000 },
      savedStats,
    })).toBe(false);
  });

  test("필수 timer 또는 생애·진화 timestamp가 하나라도 없으면 load invariant를 충족하지 않는다", () => {
    const dataMap = {
      Digitama: {
        evolutionStage: "Digitama",
        hungerTimer: 0,
        strengthTimer: 0,
        poopTimer: 999,
        timeToEvolveSeconds: 8,
      },
    };
    const complete = {
      ...initializeStats("Digitama", {}, dataMap, { nowMs: 1000 }),
      lastSavedAt: 1000,
    };
    const withoutTimer = { ...complete };
    delete withoutTimer.hungerCountdown;
    const withoutBirthTime = { ...complete };
    delete withoutBirthTime.birthTime;
    const withoutEvolutionStageStartedAt = { ...complete };
    delete withoutEvolutionStageStartedAt.evolutionStageStartedAt;

    const variants = [withoutTimer, withoutBirthTime, withoutEvolutionStageStartedAt];
    variants.forEach((savedStats) => expect(hasCompletePersistedGameplayState({
      slotData: { lastSavedAt: 1000 },
      savedStats,
    })).toBe(false));
  });

  test("오염된 server timestamp는 유효한 numeric fallback이 있을 때만 load invariant를 통과한다", () => {
    const dataMap = {
      Digitama: {
        evolutionStage: "Digitama",
        hungerTimer: 0,
        strengthTimer: 0,
        poopTimer: 999,
        timeToEvolveSeconds: 8,
      },
    };
    const complete = initializeStats("Digitama", {}, dataMap, { nowMs: 1000 });
    const malformedServerTimestamp = { _methodName: "serverTimestamp" };

    expect(hasCompletePersistedGameplayState({
      slotData: { lastSavedAtServer: malformedServerTimestamp, lastSavedAt: 1000 },
      savedStats: complete,
    })).toBe(true);
    expect(hasCompletePersistedGameplayState({
      slotData: { lastSavedAtServer: malformedServerTimestamp },
      savedStats: { ...complete, lastSavedAt: Number.NaN },
    })).toBe(false);
  });

  test.each([
    ["V1 legacy", (stats) => ({
      slotData: { lastSavedAt: 1000 },
      savedStats: Object.fromEntries(
        Object.entries(stats).filter(([key]) => key !== "lastSavedAt")
      ),
    })],
    ["V2 migrated", (stats) => ({
      slotData: { lastSavedAtServer: { toMillis: () => 1000 } },
      savedStats: {
        ...stats,
        careMistakeSchemaVersion: 2,
        careMistakeReconciliationStatus: "verified",
      },
    })],
    ["V2 native-init", (stats) => ({
      slotData: { lastSavedAt: 1000, careMistakeState: { schemaVersion: 2 } },
      savedStats: {
        ...stats,
        careMistakeSchemaVersion: 2,
        careMistakeReconciliationStatus: "verified",
      },
    })],
  ])("정상 %s 슬롯은 기존 timestamp를 보존해 hydration한다", (_name, buildFixture) => {
    const dataMap = {
      Digitama: {
        sprite: 7,
        evolutionStage: "Digitama",
        hungerTimer: 0,
        strengthTimer: 0,
        poopTimer: 999,
        timeToEvolveSeconds: 8,
        stats: { maxEnergy: 0, sleepSchedule: { start: 20, end: 8 } },
      },
    };
    const initialized = {
      ...initializeStats("Digitama", {}, dataMap, { nowMs: 1000 }),
      lastSavedAt: 1000,
    };
    const fixture = buildFixture(initialized);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(2000);

    const result = buildLoadedSlotHydrationPlan({
      ...fixture,
      slotId: 1,
      slotVersionLabel: "Ver.1",
      rootSlotFields: { isLightsOn: true, wakeUntil: null },
      loadedActivityLogs: [],
      savedName: "Digitama",
      dataMap,
      slotRuntimeDataMap: dataMap,
      runtimeAdaptedDataMaps: { "Ver.1": dataMap },
      evolutionDataForSlot: dataMap,
    });

    expect(result.hydrationResult.digimonStats.birthTime).toBe(1000);
    expect(result.hydrationResult.digimonStats.evolutionStageStartedAt).toBe(1000);
    expect(result.hydrationResult.digimonStats.lifespanSeconds).toBeGreaterThanOrEqual(1);
    nowSpy.mockRestore();
  });

  test("신규 저장 상태를 재접속해도 생애·진화·배고픔·힘·똥 진행값을 초기화하지 않는다", () => {
    const dataMap = {
      Digitama: {
        sprite: 7,
        evolutionStage: "Digitama",
        fullness: 5,
        strength: 5,
        hungerTimer: 1,
        strengthTimer: 1,
        poopTimer: 1,
        timeToEvolveSeconds: 120,
        stats: { maxEnergy: 0, sleepSchedule: { start: 23, end: 7 } },
      },
    };
    const createdAt = 1_000;
    const persistedStats = {
      ...initializeStats("Digitama", {}, dataMap, { nowMs: createdAt }),
      lastSavedAt: createdAt,
    };
    const hydrateAt = (nowMs) => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(nowMs);
      try {
        return buildLoadedSlotHydrationPlan({
          slotData: { createdAt, lastSavedAt: createdAt },
          slotId: 1,
          slotVersionLabel: "Ver.1",
          rootSlotFields: { isLightsOn: true, wakeUntil: null },
          loadedActivityLogs: [],
          savedName: "Digitama",
          savedStats: persistedStats,
          dataMap,
          slotRuntimeDataMap: dataMap,
          runtimeAdaptedDataMaps: { "Ver.1": dataMap },
          evolutionDataForSlot: dataMap,
        }).hydrationResult.digimonStats;
      } finally {
        nowSpy.mockRestore();
      }
    };

    const firstReconnect = hydrateAt(31_000);
    const secondReconnect = hydrateAt(41_000);

    expect(secondReconnect.birthTime).toBe(createdAt);
    expect(secondReconnect.evolutionStageStartedAt).toBe(createdAt);
    expect(secondReconnect.lifespanSeconds).toBeGreaterThan(firstReconnect.lifespanSeconds);
    expect(secondReconnect.timeToEvolveSeconds).toBeLessThan(firstReconnect.timeToEvolveSeconds);
    expect(secondReconnect.hungerCountdown).toBe(firstReconnect.hungerCountdown);
    expect(secondReconnect.strengthCountdown).toBe(firstReconnect.strengthCountdown);
    expect(secondReconnect.poopCountdown).toBeLessThan(firstReconnect.poopCountdown);
  });
});

describe("resolveLastSavedAtSource", () => {
  test("서버 기준 저장 시각을 최우선으로 사용한다", () => {
    const serverTimestamp = {
      toMillis: () => 3000,
    };

    expect(
      resolveLastSavedAtSource(
        {
          lastSavedAtServer: serverTimestamp,
          lastSavedAt: 2000,
        },
        {
          lastSavedAt: 1500,
        },
        {
          lastSavedAt: 1000,
        }
      )
    ).toBe(serverTimestamp);
  });

  test("서버 시각이 없으면 숫자 lastSavedAt fallback을 사용한다", () => {
    expect(
      resolveLastSavedAtSource(
        {},
        {
          lastSavedAt: 1500,
        },
        {
          lastSavedAt: 1000,
        }
      )
    ).toBe(1500);
  });

  test("오염된 서버 시각은 건너뛰고 유효한 root lastSavedAt을 사용한다", () => {
    expect(
      resolveLastSavedAtSource(
        {
          lastSavedAtServer: { _methodName: "serverTimestamp" },
          lastSavedAt: 2000,
        },
        { lastSavedAt: 1500 },
        { lastSavedAt: 1000 }
      )
    ).toBe(2000);
  });

  test("오염된 서버 시각 뒤에 유효한 시간 기준이 없으면 null을 반환한다", () => {
    expect(
      resolveLastSavedAtSource(
        {
          lastSavedAtServer: { _methodName: "serverTimestamp" },
          lastSavedAt: Number.NaN,
        },
        { lastSavedAt: -1 },
        {}
      )
    ).toBeNull();
  });
});

describe("resolveLazyUpdateBaseStats", () => {
  test("서버 스냅샷을 기준으로 하되 최신 로그와 루트 상태는 메모리 값을 우선한다", () => {
    const result = resolveLazyUpdateBaseStats(
      {
        fullness: 2,
        strength: 1,
        activityLogs: [{ type: "OLD" }],
        selectedDigimon: "Agumon",
      },
      {
        strength: 5,
        activityLogs: [{ type: "LIVE" }],
        battleLogs: [{ mode: "quest" }],
        selectedDigimon: "Greymon",
      },
      {
        isLightsOn: false,
        wakeUntil: 4567,
      }
    );

    expect(result).toMatchObject({
      fullness: 2,
      strength: 1,
      isLightsOn: false,
      wakeUntil: 4567,
      activityLogs: [{ type: "LIVE" }],
      battleLogs: [{ mode: "quest" }],
      selectedDigimon: "Greymon",
    });
  });

  test("로드 경로처럼 live stats가 비어 있어도 루트 조명과 기상 상태를 lazy update 입력에 합친다", () => {
    const result = resolveLazyUpdateBaseStats(
      {
        napUntil: 1712559600000,
        poopCountdown: 180,
        activityLogs: [{ type: "NAP_START" }],
      },
      {},
      {
        isLightsOn: false,
        wakeUntil: 1712552400000,
      }
    );

    expect(result).toMatchObject({
      napUntil: 1712559600000,
      poopCountdown: 180,
      isLightsOn: false,
      wakeUntil: 1712552400000,
      activityLogs: [{ type: "NAP_START" }],
    });
  });
});
