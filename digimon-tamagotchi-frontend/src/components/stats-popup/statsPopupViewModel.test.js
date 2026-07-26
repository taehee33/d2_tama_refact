import {
  buildCareViewModel,
  buildHealthRiskViewModel,
  buildOverviewViewModel,
  buildSleepViewModel,
  formatStatsPopupDuration,
  formatStatsPopupValueWithOverflow,
  getStatsPopupElapsedTimeExcludingFridge,
} from "./statsPopupViewModel";

const NOW_MS = Date.parse("2026-07-26T12:00:00.000Z");

describe("statsPopupViewModel", () => {
  test("overview 기본 표시와 내부 타이머 표시를 계산한다", () => {
    const viewModel = buildOverviewViewModel({
      stats: {
        evolutionStage: "Digitama",
        hungerTimer: 0,
        strengthTimer: 60,
        poopTimer: 999,
        poopCountdown: 58477,
        maxEnergy: 4,
        power: 10,
      },
      digimonData: { stats: { basePower: 20, healDoses: 2 } },
      currentTimeMs: NOW_MS,
      getTimeUntilWakeFn: jest.fn(() => "정보 없음"),
    });

    expect(viewModel.speciesPower).toBe(20);
    expect(viewModel.speciesHealDoses).toBe(2);
    expect(viewModel.hungerTimerDisplay.label).toBe("비활성");
    expect(viewModel.poopTimerDisplay.label).toBe("알 단계 전용");
    expect(viewModel.wakeEnergyRecoveryText).toBe("정보 없음");
  });

  test("duration과 overflow 표시 형식을 유지한다", () => {
    expect(formatStatsPopupDuration(90061)).toBe("1 day 1 hour 1 min 1 sec");
    expect(formatStatsPopupValueWithOverflow(7)).toBe("5(+2)");
    expect(formatStatsPopupValueWithOverflow(3)).toBe("3");
  });

  test("StatsPopup의 기존 냉장고 제외 경과 시간 계산을 유지한다", () => {
    expect(getStatsPopupElapsedTimeExcludingFridge(
      1000,
      10000,
      4000,
      7000,
      1000
    )).toBe(5000);
    expect(getStatsPopupElapsedTimeExcludingFridge(
      1000,
      10000,
      null,
      null,
      1000
    )).toBe(8000);
  });

  test("sleep 상태와 조명 케어미스 처리 여부를 계산한다", () => {
    expect(buildSleepViewModel({
      stats: { callStatus: { sleep: { isLogged: true } } },
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
    })).toEqual({
      visibleSleepStatus: "SLEEPING_LIGHT_ON",
      sleepStatusLabel: "수면 중(불 켜짐 경고!)",
      isSleepLightCareMistakeProcessed: true,
      isSleepingLikeStatus: true,
    });
  });

  test("care 이력과 현재 카운터 불일치 진단을 계산한다", () => {
    const viewModel = buildCareViewModel({
      stats: {
        careMistakes: 2,
        careMistakeLedger: [{
          id: "tease:1",
          occurredAt: NOW_MS,
          reasonKey: "tease",
          text: "케어미스",
          source: "interaction",
          resolvedAt: null,
        }],
      },
      activityLogs: [],
      sleepStatus: "AWAKE",
      isLightsOn: false,
      currentTimeMs: NOW_MS,
      buildCallStatusFn: jest.fn(() => ({ activeCalls: [] })),
      getDisplayCareMistakesFn: jest.fn(() => ({ entries: [{}, {}] })),
      getActiveCareMistakesFn: jest.fn(() => [{}]),
    });

    expect(viewModel.careMistakeHistoryEntries).toHaveLength(2);
    expect(viewModel.careMistakeDiagnosticMessage).toMatch(/완전히 일치하지 않습니다/);
    expect(viewModel.activeCallMap).toBeInstanceOf(Map);
  });

  test("health risk 부상 이력과 카운터 불일치 진단을 계산한다", () => {
    const viewModel = buildHealthRiskViewModel({
      stats: { injuries: 1, birthTime: NOW_MS - 1000 },
      activityLogs: [],
      selectedDigimonId: "Agumon",
      slotVersion: "Ver.1",
      digimonDataMap: {},
      getDisplayInjuriesFn: jest.fn(() => []),
    });

    expect(viewModel.injuryHistoryEntries).toEqual([]);
    expect(viewModel.injuryDiagnosticMessage).toMatch(/완전히 일치하지 않습니다/);
  });
});
