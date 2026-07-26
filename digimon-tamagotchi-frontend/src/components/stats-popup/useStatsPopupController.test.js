import { act, renderHook } from "@testing-library/react";
import useStatsPopupController from "./useStatsPopupController";

const now = Date.parse("2026-07-26T12:00:00.000Z");

function createProps(overrides = {}) {
  return {
    stats: {
      fullness: 1,
      strength: 1,
      activityLogs: [],
      maxEnergy: 4,
      hungerTimer: 60,
      strengthTimer: 60,
      poopTimer: 60,
      ...overrides.stats,
    },
    activityLogs: [],
    digimonData: {},
    digimonDataMap: {},
    selectedDigimonId: "Agumon",
    slotVersion: "Ver.1",
    devMode: true,
    onChangeStats: jest.fn(),
    sleepSchedule: null,
    sleepStatus: "AWAKE",
    isLightsOn: false,
    appendLogToSubcollection: undefined,
    ...overrides,
  };
}

describe("useStatsPopupController", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("화면 갱신 interval 하나를 등록하고 unmount에서 정리한다", () => {
    const token = 1234;
    const setIntervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(token);
    const clearIntervalSpy = jest.spyOn(global, "clearInterval").mockImplementation(() => {});
    const props = createProps();
    const { unmount } = renderHook(() => useStatsPopupController(props));

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    act(() => setIntervalSpy.mock.calls[0][0]());
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(token);
  });

  test("OLD 편집 중 외부 stats를 보류하고 NEW 왕복 뒤 동기화한다", () => {
    let props = createProps({ stats: { fullness: 1 } });
    const { result, rerender } = renderHook(() => useStatsPopupController(props));
    act(() => result.current.setActiveTab("OLD"));
    expect(result.current.currentStats.fullness).toBe(1);

    props = createProps({ stats: { fullness: 4 } });
    rerender();
    expect(result.current.currentStats.fullness).toBe(1);

    act(() => result.current.setActiveTab("NEW"));
    act(() => result.current.setActiveTab("OLD"));
    expect(result.current.currentStats.fullness).toBe(4);
  });

  test("숫자와 불리언 intent를 mutation한 뒤 callback에 전달한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const onChangeStats = jest.fn();
    const props = createProps({ onChangeStats });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNumericChange("poopCount", 8));
    expect(onChangeStats).toHaveBeenLastCalledWith(expect.objectContaining({
      poopCount: 8,
      poopReachedMaxAt: now,
      lastPoopPenaltyAt: now,
    }));

    act(() => result.current.handleBooleanChange("isInjured", true));
    expect(onChangeStats).toHaveBeenLastCalledWith(expect.objectContaining({
      isInjured: true,
      injuredAt: now,
    }));
  });

  test("야행성 로그 append 시작 후 stats callback을 호출한다", () => {
    const order = [];
    const appendLogToSubcollection = jest.fn(() => {
      order.push("append");
      return Promise.resolve();
    });
    const onChangeStats = jest.fn(() => order.push("stats"));
    const props = createProps({
      onChangeStats,
      appendLogToSubcollection,
    });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNocturnalToggle());
    expect(order).toEqual(["append", "stats"]);
    expect(onChangeStats).toHaveBeenCalledWith(expect.objectContaining({ isNocturnal: true }));
  });

  test("외부 활동 로그가 저장 stats 로그보다 최신일 때 표시 입력으로 사용한다", () => {
    const activityLogs = [{ text: "즉시 로그" }];
    const props = createProps({ activityLogs });
    const { result } = renderHook(() => useStatsPopupController(props));
    expect(result.current.displayActivityLogs).toBe(activityLogs);
  });
});
