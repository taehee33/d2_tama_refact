import { buildGameModalBindings } from "./buildGameModalBindings";

describe("buildGameModalBindings", () => {
  test("GameModals에 넘길 handlers/data/ui payload를 기존 핵심 필드와 함께 조립한다", () => {
    const handlersInput = {
      handleFeed: jest.fn(),
      handleToggleLights: jest.fn(),
    };
    const dataInput = {
      quests: ["q1"],
      seasonName: "SEASON 2",
    };
    const uiState = {
      width: 320,
      wakeUntil: "stale",
    };

    const result = buildGameModalBindings({
      handlersInput,
      dataInput,
      uiState,
      statusDetailMessages: ["배고픔 경고"],
      selectedDigimon: "Agumon",
      digimonDataForSlot: {
        Agumon: {
          sleepSchedule: { start: 20, end: 8, startMinute: 0, endMinute: 0 },
        },
      },
      digimonStats: {
        sleepLightOnStart: 777,
      },
      wakeUntil: 999,
      sleepStatus: "SLEEPING_LIGHT_ON",
    });

    expect(result.handlers).toMatchObject(handlersInput);
    expect(result.data).toMatchObject(dataInput);
    expect(result.ui).toMatchObject({
      width: 320,
      statusDetailMessages: ["배고픔 경고"],
      wakeUntil: 999,
      sleepStatus: "SLEEPING_LIGHT_ON",
      sleepLightOnStart: 777,
      sleepSchedule: {
        start: 20,
        end: 8,
        startMinute: 0,
        endMinute: 0,
      },
    });
  });
});
