import {
  buildEvolutionStatsForCheck,
  getNormalEvolutionCandidates,
  isIgnoringAllEvolutionConditions,
} from "./developerOptions";

describe("개발자 진화 옵션", () => {
  test("전체 조건 무시는 개발자 모드가 켜진 경우에만 적용한다", () => {
    expect(isIgnoringAllEvolutionConditions(false, true)).toBe(false);
    expect(isIgnoringAllEvolutionConditions(true, false)).toBe(false);
    expect(isIgnoringAllEvolutionConditions(true, true)).toBe(true);
  });

  test("개발자 모드는 진화 시간만 만료된 값으로 바꾼다", () => {
    const stats = { timeToEvolveSeconds: 3600, trainings: 2 };

    expect(buildEvolutionStatsForCheck(stats, false)).toBe(stats);
    expect(buildEvolutionStatsForCheck(stats, true)).toEqual({
      timeToEvolveSeconds: 0,
      trainings: 2,
    });
  });

  test("일반 진화 후보만 표시하고 조그레스 후보는 제외한다", () => {
    expect(
      getNormalEvolutionCandidates(
        {
          evolutions: [
            { targetId: "Greymon" },
            { targetId: "Omegamon", jogress: true },
            { targetName: "MetalGreymon" },
          ],
        },
        {
          Greymon: { name: "그레이몬" },
          MetalGreymon: { name: "메탈그레이몬" },
        }
      )
    ).toEqual([
      { targetId: "Greymon", label: "그레이몬" },
      { targetId: "MetalGreymon", label: "메탈그레이몬" },
    ]);
  });
});
