import {
  buildDigimonDisplayName,
  resolveLastSavedAtSource,
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

  test("게임 시간 필드는 epoch ms 숫자로 정규화한다", () => {
    const result = sanitizeDigimonStatsForSlotDocument({
      birthTime: {
        seconds: 1712559600,
        nanoseconds: 500000000,
      },
      injuredAt: new Date("2026-04-07T01:23:45.000Z"),
      callStatus: {
        hunger: {
          startedAt: "2026-04-07T03:00:00.000Z",
        },
      },
    });

    expect(result.birthTime).toBe(1712559600500);
    expect(result.injuredAt).toBe(Date.parse("2026-04-07T01:23:45.000Z"));
    expect(result.callStatus.hunger.startedAt).toBe(
      Date.parse("2026-04-07T03:00:00.000Z")
    );
  });
});

describe("resolveLastSavedAtSource", () => {
  test("서버 기준 저장 시각을 최우선으로 사용한다", () => {
    const serverTimestamp = {
      toMillis: () => 3000,
    };

    expect(
      resolveLastSavedAtSource(
        {
          lastSavedAtServer: serverTimestamp,
          lastSavedAt: 2000,
        },
        {
          lastSavedAt: 1500,
        },
        {
          lastSavedAt: 1000,
        }
      )
    ).toBe(serverTimestamp);
  });

  test("서버 시각이 없으면 숫자 lastSavedAt fallback을 사용한다", () => {
    expect(
      resolveLastSavedAtSource(
        {},
        {
          lastSavedAt: 1500,
        },
        {
          lastSavedAt: 1000,
        }
      )
    ).toBe(1500);
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

  test("로드 경로처럼 live stats가 비어 있어도 루트 조명과 기상 상태를 lazy update 입력에 합친다", () => {
    const result = resolveLazyUpdateBaseStats(
      {
        napUntil: 1712559600000,
        poopCountdown: 180,
        activityLogs: [{ type: "NAP_START" }],
      },
      {},
      {
        isLightsOn: false,
        wakeUntil: 1712552400000,
      }
    );

    expect(result).toMatchObject({
      napUntil: 1712559600000,
      poopCountdown: 180,
      isLightsOn: false,
      wakeUntil: 1712552400000,
      activityLogs: [{ type: "NAP_START" }],
    });
  });
});
