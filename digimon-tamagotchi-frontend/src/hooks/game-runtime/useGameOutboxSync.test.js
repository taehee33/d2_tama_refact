import { act, renderHook } from "@testing-library/react";
import { useGameOutboxSync } from "./useGameOutboxSync";

describe("useGameOutboxSync", () => {
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

  test("슬롯 로딩 완료, 온라인 복귀, 화면 재활성화에 재전송한다", async () => {
    const flushOutbox = jest.fn().mockResolvedValue(true);
    renderHook(() => useGameOutboxSync({
      enabled: true,
      flushOutbox,
      retryDelays: [10],
      periodicFlushMs: 1_000,
    }));

    await act(async () => Promise.resolve());
    expect(flushOutbox).toHaveBeenCalledWith("슬롯 로딩 완료");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });
    expect(flushOutbox).toHaveBeenCalledWith("온라인 복귀");

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(flushOutbox).toHaveBeenCalledWith("화면 재활성화");
  });

  test("실패하면 정해진 지연 뒤 재시도한다", async () => {
    const flushOutbox = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderHook(() => useGameOutboxSync({
      enabled: true,
      flushOutbox,
      retryDelays: [5_000],
      periodicFlushMs: 60_000,
    }));

    await act(async () => Promise.resolve());
    expect(flushOutbox).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(flushOutbox).toHaveBeenLastCalledWith("재시도");
  });

  test("슬롯을 로딩 중이면 재전송을 시작하지 않는다", () => {
    const flushOutbox = jest.fn();
    renderHook(() => useGameOutboxSync({
      enabled: true,
      isLoadingSlot: true,
      flushOutbox,
    }));

    expect(flushOutbox).not.toHaveBeenCalled();
  });
});
