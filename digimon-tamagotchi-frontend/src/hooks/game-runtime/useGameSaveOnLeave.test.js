import { act, renderHook } from "@testing-library/react";
import { useGameSaveOnLeave } from "./useGameSaveOnLeave";

describe("useGameSaveOnLeave", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("pagehide에서 가장 최신 snapshot 저장을 요청한다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ stats }) => useGameSaveOnLeave({
        slotId: 1,
        currentUser: { uid: "user-1" },
        digimonStats: stats,
        setDigimonStatsAndSave: save,
      }),
      { initialProps: { stats: { energy: 1 } } }
    );
    rerender({ stats: { energy: 2 } });

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith({ energy: 2 });
  });

  test("visibilitychange와 pagehide가 연속 발생해도 저장 요청을 중복하지 않는다", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderHook(() => useGameSaveOnLeave({
      slotId: 1,
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });
});
