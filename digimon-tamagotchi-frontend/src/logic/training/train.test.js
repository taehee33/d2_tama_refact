import { doVer1Training } from "./train";

function makePartialResults(pattern) {
  return pattern.map((isHit, index) => ({
    round: index + 1,
    attack: isHit ? "U" : "D",
    defend: isHit ? "D" : "U",
    isHit,
  }));
}

describe("doVer1Training", () => {
  test("현재 앱 규칙대로 성공 시 hits/fails/isSuccess/message/updatedStats를 반환한다", () => {
    const digimonStats = {
      weight: 10,
      energy: 5,
      strength: 2,
      effort: 1,
      trainings: 3,
    };
    const partialResults = makePartialResults([true, true, false, true, false]);

    const result = doVer1Training(digimonStats, partialResults);

    expect(result).toMatchObject({
      hits: 3,
      fails: 2,
      isSuccess: true,
      message: "< 좋은 훈련이었다! >",
      roundResults: partialResults,
    });
    expect(result.updatedStats).toMatchObject({
      weight: 8,
      energy: 4,
      strength: 3,
      effort: 2,
      trainings: 4,
    });
  });

  test("실패 시에도 훈련 횟수는 늘고, 힘은 오르지 않는다", () => {
    const digimonStats = {
      weight: 4,
      energy: 2,
      strength: 1,
      effort: 4,
      trainings: 0,
    };
    const partialResults = makePartialResults([true, false, false, true, false]);

    const result = doVer1Training(digimonStats, partialResults);

    expect(result).toMatchObject({
      hits: 2,
      fails: 3,
      isSuccess: false,
      message: "< X!꽝!X >",
    });
    expect(result.updatedStats).toMatchObject({
      weight: 2,
      energy: 1,
      strength: 1,
      effort: 4,
      trainings: 1,
    });
  });
});
