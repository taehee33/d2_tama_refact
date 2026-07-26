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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushSavePromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
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

  test("명령 저장 경로에서는 전체 stats 대신 사건 intent만 전달한다", async () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const onChangeStats = jest.fn();
    const onSaveCommand = jest.fn().mockResolvedValue({ status: "synced" });
    const props = createProps({ onChangeStats, onSaveCommand });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNumericChange("poopCount", 8));
    expect(onChangeStats).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("saving");
    await flushSavePromises();
    expect(onSaveCommand).toHaveBeenCalledWith({
      schemaVersion: 1,
      type: "setPoopCount",
      field: "poopCount",
      value: 8,
      occurredAt: now,
    });
    expect(result.current.saveStatus).toBe("synced");
    expect(result.current.saveMessage).toBe("저장됨");
  });

  test.each([
    ["queued", "연결되면 동기화"],
    ["blocked", "슬롯 변경으로 저장하지 않음"],
    ["conflict", "다른 기기의 변경사항 확인 필요"],
  ])("%s 영수증을 사용자 상태로 반영한다", async (status, message) => {
    const onSaveCommand = jest.fn().mockResolvedValue({ status });
    const props = createProps({ onSaveCommand });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNumericChange("fullness", 3));
    await flushSavePromises();

    expect(result.current.saveStatus).toBe(status);
    expect(result.current.saveMessage).toBe(message);
    expect(result.current.canRetrySave).toBe(false);
  });

  test("실패한 intent를 같은 사건 시각으로 재시도한다", async () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const onSaveCommand = jest.fn()
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "synced" });
    const props = createProps({ onSaveCommand });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleBooleanChange("isInjured", true));
    await flushSavePromises();
    expect(result.current.saveStatus).toBe("failed");
    expect(result.current.canRetrySave).toBe(true);

    act(() => result.current.handleRetrySave());
    await flushSavePromises();
    expect(onSaveCommand).toHaveBeenNthCalledWith(2, onSaveCommand.mock.calls[0][0]);
    expect(result.current.saveStatus).toBe("synced");
  });

  test("동기 예외도 저장 실패로 수렴시킨다", async () => {
    const onSaveCommand = jest.fn(() => {
      throw new Error("즉시 실패");
    });
    const props = createProps({ onSaveCommand });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNumericChange("fullness", 2));
    await flushSavePromises();

    expect(result.current.saveStatus).toBe("failed");
    expect(result.current.canRetrySave).toBe(true);
  });

  test("늦게 끝난 이전 저장이 최신 저장 상태를 덮어쓰지 않는다", async () => {
    const first = createDeferred();
    const second = createDeferred();
    const onSaveCommand = jest.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const props = createProps({ onSaveCommand });
    const { result } = renderHook(() => useStatsPopupController(props));

    act(() => result.current.handleNumericChange("fullness", 2));
    act(() => result.current.handleNumericChange("strength", 3));
    await act(async () => second.resolve({ status: "queued" }));
    expect(result.current.saveStatus).toBe("queued");

    await act(async () => first.resolve({ status: "failed" }));
    expect(result.current.saveStatus).toBe("queued");
    expect(result.current.canRetrySave).toBe(false);
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
