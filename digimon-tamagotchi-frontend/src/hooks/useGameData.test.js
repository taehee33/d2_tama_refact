import {
  buildDigimonDisplayName,
  resolveLazyUpdateBaseStats,
  resolveRootSlotFields,
  sanitizeDigimonStatsForSlotDocument,
} from "./useGameData";

describe("resolveRootSlotFields", () => {
  test("newStats에 최신 조명/기상 값이 있으면 그 값을 우선 사용한다", () => {
    const result = resolveRootSlotFields(
      {
        isLightsOn: false,
        wakeUntil: 123456789,
      },
      {
        isLightsOn: true,
        wakeUntil: null,
      }
    );

    expect(result).toEqual({
      isLightsOn: false,
      wakeUntil: 123456789,
    });
  });

  test("newStats에 루트 필드가 없으면 현재 훅 상태를 fallback으로 사용한다", () => {
    const result = resolveRootSlotFields(
      {},
      {
        isLightsOn: true,
        wakeUntil: 987654321,
      }
    );

    expect(result).toEqual({
      isLightsOn: true,
      wakeUntil: 987654321,
    });
  });
});

describe("buildDigimonDisplayName", () => {
  test("별명이 있으면 한글명과 함께 표시명을 만든다", () => {
    const result = buildDigimonDisplayName("Agumon", "태희", {
      Agumon: { name: "아구몬" },
    });

    expect(result).toBe("태희(아구몬)");
  });

  test("별명이 없으면 디지몬 이름만 반환한다", () => {
    const result = buildDigimonDisplayName("Agumon", "", {
      Agumon: { name: "아구몬" },
    });

    expect(result).toBe("아구몬");
  });
});

describe("sanitizeDigimonStatsForSlotDocument", () => {
  test("루트 전용 필드와 로그 컬렉션 필드를 제거한다", () => {
    const result = sanitizeDigimonStatsForSlotDocument({
      fullness: 4,
      isLightsOn: false,
      wakeUntil: 1234,
      dailySleepMistake: true,
      lastSavedAt: new Date("2026-04-07T00:00:00.000Z"),
      activityLogs: [{ type: "CALL" }],
      battleLogs: [{ mode: "quest" }],
      selectedDigimon: "Agumon",
      spriteBasePath: null,
    });

    expect(result).toEqual({
      fullness: 4,
    });
  });
});

describe("resolveLazyUpdateBaseStats", () => {
  test("서버 스냅샷을 기준으로 하되 최신 로그와 루트 상태는 메모리 값을 우선한다", () => {
    const result = resolveLazyUpdateBaseStats(
      {
        fullness: 2,
        strength: 1,
        activityLogs: [{ type: "OLD" }],
        selectedDigimon: "Agumon",
      },
      {
        strength: 5,
        activityLogs: [{ type: "LIVE" }],
        battleLogs: [{ mode: "quest" }],
        selectedDigimon: "Greymon",
      },
      {
        isLightsOn: false,
        wakeUntil: 4567,
      }
    );

    expect(result).toMatchObject({
      fullness: 2,
      strength: 1,
      isLightsOn: false,
      wakeUntil: 4567,
      activityLogs: [{ type: "LIVE" }],
      battleLogs: [{ mode: "quest" }],
      selectedDigimon: "Greymon",
    });
  });
});
