import { act, renderHook } from "@testing-library/react";
import {
  GAME_PERIODIC_SYNC_INTERVAL_MS,
  GAME_PERIODIC_SYNC_RETRY_MS,
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
        nextSyncAt: Date.now() + GAME_PERIODIC_SYNC_INTERVAL_MS,
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

  test("nextSyncAt이 없으면 1초 루프처럼 저장하지 않는다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
      nextSyncAt: null,
    }));

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
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
      nextSyncAt: Date.now() + GAME_PERIODIC_SYNC_INTERVAL_MS,
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
      nextSyncAt: Date.now() + 1_000,
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
      nextSyncAt: Date.now() + GAME_PERIODIC_SYNC_INTERVAL_MS,
    }));

    await act(async () => {
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });

  test("보이는 화면에서 주기 저장이 밀리면 짧은 간격으로 재시도한다", async () => {
    jest.setSystemTime(20_000);
    const save = jest.fn().mockResolvedValue(undefined);
    save.isInFlight = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
      nextSyncAt: 15_000,
    }));

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(GAME_PERIODIC_SYNC_RETRY_MS);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith({ energy: 2 });
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

  test("숨겨진 동안 deadline이 지나면 화면 재활성화 시 동기화한다", async () => {
    jest.setSystemTime(10_000);
    const save = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderHook(() => useGamePeriodicSync({
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
      nextSyncAt: 15_000,
    }));
    jest.setSystemTime(16_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith({ energy: 2 });
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
