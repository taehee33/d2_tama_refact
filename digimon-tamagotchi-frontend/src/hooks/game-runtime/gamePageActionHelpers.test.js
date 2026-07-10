import {
  buildResetDigimonState,
  resolveDigimonDataFromMap,
  shouldEnableEvolutionButton,
} from "./gamePageActionHelpers";

jest.mock("../../logic/evolution/checker", () => ({
  checkEvolution: jest.fn(),
}));

const { checkEvolution } = jest.requireMock("../../logic/evolution/checker");

describe("gamePageActionHelpers", () => {
  beforeEach(() => {
    checkEvolution.mockReset();
  });

  test("buildResetDigimonState는 환생 카운트와 사망 관련 상태를 초기화한다", () => {
    const nowMs = Date.parse("2026-04-10T12:00:00.000Z");
    const { initialDigimonId, nextStats } = buildResetDigimonState({
      currentStats: {
        evolutionStage: "Ultimate",
        totalReincarnations: 2,
        normalReincarnations: 1,
        perfectReincarnations: 4,
        totalBattles: 12,
        totalBattlesWon: 8,
        totalBattlesLost: 4,
        totalWinRate: 67,
        isDead: true,
        age: 99,
        poopCount: 5,
        isInjured: true,
        injuries: 7,
      },
      normalizedSlotVersion: "Ver.2",
      digimonDataForSlot: {
        DigitamaV2: { stage: "Egg", stats: {} },
      },
      now: () => nowMs,
    });

    expect(initialDigimonId).toBe("DigitamaV2");
    expect(nextStats.totalReincarnations).toBe(3);
    expect(nextStats.perfectReincarnations).toBe(5);
    expect(nextStats.normalReincarnations).toBe(1);
    expect(nextStats.isDead).toBe(false);
    expect(nextStats.age).toBe(0);
    expect(nextStats.birthTime).toBe(nowMs);
    expect(nextStats.fullness).toBe(0);
    expect(nextStats.strength).toBe(0);
    expect(nextStats.poopCount).toBe(0);
    expect(nextStats.isInjured).toBe(false);
    expect(nextStats.injuries).toBe(0);
    expect(nextStats.totalBattles).toBe(0);
    expect(nextStats.totalBattlesWon).toBe(0);
    expect(nextStats.totalBattlesLost).toBe(0);
    expect(nextStats.totalWinRate).toBe(0);
    expect(nextStats.lastSavedAt).toBeInstanceOf(Date);
  });

  test("shouldEnableEvolutionButton은 로딩 중이면 false를 반환한다", () => {
    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: true,
        digimonStats: {},
        developerMode: false,
        ignoreEvolutionTime: false,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {},
      })
    ).toBe(false);
  });

  test("shouldEnableEvolutionButton은 개발자 모드와 조건 무시가 같이 켜지면 true를 반환한다", () => {
    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: false,
        digimonStats: { isDead: false },
        developerMode: true,
        ignoreEvolutionTime: true,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {
          Agumon: {
            evolutions: [{ target: "Greymon" }],
          },
        },
      })
    ).toBe(true);
  });

  test("shouldEnableEvolutionButton은 개발자 모드 OFF면 남은 조건 무시 값을 적용하지 않는다", () => {
    const checkEvolutionFn = jest.fn().mockReturnValue({ success: false });

    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: false,
        digimonStats: { isDead: false },
        developerMode: false,
        ignoreEvolutionTime: true,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {
          Agumon: {
            evolutions: [{ target: "Greymon" }, { target: "GeoGreymon", jogress: true }],
          },
        },
        checkEvolutionFn,
      })
    ).toBe(false);

    expect(checkEvolutionFn).toHaveBeenCalled();
  });

  test("shouldEnableEvolutionButton은 개발자 모드에서 진화 시간만 0으로 판정한다", () => {
    const checkEvolutionFn = jest.fn().mockReturnValue({ success: true });

    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: false,
        digimonStats: { isDead: false, timeToEvolveSeconds: 3600, trainings: 3 },
        developerMode: true,
        ignoreEvolutionTime: false,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {
          Agumon: { evolutions: [{ target: "Greymon" }] },
        },
        checkEvolutionFn,
      })
    ).toBe(true);

    expect(checkEvolutionFn).toHaveBeenCalledWith(
      { isDead: false, timeToEvolveSeconds: 0, trainings: 3 },
      expect.any(Object),
      "Agumon",
      expect.any(Object)
    );
  });

  test("shouldEnableEvolutionButton은 저장된 디지몬 ID의 앞뒤 공백을 무시한다", () => {
    checkEvolution.mockReturnValue({ success: true });

    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: false,
        digimonStats: { isDead: false },
        developerMode: false,
        ignoreEvolutionTime: false,
        selectedDigimon: " Digitama ",
        evolutionDataForSlot: {
          Digitama: {
            id: "Digitama",
            evolutions: [{ targetId: "Botamon" }],
          },
        },
      })
    ).toBe(true);

    expect(checkEvolution).toHaveBeenCalledWith(
      { isDead: false },
      {
        id: "Digitama",
        evolutions: [{ targetId: "Botamon" }],
      },
      "Digitama",
      {
        Digitama: {
          id: "Digitama",
          evolutions: [{ targetId: "Botamon" }],
        },
      }
    );
  });

  test("resolveDigimonDataFromMap은 key가 달라도 entry.id로 디지몬 데이터를 찾는다", () => {
    expect(
      resolveDigimonDataFromMap(
        {
          egg: {
            id: "Digitama",
            name: "디지타마",
          },
        },
        "Digitama"
      )
    ).toEqual({
      key: "egg",
      data: {
        id: "Digitama",
        name: "디지타마",
      },
    });
  });

  test("shouldEnableEvolutionButton은 checkEvolution 성공 결과를 따른다", () => {
    checkEvolution.mockReturnValue({ success: true });

    expect(
      shouldEnableEvolutionButton({
        isLoadingSlot: false,
        digimonStats: { isDead: false },
        developerMode: false,
        ignoreEvolutionTime: false,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {
          Agumon: {
            evolutions: [{ target: "Greymon" }],
          },
        },
      })
    ).toBe(true);
  });
});
