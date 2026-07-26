import {
  applyStatsPopupCommand,
  buildStatsPopupCommandIntent,
  buildStatsPopupCommandPatch,
  buildStatsPopupNocturnalRequestLog,
  reconcileLegacySaveWithCommands,
} from "./statsPopupCommands";

describe("StatsPopup intent command", () => {
  test("단순 필드는 최신 상태의 다른 값을 보존한다", () => {
    const command = buildStatsPopupCommandIntent({
      field: "fullness",
      value: 3,
      occurredAt: 1_000,
    });
    expect(applyStatsPopupCommand({ fullness: 1, strength: 4 }, command)).toEqual({
      fullness: 3,
      strength: 4,
    });
  });

  test("배변 7→8은 사건 시각을 기록하고 8→7은 타이밍을 초기화한다", () => {
    const reached = applyStatsPopupCommand(
      { poopCount: 7 },
      buildStatsPopupCommandIntent({ field: "poopCount", value: 8, occurredAt: 2_000 })
    );
    expect(reached).toMatchObject({
      poopCount: 8,
      poopReachedMaxAt: 2_000,
      lastPoopPenaltyAt: 2_000,
    });
    const reduced = applyStatsPopupCommand(
      reached,
      buildStatsPopupCommandIntent({ field: "poopCount", value: 7, occurredAt: 3_000 })
    );
    expect(reduced).toMatchObject({
      poopCount: 7,
      poopReachedMaxAt: null,
      lastPoopPenaltyAt: null,
    });
  });

  test("이미 8인 배변과 이미 부상인 상태의 시작 시각을 보존한다", () => {
    expect(applyStatsPopupCommand(
      { poopCount: 8, poopReachedMaxAt: 100, lastPoopPenaltyAt: 100 },
      buildStatsPopupCommandIntent({ field: "poopCount", value: 8, occurredAt: 5_000 })
    )).toMatchObject({ poopReachedMaxAt: 100, lastPoopPenaltyAt: 100 });
    expect(applyStatsPopupCommand(
      { isInjured: true, injuredAt: 200 },
      buildStatsPopupCommandIntent({ field: "isInjured", value: true, occurredAt: 5_000 })
    )).toMatchObject({ isInjured: true, injuredAt: 200 });
  });

  test("부상 해제는 시작 시각과 치료 횟수를 초기화한다", () => {
    expect(applyStatsPopupCommand(
      { isInjured: true, injuredAt: 200, healedDosesCurrent: 3 },
      buildStatsPopupCommandIntent({ field: "isInjured", value: false, occurredAt: 5_000 })
    )).toMatchObject({ isInjured: false, injuredAt: null, healedDosesCurrent: 0 });
  });

  test("command patch는 관련 보조 필드만 포함한다", () => {
    const command = buildStatsPopupCommandIntent({ field: "poopCount", value: 8, occurredAt: 2_000 });
    const before = { poopCount: 7, strength: 4 };
    const after = applyStatsPopupCommand(before, command);
    expect(buildStatsPopupCommandPatch(before, after, command)).toEqual({
      poopCount: 8,
      poopReachedMaxAt: 2_000,
      lastPoopPenaltyAt: 2_000,
    });
  });

  test("야행성 로그는 완료가 아닌 변경 요청이며 command/event identity를 공유한다", () => {
    expect(buildStatsPopupNocturnalRequestLog({
      commandId: "stats-popup:1000:1",
      occurredAt: 1_000,
      value: true,
    })).toEqual({
      type: "ACTION",
      text: "야행성 모드 ON 변경 요청: 수면/기상 시간을 3시간 늦춥니다 🌙",
      timestamp: 1_000,
      eventId: "stats-popup:1000:1:activity",
      actionKind: "stats-change-request",
      targetField: "isNocturnal",
      targetValue: true,
      commandId: "stats-popup:1000:1",
    });
  });
});

describe("legacy full-save 혼재", () => {
  const command = buildStatsPopupCommandIntent({ field: "fullness", value: 3, occurredAt: 1_000 });
  const entry = { sequence: 1, command, patch: { fullness: 3 } };

  test("command 뒤의 unrelated full-save는 최신 command와 lazy 상태를 보존한다", () => {
    const result = reconcileLegacySaveWithCommands({
      latestStats: { fullness: 3, strength: 2, lifespanSeconds: 100 },
      invocationStats: { fullness: 1, strength: 1, lifespanSeconds: 90 },
      requestedStats: { fullness: 1, strength: 4, lifespanSeconds: 90 },
      legacySequence: 2,
      commandEntries: [entry],
    });
    expect(result.stats).toMatchObject({ fullness: 3, strength: 4, lifespanSeconds: 100 });
  });

  test("뒤의 full-save가 같은 필드를 의도적으로 바꾸면 최신 legacy intent가 승리한다", () => {
    const result = reconcileLegacySaveWithCommands({
      latestStats: { fullness: 3, strength: 2 },
      invocationStats: { fullness: 1, strength: 2 },
      requestedStats: { fullness: 4, strength: 2 },
      legacySequence: 2,
      commandEntries: [entry],
    });
    expect(result.stats.fullness).toBe(4);
    expect(result.supersededFields).toEqual(["fullness"]);
  });

  test("command보다 먼저 예약된 full-save에는 미래 command를 적용하지 않는다", () => {
    const requestedStats = { fullness: 1, strength: 4 };
    expect(reconcileLegacySaveWithCommands({
      latestStats: { fullness: 1, strength: 1 },
      invocationStats: { fullness: 1, strength: 1 },
      requestedStats,
      legacySequence: 1,
      commandEntries: [{ ...entry, sequence: 2 }],
    }).stats).toBe(requestedStats);
  });
});
