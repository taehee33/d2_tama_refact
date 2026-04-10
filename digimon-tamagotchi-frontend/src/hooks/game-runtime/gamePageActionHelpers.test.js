import {
  buildResetDigimonState,
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
        evolutionDataForSlot: {},
      })
    ).toBe(true);
  });

  test("shouldEnableEvolutionButton은 조건 무시 시 일반 진화 후보가 있으면 true를 반환한다", () => {
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
      })
    ).toBe(true);
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
