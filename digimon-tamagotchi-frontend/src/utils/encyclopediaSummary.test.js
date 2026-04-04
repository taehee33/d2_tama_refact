import {
  buildEncyclopediaSummary,
  buildEncyclopediaVersionSummary,
} from "./encyclopediaSummary";

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
    });

    expect(summary.versions).toHaveLength(2);
    expect(summary.totalRequiredCount).toBe(
      summary.versions[0].totalCount + summary.versions[1].totalCount
    );
    expect(summary.totalDiscoveredCount).toBe(3);
  });
});

