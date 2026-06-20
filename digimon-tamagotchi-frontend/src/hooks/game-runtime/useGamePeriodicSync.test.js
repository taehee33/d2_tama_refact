import { act, renderHook } from "@testing-library/react";
import {
  GAME_PERIODIC_SYNC_INTERVAL_MS,
  useGamePeriodicSync,
} from "./useGamePeriodicSync";

describe("useGamePeriodicSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("15분마다 최신 메모리 스탯을 저장한다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ stats }) => useGamePeriodicSync({
        slotId: "1",
        currentUser: { uid: "user-1" },
        digimonStats: stats,
        setDigimonStatsAndSave: save,
      }),
      { initialProps: { stats: { energy: 1 } } }
    );

    rerender({ stats: { energy: 2 } });
    await act(async () => {
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ energy: 2 });
  });

  test("숨겨진 탭에서는 주기 저장을 건너뛴다", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const save = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    await act(async () => {
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });

  test("저장이 진행 중이면 다음 주기 저장을 중복 실행하지 않는다", async () => {
    let resolveSave;
    const save = jest.fn(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));

    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
      intervalMs: 1000,
    }));

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
  });

  test("중요 액션 저장 큐가 사용 중이면 해당 주기 보정을 건너뛴다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    save.isInFlight = jest.fn(() => true);

    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    await act(async () => {
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });

  test("온라인 복귀 시 즉시 한 번 동기화한다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  test("슬롯 로딩 중에는 온라인 복귀와 주기 저장을 등록하지 않는다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      isLoadingSlot: true,
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });
});
