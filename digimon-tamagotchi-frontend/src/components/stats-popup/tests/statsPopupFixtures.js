export const STATS_POPUP_NOW_MS = Date.parse("2026-07-26T12:00:00.000Z");

export function createStats(overrides = {}) {
  return {
    fullness: 1,
    maxOverfeed: 3,
    timeToEvolveSeconds: 3600,
    lifespanSeconds: 0,
    age: 0,
    sprite: 100,
    evolutionStage: "Child",
    weight: 3,
    careMistakes: 0,
    strength: 1,
    effort: 0,
    winRate: 0,
    energy: 0,
    poopCount: 0,
    isInjured: false,
    injuredAt: null,
    injuries: 0,
    healedDosesCurrent: 0,
    hungerTimer: 60,
    hungerCountdown: 3600,
    strengthTimer: 60,
    strengthCountdown: 3600,
    poopTimer: 60,
    poopCountdown: 300,
    maxEnergy: 4,
    maxStamina: 4,
    minWeight: 0,
    healing: 1,
    attribute: "Vaccine",
    power: 10,
    activityLogs: [],
    ...overrides,
  };
}

export function createStatsPopupProps(overrides = {}) {
  const { stats: statsOverrides, ...propOverrides } = overrides;

  return {
    stats: createStats(statsOverrides),
    activityLogs: [],
    digimonData: { healDoses: 1 },
    digimonDataMap: {},
    selectedDigimonId: "Agumon",
    slotVersion: "Ver.1",
    onClose: jest.fn(),
    devMode: true,
    onChangeStats: jest.fn(),
    sleepStatus: "AWAKE",
    isLightsOn: false,
    ...propOverrides,
  };
}
