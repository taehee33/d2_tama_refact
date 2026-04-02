import { clampEggProgress, getEggScrollState } from "./useEggScrollProgress";

describe("useEggScrollProgress helpers", () => {
  test("진행도를 0과 1 사이로 고정한다", () => {
    expect(clampEggProgress(-1)).toBe(0);
    expect(clampEggProgress(0.35)).toBe(0.35);
    expect(clampEggProgress(99)).toBe(1);
    expect(clampEggProgress(Number.NaN)).toBe(0);
  });

  test("0~1 진행도를 4단계 상태로 안정적으로 나눈다", () => {
    expect(getEggScrollState(0)).toBe(0);
    expect(getEggScrollState(0.24)).toBe(0);
    expect(getEggScrollState(0.25)).toBe(1);
    expect(getEggScrollState(0.5)).toBe(2);
    expect(getEggScrollState(0.75)).toBe(3);
    expect(getEggScrollState(1)).toBe(3);
  });
});
