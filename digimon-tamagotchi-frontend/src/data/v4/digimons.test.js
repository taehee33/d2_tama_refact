import { digimonDataVer4 } from "./digimons";

const expectedStats = {
  Piyomon: [48, 30, 15, 2, "Vaccine", "21:00"],
  Palmon: [38, 25, 15, 2, "Data", "22:00"],
  Monochromon: [59, 50, 40, 1, "Data", "22:00"],
  Kokatorimon: [59, 45, 20, 2, "Data", "23:00"],
  Leomon: [48, 50, 20, 1, "Vaccine", "23:00"],
  Kuwagamon: [48, 45, 40, 2, "Virus", "22:00"],
  Coelamon: [38, 50, 20, 1, "Data", "22:00"],
  Mojyamon: [38, 45, 20, 2, "Vaccine", "21:00"],
  Nanimon: [28, 40, 10, 3, "Virus", "22:00"],
  Ultimatedramon: [59, 100, 50, 1, "Virus", "22:00"],
  Piccolomon: [59, 85, 5, 1, "Data", "21:00"],
  Digitamamon: [48, 100, 10, 1, "Data", "23:00"],
  Darkdramon: [59, 170, 32, 1, "Virus", "23:00"],
  BloomLordmon: [59, 150, 30, 1, "Vaccine", "23:00"],
  Gankoomon: [48, 170, 28, 1, "Data", "23:00"],
  Chaosmon: [48, 200, 32, 1, "Vaccine", "23:00"],
  Chaosdramon: [66, 200, 50, 1, "Virus", "23:00"],
};

describe("Digital Monster Color Ver.4 이미지 기준 데이터", () => {
  test.each(Object.entries(expectedStats))("%s의 핵심 스탯이 일치한다", (id, expected) => {
    const stats = digimonDataVer4[id].stats;
    expect([
      stats.hungerCycle,
      stats.basePower,
      stats.minWeight,
      stats.healDoses,
      stats.type,
      stats.sleepTime,
    ]).toEqual(expected);
    expect(stats.strengthCycle).toBe(stats.hungerCycle);
  });

  test("성숙기에서 완전체로 이어지는 진화 관계가 일치한다", () => {
    const target = (id) => digimonDataVer4[id].evolutions[0].targetId;
    expect(target("Monochromon")).toBe("Ultimatedramon");
    expect(target("Leomon")).toBe("Ultimatedramon");
    expect(target("Coelamon")).toBe("Ultimatedramon");
    expect(target("Kokatorimon")).toBe("Piccolomon");
    expect(target("Kuwagamon")).toBe("Piccolomon");
    expect(target("Mojyamon")).toBe("Piccolomon");
    expect(target("Nanimon")).toBe("Digitamamon");
  });

  test("완전체에서 궁극체로 이어지는 진화 관계와 케어미스 조건이 일치한다", () => {
    const expected = {
      Ultimatedramon: "Darkdramon",
      Piccolomon: "BloomLordmon",
      Digitamamon: "Gankoomon",
    };
    Object.entries(expected).forEach(([id, targetId]) => {
      const evolution = digimonDataVer4[id].evolutions[0];
      expect(evolution.targetId).toBe(targetId);
      expect(evolution.conditions.careMistakes).toEqual({ max: 1 });
    });
  });

  test("피요몬과 팔몬의 복수 진화 조건을 OR 그룹으로 보존한다", () => {
    const piyomonNanimon = digimonDataVer4.Piyomon.evolutions.find(
      ({ targetId }) => targetId === "Nanimon"
    );
    const palmonCoelamon = digimonDataVer4.Palmon.evolutions.find(
      ({ targetId }) => targetId === "Coelamon"
    );
    expect(piyomonNanimon.conditionGroups).toHaveLength(4);
    expect(palmonCoelamon.conditionGroups).toHaveLength(4);
  });
});
