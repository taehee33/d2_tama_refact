import { renderHook, act } from "@testing-library/react";
import {
  buildQuestSelectionState,
  buildSparringSelectionState,
  buildToggledLightsCommitState,
  shouldAdvanceClearedQuest,
  useGameHandlers,
} from "./useGameHandlers";

function createDefaultParams(overrides = {}) {
  return {
    selectedDigimon: "Koromon",
    digimonStats: {
      activityLogs: [],
      callStatus: {
        hunger: { isActive: false, startedAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, isLogged: false },
        sleep: { isActive: true, startedAt: Date.now() - 1000 },
      },
    },
    setDigimonStats: jest.fn(),
    wakeUntil: null,
    setWakeUntil: jest.fn(),
    isLightsOn: true,
    setIsLightsOn: jest.fn(),
    activeMenu: null,
    setActiveMenu: jest.fn(),
    currentQuestArea: null,
    clearedQuestIndex: 0,
    setCurrentQuestArea: jest.fn(),
    setCurrentQuestRound: jest.fn(),
    setCurrentQuestVersion: jest.fn(),
    setBattleType: jest.fn(),
    setSparringEnemySlot: jest.fn(),
    setClearedQuestIndex: jest.fn(),
    setActivityLogs: jest.fn(),
    appendLogToSubcollection: jest.fn().mockResolvedValue(undefined),
    toggleModal: jest.fn(),
    setDigimonStatsAndSave: jest.fn().mockResolvedValue(undefined),
    applyLazyUpdateBeforeAction: jest.fn(),
    handleCleanPoopFromHook: jest.fn(),
    startHealCycle: jest.fn(),
    setHealModalStats: jest.fn(),
    quests: [],
    digimonDataVer1: {
      Koromon: {
        sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      },
    },
    slotId: "1",
    currentUser: { uid: "tester" },
    logout: jest.fn(),
    navigate: jest.fn(),
    setIsSleeping: jest.fn(),
    onSleepDisturbance: jest.fn(),
    ...overrides,
  };
}

describe("useGameHandlers handleToggleLights", () => {
  test("조명 토글 시 최신 isLightsOn 값을 stats에 실어 save 경로 한 번으로 저장한다", async () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useGameHandlers(params));

    await act(async () => {
      await result.current.handleToggleLights();
    });

    expect(params.setIsLightsOn).toHaveBeenCalledWith(false);
    expect(params.setDigimonStatsAndSave).toHaveBeenCalledTimes(1);
    expect(params.setDigimonStatsAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        isLightsOn: false,
      }),
      expect.any(Array)
    );
  });
});

describe("buildToggledLightsCommitState", () => {
  test("조명 토글 로그와 저장용 stats를 함께 반환한다", () => {
    const result = buildToggledLightsCommitState({
      updatedStats: {
        isLightsOn: false,
        activityLogs: [{ type: "OLD", text: "old", timestamp: 1000 }],
      },
      next: false,
    });

    expect(result.logText).toBe("Lights: OFF");
    expect(result.updatedLogs[result.updatedLogs.length - 1]).toMatchObject({
      type: "ACTION",
      text: "Lights: OFF",
    });
    expect(result.statsWithLogs).toMatchObject({
      isLightsOn: false,
      activityLogs: result.updatedLogs,
    });
  });
});

describe("buildQuestSelectionState", () => {
  test("퀘스트 선택 시 초기 전투 상태를 조립한다", () => {
    expect(
      buildQuestSelectionState({
        areaId: "area-2",
        version: "Ver.2",
      })
    ).toEqual({
      currentQuestArea: "area-2",
      currentQuestRound: 0,
      currentQuestVersion: "Ver.2",
      battleType: "quest",
      sparringEnemySlot: null,
    });
  });
});

describe("buildSparringSelectionState", () => {
  test("스파링 선택 시 퀘스트 상태를 비우고 상대 슬롯을 담는다", () => {
    const enemySlot = { slotId: "2", name: "enemy" };

    expect(
      buildSparringSelectionState({
        enemySlot,
      })
    ).toEqual({
      sparringEnemySlot: enemySlot,
      battleType: "sparring",
      currentQuestArea: null,
      currentQuestRound: 0,
    });
  });
});

describe("shouldAdvanceClearedQuest", () => {
  test("현재 깬 영역 인덱스가 clearedQuestIndex와 같으면 다음 영역을 해금한다", () => {
    expect(
      shouldAdvanceClearedQuest({
        quests: [{ areaId: "a1" }, { areaId: "a2" }],
        currentQuestArea: "a2",
        clearedQuestIndex: 1,
      })
    ).toBe(true);
  });

  test("현재 영역 인덱스가 다르면 해금하지 않는다", () => {
    expect(
      shouldAdvanceClearedQuest({
        quests: [{ areaId: "a1" }, { areaId: "a2" }],
        currentQuestArea: "a2",
        clearedQuestIndex: 0,
      })
    ).toBe(false);
  });
});

describe("useGameHandlers handleMenuClick", () => {
  test("조명이 꺼져 있으면 조명 의존 메뉴를 열지 않는다", () => {
    const params = createDefaultParams({ isLightsOn: false });
    const { result } = renderHook(() => useGameHandlers(params));

    act(() => {
      result.current.handleMenuClick("battle");
    });

    expect(params.toggleModal).not.toHaveBeenCalled();
    expect(params.setActiveMenu).not.toHaveBeenCalled();
  });

  test("조명이 꺼져 있어도 상태와 조명 메뉴는 계속 접근 가능하다", () => {
    const params = createDefaultParams({ isLightsOn: false });
    const { result } = renderHook(() => useGameHandlers(params));

    act(() => {
      result.current.handleMenuClick("status");
      result.current.handleMenuClick("electric");
    });

    expect(params.setActiveMenu).toHaveBeenNthCalledWith(1, "status");
    expect(params.toggleModal).toHaveBeenNthCalledWith(1, "stats", true);
    expect(params.setActiveMenu).toHaveBeenNthCalledWith(2, "electric");
    expect(params.toggleModal).toHaveBeenNthCalledWith(2, "lights", true);
  });

  test("하단 호출 버튼은 호출 모달을 연다", () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useGameHandlers(params));

    act(() => {
      result.current.handleMenuClick("callSign");
    });

    expect(params.setActiveMenu).toHaveBeenCalledWith("callSign");
    expect(params.toggleModal).toHaveBeenCalledWith("call", true);
  });

  test("냉장고 상태에서는 먹이와 훈련만 막고 다른 메뉴는 유지한다", () => {
    const params = createDefaultParams({
      digimonStats: {
        isFrozen: true,
        activityLogs: [],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: Date.now() - 1000 },
        },
      },
    });
    const { result } = renderHook(() => useGameHandlers(params));

    act(() => {
      result.current.handleMenuClick("eat");
      result.current.handleMenuClick("train");
      result.current.handleMenuClick("battle");
    });

    expect(params.toggleModal).toHaveBeenCalledTimes(1);
    expect(params.toggleModal).toHaveBeenCalledWith("battleSelection", true);
    expect(params.setActiveMenu).toHaveBeenCalledTimes(1);
    expect(params.setActiveMenu).toHaveBeenCalledWith("battle");
  });

  test("퀘스트 영역 선택은 전투 상태를 초기화하고 battle screen을 연다", () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useGameHandlers(params));

    act(() => {
      result.current.handleSelectArea("area-3", "Ver.2");
    });

    expect(params.setCurrentQuestArea).toHaveBeenCalledWith("area-3");
    expect(params.setCurrentQuestRound).toHaveBeenCalledWith(0);
    expect(params.setCurrentQuestVersion).toHaveBeenCalledWith("Ver.2");
    expect(params.setBattleType).toHaveBeenCalledWith("quest");
    expect(params.setSparringEnemySlot).toHaveBeenCalledWith(null);
    expect(params.toggleModal).toHaveBeenNthCalledWith(1, "questSelection", false);
    expect(params.toggleModal).toHaveBeenNthCalledWith(2, "battleScreen", true);
  });
});
