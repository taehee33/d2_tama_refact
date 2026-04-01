import { resolveRootSlotFields } from "./useGameData";

describe("resolveRootSlotFields", () => {
  test("newStats에 최신 조명/기상/수면 경고 값이 있으면 그 값을 우선 사용한다", () => {
    const result = resolveRootSlotFields(
      {
        isLightsOn: false,
        wakeUntil: 123456789,
        dailySleepMistake: false,
      },
      {
        isLightsOn: true,
        wakeUntil: null,
        dailySleepMistake: true,
      }
    );

    expect(result).toEqual({
      isLightsOn: false,
      wakeUntil: 123456789,
      dailySleepMistake: false,
    });
  });

  test("newStats에 루트 필드가 없으면 현재 훅 상태를 fallback으로 사용한다", () => {
    const result = resolveRootSlotFields(
      {},
      {
        isLightsOn: true,
        wakeUntil: 987654321,
        dailySleepMistake: true,
      }
    );

    expect(result).toEqual({
      isLightsOn: true,
      wakeUntil: 987654321,
      dailySleepMistake: true,
    });
  });
});
