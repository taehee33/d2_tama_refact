import { renderHook } from "@testing-library/react";
import { useGameSaveOnLeave } from "./useGameSaveOnLeave";

describe("useGameSaveOnLeave", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("pagehide에서 신규 snapshot 저장을 시작하지 않는다", () => {
    const save = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useGameSaveOnLeave({
      slotId: 1,
      currentUser: { uid: "user-1" },
      digimonStats: { energy: 2 },
      setDigimonStatsAndSave: save,
    }));

    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("beforeunload"));
    expect(save).not.toHaveBeenCalled();
  });

  test("visibilitychange에서도 신규 snapshot 저장을 시작하지 않는다", () => {
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

    document.dispatchEvent(new Event("visibilitychange"));
    expect(save).not.toHaveBeenCalled();
  });
});
