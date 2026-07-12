import { digimonDataVer5, V5_SPRITE_BASE } from "./digimons";

const expectedStats = {
  Zurumon: [3, 0, 4, 0, "Free", null],
  Pagumon: [30, 0, 8, 1, "Free", "20:00"],
  Gazimon: [48, 30, 15, 2, "Virus", "21:00"],
  Gizamon: [38, 25, 15, 2, "Virus", "22:00"],
  DarkTyranomon: [59, 50, 40, 1, "Virus", "22:00"],
  Cyclomon: [59, 45, 40, 2, "Virus", "23:00"],
  Devidramon: [48, 50, 30, 1, "Virus", "23:00"],
  Tuskmon: [48, 45, 40, 2, "Virus", "22:00"],
  Flymon: [38, 50, 20, 1, "Virus", "22:00"],
  Deltamon: [38, 45, 30, 2, "Virus", "21:00"],
  Raremon: [28, 40, 20, 3, "Virus", "22:00"],
  MetalTyranomon: [59, 100, 40, 1, "Virus", "22:00"],
  Nanomon: [59, 85, 5, 1, "Virus", "21:00"],
  ExTyranomon: [48, 100, 40, 1, "Vaccine", "23:00"],
  Mugendramon: [59, 170, 50, 1, "Virus", "23:00"],
  Raidenmon: [59, 150, 50, 1, "Virus", "23:00"],
  Gaioumon: [48, 180, 38, 2, "Virus", "23:00"],
  Millenniumon: [59, 200, 40, 1, "Virus", "23:00"],
  Chaosdramon: [66, 200, 50, 1, "Virus", "23:00"],
};

describe("Digital Monster Color Ver.5 이미지 기준 데이터", () => {
  test("Ver.5 스프라이트 팩을 사용한다", () => {
    expect(V5_SPRITE_BASE).toBe("/Ver5_Mod_codex");
    expect(digimonDataVer5.DigitamaV5.spriteBasePath).toBe(V5_SPRITE_BASE);
  });

  test.each(Object.entries(expectedStats))("%s의 핵심 스탯이 일치한다", (id, expected) => {
    const stats = digimonDataVer5[id].stats;
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
    const expected = {
      DarkTyranomon: "MetalTyranomon",
      Devidramon: "MetalTyranomon",
      Flymon: "MetalTyranomon",
      Cyclomon: "Nanomon",
      Tuskmon: "Nanomon",
      Deltamon: "Nanomon",
      Raremon: "ExTyranomon",
    };
    Object.entries(expected).forEach(([id, targetId]) => {
      expect(digimonDataVer5[id].evolutions[0].targetId).toBe(targetId);
    });
  });

  test("완전체에서 궁극체로 이어지는 조건이 일치한다", () => {
    const expected = {
      MetalTyranomon: "Mugendramon",
      Nanomon: "Raidenmon",
      ExTyranomon: "Gaioumon",
    };
    Object.entries(expected).forEach(([id, targetId]) => {
      const evolution = digimonDataVer5[id].evolutions[0];
      expect(evolution.targetId).toBe(targetId);
      expect(evolution.conditions.careMistakes).toEqual({ max: 1 });
      expect(evolution.conditions.battles).toEqual({ min: 15 });
      expect(evolution.conditions.winRatio).toEqual({ min: 80 });
    });
  });

  test("가즈몬과 기자몬의 대체 진화 조건을 OR 그룹으로 보존한다", () => {
    const gazimonRaremon = digimonDataVer5.Gazimon.evolutions.find(
      ({ targetId }) => targetId === "Raremon"
    );
    const gizamonFlymon = digimonDataVer5.Gizamon.evolutions.find(
      ({ targetId }) => targetId === "Flymon"
    );
    const gizamonRaremon = digimonDataVer5.Gizamon.evolutions.find(
      ({ targetId }) => targetId === "Raremon"
    );
    expect(gazimonRaremon.conditionGroups).toHaveLength(4);
    expect(gizamonFlymon.conditionGroups).toHaveLength(4);
    expect(gizamonRaremon.conditionGroups).toHaveLength(3);
  });
});
