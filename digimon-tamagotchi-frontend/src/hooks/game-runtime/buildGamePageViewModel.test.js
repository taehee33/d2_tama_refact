import { buildGamePageViewModel } from "./buildGamePageViewModel";

describe("buildGamePageViewModel", () => {
  test("헤더 표시명, 수면 스케줄, 조그레스 라벨과 화면 파생 props를 현재 계약에 맞게 만든다", () => {
    const viewModel = buildGamePageViewModel({
      selectedDigimon: "Agumon",
      digimonNickname: "태희",
      evolutionDataForSlot: {
        Agumon: {
          name: "아구몬",
          evolutions: [{ target: "Greymon" }, { target: "GeoGreymon", jogress: true }],
        },
      },
      digimonStats: {
        isDead: false,
        isFrozen: false,
        poopCount: 2,
        sleepLightOnStart: 1234,
      },
      activityLogs: [{ type: "CALL", text: "배고픔 호출이 시작되었습니다.", timestamp: 12345 }],
      digimonDataForSlot: {
        Agumon: {
          sleepSchedule: { start: 21, end: 7, startMinute: 0, endMinute: 0 },
        },
      },
      customTime: new Date("2026-04-07T12:34:56.000Z"),
      slotJogressStatus: {
        isWaiting: true,
      },
      currentAnimation: "foodRejectRefuse",
      feedType: "meat",
      isEvoEnabled: true,
      isEvolving: false,
      width: 320,
      height: 240,
      backgroundNumber: 162,
      modals: {
        food: true,
        poopCleanAnimation: false,
        healAnimation: false,
        call: false,
      },
      feedStep: 1,
      foodSizeScale: 0.4,
      cleanStep: 0,
      sleepStatus: "SLEEPING",
      isLightsOn: false,
      evolutionStage: "Child",
      developerMode: false,
      wakeUntil: null,
      deathReason: null,
    });

    expect(viewModel.headerDigimonLabel).toBe("태희(아구몬)");
    expect(viewModel.sleepSchedule).toEqual({
      start: 21,
      end: 7,
      startMinute: 0,
      endMinute: 0,
    });
    expect(viewModel.statusBadgeProps.sleepSchedule).toEqual(viewModel.sleepSchedule);
    expect(viewModel.gameScreenDisplayProps.selectedDigimon).toBe("Agumon");
    expect(viewModel.gameScreenDisplayProps.isRefused).toBe(true);
    expect(viewModel.gameScreenDisplayProps.digimonStats.activityLogs).toEqual([
      { type: "CALL", text: "배고픔 호출이 시작되었습니다.", timestamp: 12345 },
    ]);
    expect(viewModel.jogressControls).toMatchObject({
      canJogressEvolve: true,
      hasNormalEvolution: true,
      showEvolutionButton: true,
      jogressLabel: "(대기중)",
    });
  });
});
