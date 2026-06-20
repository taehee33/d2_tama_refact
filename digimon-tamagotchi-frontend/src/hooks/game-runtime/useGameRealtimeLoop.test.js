import { resolveRealtimeTickWindow } from "./useGameRealtimeLoop";

describe("resolveRealtimeTickWindow", () => {
  test("60초 초과 지연은 한 번에 60초만 처리하고 나머지 기준 시각을 보존한다", () => {
    const first = resolveRealtimeTickWindow(1000, 301000);
    const second = resolveRealtimeTickWindow(first.processedThroughMs, 301000);

    expect(first).toEqual({
      availableSeconds: 300,
      appliedSeconds: 60,
      processedThroughMs: 61000,
    });
    expect(second).toEqual({
      availableSeconds: 240,
      appliedSeconds: 60,
      processedThroughMs: 121000,
    });
  });

  test("1초 미만의 나머지는 다음 tick 기준에 남긴다", () => {
    expect(resolveRealtimeTickWindow(1000, 61999)).toEqual({
      availableSeconds: 60,
      appliedSeconds: 60,
      processedThroughMs: 61000,
    });
  });

  test("5분 catch-up 구간은 겹치거나 빠지는 시간 없이 60초씩 이어진다", () => {
    const nowMs = 301000;
    let processedThroughMs = 1000;
    const windows = [];

    while (processedThroughMs < nowMs) {
      const window = resolveRealtimeTickWindow(processedThroughMs, nowMs);
      windows.push([processedThroughMs, window.processedThroughMs]);
      processedThroughMs = window.processedThroughMs;
    }

    expect(windows).toEqual([
      [1000, 61000],
      [61000, 121000],
      [121000, 181000],
      [181000, 241000],
      [241000, 301000],
    ]);
  });
});
