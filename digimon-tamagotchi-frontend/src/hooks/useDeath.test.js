import {
  buildDeathReincarnationState,
  resolveDeathReincarnationDigimonId,
  shouldRecordDeathEncyclopedia,
} from "./useDeath";

describe("useDeath helpers", () => {
  test("resolveDeathReincarnationDigimonId는 완전체 사망 시 완전체 묘지 폼을 선택한다", () => {
    expect(
      resolveDeathReincarnationDigimonId({
        currentStats: { evolutionStage: "완전체" },
        perfectStages: ["완전체"],
        version: "Ver.2",
        slotRuntimeDataMap: {
          Ohakadamon2V2: { name: "오하카다몬2" },
          DigitamaV2: { name: "디지타마V2" },
        },
      })
    ).toBe("Ohakadamon2V2");
  });

  test("resolveDeathReincarnationDigimonId는 사망 폼 데이터가 없으면 스타터로 fallback한다", () => {
    expect(
      resolveDeathReincarnationDigimonId({
        currentStats: { evolutionStage: "성장기" },
        perfectStages: ["완전체"],
        version: "Ver.3",
        slotRuntimeDataMap: {
          DigitamaV3: { name: "디지타마V3" },
        },
      })
    ).toBe("DigitamaV3");
  });

  test("buildDeathReincarnationState는 환생 스탯과 로그를 함께 조립한다", () => {
    const result = buildDeathReincarnationState({
      currentStats: {
        activityLogs: [{ type: "START", text: "시작", timestamp: 1 }],
        totalReincarnations: 1,
        fullness: 2,
        strength: 1,
        weight: 12,
      },
      reincarnationDigimonId: "Ohakadamon1",
      slotRuntimeDataMap: {
        Ohakadamon1: {
          name: "오하카다몬1",
          hungerTimer: 60,
          strengthTimer: 60,
          poopTimer: 120,
        },
      },
    });

    const lastLog = result.reincarnationLogs[result.reincarnationLogs.length - 1];

    expect(result.committedStats.selectedDigimon).toBe("Ohakadamon1");
    expect(lastLog.type).toBe("REINCARNATION");
    expect(lastLog.text).toContain("Ohakadamon1");
    expect(lastLog.digimonId).toBe("Ohakadamon1");
    expect(lastLog.digimonName).toBe("오하카다몬1");
  });

  test("shouldRecordDeathEncyclopedia는 스타터를 제외한 디지몬만 기록한다", () => {
    expect(shouldRecordDeathEncyclopedia("Agumon")).toBe(true);
    expect(shouldRecordDeathEncyclopedia("DigitamaV2")).toBe(false);
    expect(shouldRecordDeathEncyclopedia("")).toBe(false);
  });
});
