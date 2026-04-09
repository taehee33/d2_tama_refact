import {
  buildEncyclopediaSummary,
  buildEncyclopediaVersionSummary,
} from "./encyclopediaSummary";
import { getRequiredDigimonIds } from "../logic/encyclopediaMaster";

describe("encyclopediaSummary", () => {
  test("버전별 발견 수와 완성 여부를 계산한다", () => {
    const ver1Summary = buildEncyclopediaVersionSummary("Ver.1", {
      "Ver.1": {
        Botamon: { isDiscovered: true },
        Koromon: { isDiscovered: true },
      },
    });

    expect(ver1Summary.totalCount).toBeGreaterThan(0);
    expect(ver1Summary.discoveredCount).toBe(2);
    expect(ver1Summary.remainingCount).toBe(ver1Summary.totalCount - 2);
    expect(ver1Summary.isComplete).toBe(false);
  });

  test("전체 요약은 버전별 집계를 합산한다", () => {
    const summary = buildEncyclopediaSummary({
      "Ver.1": {
        Botamon: { isDiscovered: true },
      },
      "Ver.2": {
        Punimon: { isDiscovered: true },
        Tsunomon: { isDiscovered: true },
      },
      "Ver.3": {
        Poyomon: { isDiscovered: true },
      },
      "Ver.4": {
        Yuramon: { isDiscovered: true },
      },
      "Ver.5": {
        Zurumon: { isDiscovered: false },
      },
    });

    expect(summary.versions).toHaveLength(5);
    expect(summary.totalRequiredCount).toBe(
      summary.versions.reduce((sum, versionSummary) => sum + versionSummary.totalCount, 0)
    );
    expect(summary.totalDiscoveredCount).toBe(5);
  });

  test("Ver.3 도감 대상에는 Super Ultimate 2종이 포함된다", () => {
    const requiredIds = getRequiredDigimonIds("Ver.3");

    expect(requiredIds).toEqual(
      expect.arrayContaining(["Chaosmon", "Millenniumon"])
    );
  });

  test("Ver.4/Ver.5 도감 대상에도 Super Ultimate가 포함된다", () => {
    expect(getRequiredDigimonIds("Ver.4")).toEqual(
      expect.arrayContaining(["Chaosmon", "Chaosdramon"])
    );
    expect(getRequiredDigimonIds("Ver.5")).toEqual(
      expect.arrayContaining(["Millenniumon", "Chaosdramon"])
    );
  });
});
