import {
  buildFallbackSlotHydrationResult,
  buildLazyUpdateRuntimeResult,
  buildLoadedSlotCollectionsState,
  buildLoadedSlotHydrationResult,
  buildLoadedSlotHydrationPlan,
  buildLoadedSlotRuntimeState,
  buildSlotDocumentUpdatePayload,
  buildDigimonDisplayName,
  loadSlotCollectionsState,
  resolveActionLazyUpdateRuntimeContext,
  resolveLastSavedAtSource,
  resolveLazyUpdateBaseStats,
  resolveRootSlotFields,
  sanitizeDigimonStatsForSlotDocument,
} from "./useGameData";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";
import { initializeStats } from "../data/stats";

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
      callStatus: {
        hunger: {
          startedAt: "2026-04-07T03:00:00.000Z",
        },
      },
    });

    expect(result.birthTime).toBe(1712559600500);
    expect(result.injuredAt).toBe(Date.parse("2026-04-07T01:23:45.000Z"));
    expect(result.callStatus.hunger.startedAt).toBe(
      Date.parse("2026-04-07T03:00:00.000Z")
    );
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
});

describe("resolveActionLazyUpdateRuntimeContext", () => {
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
  test("저장된 stats가 없으면 starter hydration 결과를 조립한다", () => {
    const dataMap = {
      Digitama: {
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        stage: "Digitama",
        evolutionStage: "Digitama",
      },
    };
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(123456789);

    const result = buildLoadedSlotHydrationPlan({
      slotData: {
        slotName: "빈 슬롯",
      },
      slotId: 1,
      slotVersionLabel: "Ver.1",
      rootSlotFields: {
        isLightsOn: true,
        wakeUntil: null,
      },
      loadedActivityLogs: [{ type: "CARE", timestamp: 1000 }],
      savedName: "Digitama",
      savedStats: {},
      dataMap,
    });

    expect(result.reconstructedLogsToPersist).toEqual([]);
    expect(result.hydrationResult.slotName).toBe("빈 슬롯");
    expect(result.hydrationResult.selectedDigimon).toBe("Digitama");
    expect(result.hydrationResult.activityLogs).toEqual([
      { type: "CARE", timestamp: 1000 },
    ]);
    expect(result.hydrationResult.digimonStats.birthTime).toBe(123456789);
    expect(result.hydrationResult.digimonStats.lastSavedAt).toBe(123456789);

    nowSpy.mockRestore();
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
