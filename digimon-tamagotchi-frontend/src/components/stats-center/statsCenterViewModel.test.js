import {
  buildStatsCenterViewModel,
  getDiagnosticsAccessState,
} from "./statsCenterViewModel";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

describe("buildStatsCenterViewModel", () => {
  test("V2 incident를 이력 정본으로 사용하고 연결 활동 로그가 중복 항목을 만들지 않는다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        evolutionStageInstanceId: "stage-current",
        careMistakeHistoryIncidents: [{
          careSchemaVersion: 2,
          incidentId: "incident-1",
          evolutionStageInstanceId: "stage-current",
          occurredRevision: 4,
          operationIndex: 0,
          occurredAt: 1000,
          reasonKey: "hunger_call",
          text: "incident 사유",
          status: "unresolved",
          resolvedAt: null,
        }],
      },
      activityLogs: [{
        incidentId: "incident-1",
        type: "CAREMISTAKE",
        text: "활동 로그 사유",
        timestamp: 2000,
      }],
    });

    expect(result.careMistakeHistory).toMatchObject({
      totalCount: 1,
      isLegacyFallback: false,
      isIncomplete: false,
    });
    expect(result.careMistakeHistory.items).toEqual([expect.objectContaining({
      incidentId: "incident-1",
      occurredAt: 1000,
      reason: "활동 로그 사유",
      status: "active",
    })]);
  });

  test("V2 상태는 incident만으로 활성·해소·확인 불가를 표시한다", () => {
    const incident = (incidentId, operationIndex, status, resolvedAt) => ({
      careSchemaVersion: 2,
      incidentId,
      evolutionStageInstanceId: "stage-current",
      occurredRevision: 8,
      operationIndex,
      occurredAt: 1000,
      text: incidentId,
      status,
      resolvedAt,
    });
    const result = buildStatsCenterViewModel({
      stats: {
        evolutionStageInstanceId: "stage-current",
        careMistakeHistoryIncidents: [
          incident("active", 0, "unresolved", null),
          incident("resolved", 1, "resolved", 3000),
          incident("unknown", 2, "damaged", null),
        ],
      },
    });

    expect(result.careMistakeHistory.items.map((entry) => entry.status)).toEqual([
      "unknown", "resolved", "active",
    ]);
  });

  test("incidentId가 연결되지 않으면 기존 eventId, 그다음 시각·사유로 활동 로그를 보완한다", () => {
    const incident = (incidentId, operationIndex, eventId, occurredAt) => ({
      careSchemaVersion: 2,
      incidentId,
      eventId,
      evolutionStageInstanceId: "stage-current",
      occurredRevision: 8,
      operationIndex,
      occurredAt,
      reasonKey: "hunger_call",
      text: "incident 기본 문구",
      status: "unresolved",
      resolvedAt: null,
    });
    const result = buildStatsCenterViewModel({
      stats: {
        evolutionStageInstanceId: "stage-current",
        careMistakeHistoryIncidents: [
          incident("event-linked", 0, "event-1", 1000),
          incident("legacy-linked", 1, null, 2000),
        ],
      },
      activityLogs: [
        { eventId: "event-1", type: "CAREMISTAKE", text: "eventId 보완", timestamp: 3000 },
        { type: "CAREMISTAKE", text: "케어미스(사유: 배고픔 콜 무시)", timestamp: 2000 },
      ],
    });

    expect(result.careMistakeHistory.items.map((entry) => entry.reason)).toEqual([
      "케어미스(사유: 배고픔 콜 무시)",
      "eventId 보완",
    ]);
  });

  test("V2는 revision·operation·incident 순서를 유지하고 이전 진화 구간은 제외한다", () => {
    const incident = (incidentId, occurredRevision, operationIndex, stageId = "stage-current") => ({
      careSchemaVersion: 2,
      incidentId,
      evolutionStageInstanceId: stageId,
      occurredRevision,
      operationIndex,
      occurredAt: 1000,
      text: incidentId,
      status: "unresolved",
      resolvedAt: null,
    });
    const result = buildStatsCenterViewModel({
      stats: {
        evolutionStageInstanceId: "stage-current",
        careMistakeHistoryIncidents: [
          incident("b", 7, 0),
          incident("a", 7, 0),
          incident("later-operation", 7, 1),
          incident("later-revision", 8, 0),
          incident("old-stage", 99, 0, "stage-old"),
        ],
      },
    });

    expect(result.careMistakeHistory.items.map((entry) => entry.incidentId)).toEqual([
      "later-revision", "later-operation", "b", "a",
    ]);
  });

  test("V2 이력은 최신 10건만 표시해도 케어미스 숫자를 바꾸지 않는다", () => {
    const incidents = Array.from({ length: 11 }, (_, index) => ({
      careSchemaVersion: 2,
      incidentId: `incident-${index}`,
      evolutionStageInstanceId: "stage-current",
      occurredRevision: index,
      operationIndex: 0,
      occurredAt: 1000,
      text: `기록 ${index}`,
      status: "unresolved",
      resolvedAt: null,
    }));
    const result = buildStatsCenterViewModel({
      stats: {
        careMistakes: 71,
        evolutionStageInstanceId: "stage-current",
        careMistakeHistoryIncidents: incidents,
      },
    });

    expect(result.statusItems.find((item) => item.key === "careMistakes").value).toBe("71회");
    expect(result.careMistakeHistory).toMatchObject({
      totalCount: 11,
      displayedCount: 10,
      isTruncated: true,
    });
    expect(result.careMistakeHistory.items[0].incidentId).toBe("incident-10");
  });

  test("불완전한 레거시 ledger는 현재 구간 활동 로그만 fallback하고 상태를 추측하지 않는다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        evolutionStageStartedAt: 2000,
        careMistakeLedger: [{ id: "legacy-without-v2-fields", occurredAt: 3000 }],
      },
      activityLogs: [
        { type: "CAREMISTAKE", text: "현재 구간", timestamp: 3000 },
        { type: "CAREMISTAKE", text: "현재 구간", timestamp: 3000 },
        { type: "CAREMISTAKE", text: "이전 구간", timestamp: 1000 },
      ],
    });

    expect(result.careMistakeHistory).toMatchObject({
      totalCount: 1,
      isLegacyFallback: true,
      isIncomplete: true,
    });
    expect(result.careMistakeHistory.items[0]).toMatchObject({
      reason: "현재 구간",
      status: "unknown",
    });
  });

  test("표시 fallback만 적용하고 원본 게임 상태를 변경하지 않는다", () => {
    const stats = deepFreeze({
      age: "4",
      weight: 101,
      hunger: 3,
      strength: 7,
      energy: 12,
      winRatio: 75,
      effort: 2,
      careMistakes: 1,
      sleepDisturbances: 3,
      isInjured: true,
      revision: 9,
      careMistakeLedger: deepFreeze([{ id: "care-1", occurredAt: 1 }]),
      callStatus: deepFreeze({
        hunger: { isActive: true },
        strength: { isActive: false },
        sleep: { isActive: false },
      }),
      lastSavedAt: Date.parse("2026-08-10T00:00:00.000Z"),
    });
    const digimonData = deepFreeze({ stats: { energy: 20 } });
    const beforeStats = JSON.stringify(stats);
    const beforeDigimonData = JSON.stringify(digimonData);

    const result = buildStatsCenterViewModel({
      stats,
      digimonData,
      sleepStatus: "SLEEPING",
    });
    const statusByKey = Object.fromEntries(
      result.statusItems.map((item) => [item.key, item.value])
    );

    expect(result.statusItems).toHaveLength(11);
    expect(result.healthRiskItems).toHaveLength(5);
    expect(result.lifespanInfo).toMatchObject({
      label: "누적 수명",
      state: "active",
    });
    expect(statusByKey).toMatchObject({
      age: "4일",
      weight: "101g",
      hunger: "3/5",
      strength: "5(+2)/5",
      energy: "12/20",
      winRate: "75%",
      sleepDisturbances: "3회",
      sleep: "수면 중",
      injury: "치료 필요",
    });
    expect(JSON.stringify(stats)).toBe(beforeStats);
    expect(JSON.stringify(digimonData)).toBe(beforeDigimonData);
  });

  test("수면 방해를 케어 미스 아래에 표시하고 없거나 잘못된 값은 0회로 보정한다", () => {
    const missingResult = buildStatsCenterViewModel({ stats: { careMistakes: 2 } });
    const invalidResult = buildStatsCenterViewModel({
      stats: { careMistakes: 2, sleepDisturbances: "잘못된 값" },
    });
    const labels = missingResult.statusItems.map((item) => item.label);
    const careMistakeIndex = labels.indexOf("케어 미스");

    expect(labels[careMistakeIndex + 1]).toBe("수면 방해");
    expect(missingResult.statusItems[careMistakeIndex + 1].value).toBe("0회");
    expect(
      invalidResult.statusItems.find((item) => item.key === "sleepDisturbances")
    ).toEqual({ key: "sleepDisturbances", label: "수면 방해", value: "0회" });
  });

  test("현재 진화 구간의 수면 방해 상세 기록을 표시 모델로 만든다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        sleepDisturbances: 3,
        evolutionStageStartedAt: 2000,
      },
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "훈련으로 깨움", timestamp: 4000 },
        { type: "SLEEP_DISTURBANCE", text: "먹이로 깨움", timestamp: 3000 },
        { type: "SLEEP_END", text: "자연 기상", timestamp: 2500 },
        { type: "SLEEP_DISTURBANCE", text: "이전 구간", timestamp: 1000 },
      ],
    });

    expect(result.sleepDisturbanceHistory).toMatchObject({
      counter: 3,
      detailCount: 2,
      hasMissingDetails: true,
      isLegacyRange: false,
    });
    expect(result.sleepDisturbanceHistory.entries.map((entry) => entry.text)).toEqual([
      "훈련으로 깨움",
      "먹이로 깨움",
    ]);
    expect(result.sleepDisturbanceHistory.entries[0].timestampLabel).not.toBe("N/A");
  });

  test("단계 시작 시각이 없는 레거시 슬롯은 보유 이력 전체를 범위로 표시한다", () => {
    const result = buildStatsCenterViewModel({
      stats: { sleepDisturbances: 1 },
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "레거시 이력", timestamp: 1000 },
      ],
    });

    expect(result.sleepDisturbanceHistory).toMatchObject({
      counter: 1,
      detailCount: 1,
      hasMissingDetails: false,
      isLegacyRange: true,
    });
  });

  test("내부 메타데이터와 케어 미스 상세 기록은 진단 섹션에만 둔다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        revision: 12,
        lastSavedAt: Date.parse("2026-08-10T00:00:00.000Z"),
        careMistakeLedger: [{ id: "one" }, { id: "two" }],
      },
    });
    const statusLabels = result.statusItems.map((item) => item.label);
    const diagnosticItems = result.diagnosticSections.flatMap((section) => section.items);

    expect(statusLabels).not.toContain("리비전");
    expect(statusLabels).not.toContain("마지막 저장 시각");
    expect(statusLabels).not.toContain("케어 미스 상세 기록");
    expect(diagnosticItems).toEqual(
      expect.arrayContaining([
        { label: "리비전", value: "12" },
        { label: "케어 미스 상세 기록", value: "2건" },
      ])
    );
  });

  test("배틀 범위와 배변 한도를 명확한 라벨로 표시한다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        battles: 3,
        battlesWon: 2,
        battlesLost: 1,
        totalBattles: 8,
        poopCount: 1,
      },
    });
    const diagnosticItems = result.diagnosticSections.flatMap((section) => section.items);

    expect(diagnosticItems).toEqual(
      expect.arrayContaining([
        { label: "현재 형태 배틀", value: "3회" },
        { label: "현재 형태 승리", value: "2회" },
        { label: "현재 형태 패배", value: "1회" },
        { label: "이번 생애 누적 배틀", value: "8회" },
        { label: "배변 횟수", value: "1/8" },
      ])
    );
  });

  test("모든 주기와 타이머를 분·초 형식으로 통일한다", () => {
    const result = buildStatsCenterViewModel({
      stats: {
        hungerTimer: 48,
        hungerCountdown: 277,
        strengthTimer: 48,
        strengthCountdown: 277,
        poopTimer: 120,
        poopCountdown: 3157,
        lifespanSeconds: 127024,
        timeToEvolveSeconds: 46352,
      },
    });
    const timerSection = result.diagnosticSections.find((section) => section.key === "timers");

    expect(timerSection.items).toEqual([
      { label: "배고픔 주기", value: "48분 0초" },
      { label: "배고픔 남은 시간", value: "4분 37초" },
      { label: "힘 주기", value: "48분 0초" },
      { label: "힘 남은 시간", value: "4분 37초" },
      { label: "배변 주기", value: "120분 0초" },
      { label: "배변 남은 시간", value: "52분 37초" },
      { label: "누적 수명", value: "1일 11시간 17분 4초" },
      { label: "진화까지 남은 시간", value: "772분 32초" },
    ]);
  });

  test.each(["SLEEPING_LIGHT_ON", "TIRED", "SLEEPY"])(
    "%s 수면 상태를 기존 불 켜짐 경고 문구로 호환 표시한다",
    (sleepStatus) => {
      const result = buildStatsCenterViewModel({ sleepStatus });
      const sleepItem = result.statusItems.find((item) => item.key === "sleep");

      expect(sleepItem).toEqual({
        key: "sleep",
        label: "수면",
        value: "수면 중(불 켜짐 경고!)",
      });
    }
  );
});

describe("getDiagnosticsAccessState", () => {
  test.each([
    [{ isOperatorStatusLoading: true, canViewDiagnostics: true }, "loading"],
    [{ isOperatorStatusLoading: false, canViewDiagnostics: false }, "denied"],
    [{ isOperatorStatusLoading: false, canViewDiagnostics: true }, "allowed"],
  ])("권한 조합 %o을 %s로 구분한다", (input, expected) => {
    expect(getDiagnosticsAccessState(input)).toBe(expected);
  });
});
