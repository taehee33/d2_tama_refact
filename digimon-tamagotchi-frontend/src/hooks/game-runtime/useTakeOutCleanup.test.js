import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useTakeOutCleanup } from "./useTakeOutCleanup";

describe("useTakeOutCleanup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("takeOutAt이 있으면 3.5초 뒤 null로 정리한다", () => {
    const takeOutAt = Date.now();
    const { result } = renderHook(() => {
      const [stats, setStats] = React.useState({ takeOutAt });
      useTakeOutCleanup({
        takeOutAt: stats.takeOutAt,
        setDigimonStats: setStats,
      });
      return stats;
    });

    act(() => {
      jest.advanceTimersByTime(3499);
    });
    expect(result.current.takeOutAt).toBe(takeOutAt);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.takeOutAt).toBeNull();
  });
});
