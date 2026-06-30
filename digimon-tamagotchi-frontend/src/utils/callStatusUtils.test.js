import {
  buildCallStatusViewModel,
  mergeAcknowledgedRecentCallIds,
  normalizeCallLogText,
  normalizeSleepStatusForDisplay,
} from "./callStatusUtils";

describe("callStatusUtils", () => {
  const now = new Date("2026-04-07T12:00:00.000Z").getTime();

  test("배고픔 호출 활성 시 남은 시간을 계산한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 3,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt: now - 3 * 60 * 1000,
            isLogged: false,
          },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
        hungerMistakeDeadline: now + 7 * 60 * 1000,
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasActiveCalls).toBe(true);
    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunger",
          title: "배고픔 호출",
          remainingMs: 7 * 60 * 1000,
          statusLabel: expect.stringContaining("7분 0초"),
          riskText: "10분을 넘기면 케어미스가 1 증가합니다.",
        }),
      ])
    );
  });

  test("힘 호출 활성 시 남은 시간을 계산한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 2,
        strength: 0,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: {
            isActive: true,
            startedAt: now - 2 * 60 * 1000,
            isLogged: false,
          },
          sleep: { isActive: false, startedAt: null },
        },
        strengthMistakeDeadline: now + 8 * 60 * 1000,
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "strength",
          title: "힘 호출",
          statusLabel: expect.stringContaining("8분 0초"),
        }),
      ])
    );
  });

  test("수면 호출은 30분 조명 경고로 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: now - 5 * 60 * 1000,
          },
        },
      },
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      currentTime: now,
    });

    const sleepCall = viewModel.activeCalls.find((call) => call.type === "sleep");

    expect(sleepCall).toEqual(
      expect.objectContaining({
        title: "수면 조명 경고",
        riskText: "30분을 넘기면 케어미스가 1 증가합니다.",
        statusLabel: expect.stringContaining("불 켜짐 경고"),
        deadlineText: expect.stringContaining("경고 데드라인"),
      })
    );
    expect(sleepCall.remainingMs).toBe(25 * 60 * 1000);
  });

  test("수면 조명 경고는 저장된 sleepLightOnStart를 기준으로 데드라인을 계산한다", () => {
    const persistedStart = now - 25 * 60 * 1000;

    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        sleepLightOnStart: persistedStart,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: null,
          },
        },
      },
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      currentTime: now,
    });

    const sleepCall = viewModel.activeCalls.find((call) => call.type === "sleep");

    expect(sleepCall).toEqual(
      expect.objectContaining({
        title: "수면 조명 경고",
        remainingMs: 5 * 60 * 1000,
        deadlineText: expect.stringContaining("경고 데드라인"),
        statusLabel: expect.stringContaining("5분 0초"),
      })
    );
  });

  test("수면 조명 경고 시작 시각이 없으면 데드라인을 추정하지 않고 대기 문구를 보여준다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        sleepLightOnStart: null,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: null,
          },
        },
      },
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      currentTime: now,
    });

    const sleepCall = viewModel.activeCalls.find((call) => call.type === "sleep");

    expect(sleepCall).toEqual(
      expect.objectContaining({
        statusLabel: "수면 중(불 켜짐 경고!) - 카운트 시작 대기 중",
        deadlineText: "",
        remainingMs: 0,
        pauseReason: "경고 시작 시각을 확인하는 중입니다.",
      })
    );
  });

  test("수면 상태 정규화는 TIRED와 SLEEPY를 불 켜짐 경고로 본다", () => {
    expect(normalizeSleepStatusForDisplay("TIRED")).toBe("SLEEPING_LIGHT_ON");
    expect(normalizeSleepStatusForDisplay("SLEEPY")).toBe("SLEEPING_LIGHT_ON");
  });

  test("잠든 상태의 배고픔 호출은 sleepStartAt 기준 남은 시간을 고정해 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 3,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt: now - 2 * 60 * 1000,
            sleepStartAt: now - 60 * 1000,
            isLogged: false,
          },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
        hungerMistakeDeadline: now + 8 * 60 * 1000,
      },
      sleepStatus: "NAPPING",
      isLightsOn: false,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunger",
          isPaused: true,
          remainingMs: 9 * 60 * 1000,
          statusLabel: "수면 중 일시정지 - 9분 0초 남음",
          pauseReason: "잠든 동안에는 호출 타이머가 멈춰 있습니다.",
        }),
      ])
    );
  });

  test("냉장고 상태에서는 배고픔 호출을 정지 상태로 보여준다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 2,
        isFrozen: true,
        hungerMistakeDeadline: now + 5 * 60 * 1000,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunger",
          isPaused: true,
          statusLabel: "냉장고 보관 중으로 호출이 정지되었습니다.",
          pauseReason: "냉장고에서 꺼내면 호출 타이머가 다시 이어집니다.",
        }),
      ])
    );
  });

  test("활성 호출이 없을 때 최근 호출 이력을 생성하고 영어 로그를 한국어로 보정한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp: now - 5000 },
          {
            type: "CARE_MISTAKE",
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            timestamp: now - 3000,
          },
          { type: "CALL", text: "Call: Sleepy!", timestamp: now - 1000 },
          { type: "ACTION", text: "Lights Off", timestamp: now - 500 },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasActiveCalls).toBe(false);
    expect(viewModel.recentCallHistory).toHaveLength(3);
    expect(viewModel.recentCallHistory[0]).toEqual(
      expect.objectContaining({
        title: "수면 조명 경고",
        text: "수면 조명 경고가 시작되었습니다.",
      })
    );
    expect(viewModel.recentCallHistory[1].text).toContain("배고픔 호출");
    expect(viewModel.summaryLabel).toBe("최근 호출 기록 확인");
  });

  test("확인하지 않은 최근 호출은 미확인 상태로 분류한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp: now - 5000 },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasRecentCalls).toBe(true);
    expect(viewModel.hasUnreadRecentCalls).toBe(true);
    expect(viewModel.recentCallHistory[0]).toEqual(
      expect.objectContaining({
        id: `call:hunger:logged:${now - 5000}`,
        isAcknowledged: false,
      })
    );
  });

  test("확인된 최근 호출만 있으면 최근 호출 버튼 대상에서 제외한다", () => {
    const recentId = `call:hunger:logged:${now - 5000}`;
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        acknowledgedRecentCallIds: [recentId],
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp: now - 5000 },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasRecentCalls).toBe(true);
    expect(viewModel.hasUnreadRecentCalls).toBe(false);
    expect(viewModel.summaryLabel).toBe("최근 호출 기록 모두 확인됨");
    expect(viewModel.recentCallHistory[0].isAcknowledged).toBe(true);
  });

  test("기존 확인 목록에 없는 새 최근 호출은 미확인으로 표시한다", () => {
    const oldRecentId = `call:hunger:logged:${now - 5000}`;
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        acknowledgedRecentCallIds: [oldRecentId],
        activityLogs: [
          { type: "CALL", text: "Call: No Energy!", timestamp: now - 1000 },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasUnreadRecentCalls).toBe(true);
    expect(viewModel.recentCallHistory[0]).toEqual(
      expect.objectContaining({
        id: `call:strength:logged:${now - 1000}`,
        isAcknowledged: false,
      })
    );
  });

  test("최근 호출 ID는 새 로그가 앞에 추가되어도 정렬 순서에 따라 바뀌지 않는다", () => {
    const timestamp = now - 5000;
    const baseViewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
      currentTime: now,
    });
    const nextViewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        activityLogs: [
          { type: "CALL", text: "Call: No Energy!", timestamp: now - 1000 },
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
      currentTime: now,
    });

    const baseHungry = baseViewModel.recentCallHistory.find((entry) => entry.callType === "hunger");
    const nextHungry = nextViewModel.recentCallHistory.find((entry) => entry.callType === "hunger");

    expect(nextHungry.id).toBe(baseHungry.id);
  });

  test("legacy 정렬 index 기반 확인 ID도 확인됨으로 흡수한다", () => {
    const timestamp = now - 5000;
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        acknowledgedRecentCallIds: [`CALL-${timestamp}-0`],
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
      currentTime: now,
    });

    expect(viewModel.recentCallHistory[0]).toEqual(
      expect.objectContaining({
        id: `call:hunger:logged:${timestamp}`,
        isAcknowledged: true,
      })
    );
    expect(viewModel.hasUnreadRecentCalls).toBe(false);
  });

  test("확인 ID 병합은 중복을 제거하고 최근 50개까지만 유지한다", () => {
    const baseIds = Array.from({ length: 49 }, (_, index) => `old-${index}`);
    const merged = mergeAcknowledgedRecentCallIds(baseIds, ["old-48", "new-1", "new-2"]);

    expect(merged).toHaveLength(50);
    expect(merged).toContain("new-1");
    expect(merged).toContain("new-2");
    expect(merged.filter((id) => id === "old-48")).toHaveLength(1);
    expect(merged).not.toContain("old-0");
  });

  test("케어미스로 처리된 배고픔과 기력 호출은 현재 호출이 아니라 최근 호출로 분류한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 0,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt: now - 12 * 60 * 1000,
            isLogged: true,
          },
          strength: {
            isActive: true,
            startedAt: now - 11 * 60 * 1000,
            isLogged: true,
          },
          sleep: { isActive: false, startedAt: null, isLogged: false },
        },
      },
      sleepStatus: "AWAKE",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasActiveCalls).toBe(false);
    expect(viewModel.hasRecentCalls).toBe(true);
    expect(viewModel.defaultTab).toBe("recent");
    expect(viewModel.recentCallHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "배고픔 호출",
          text: "배고픔 호출이 케어미스로 처리되었습니다.",
          timestamp: now - 2 * 60 * 1000,
        }),
        expect.objectContaining({
          title: "힘 호출",
          text: "힘 호출이 케어미스로 처리되었습니다.",
          timestamp: now - 60 * 1000,
        }),
      ])
    );
  });

  test("ledger와 activityLog와 callStatus가 같은 케어미스를 가리키면 하나로 병합한다", () => {
    const startedAt = now - 15 * 60 * 1000;
    const timeoutAt = startedAt + 10 * 60 * 1000;
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 3,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt,
            isLogged: true,
          },
        },
        careMistakeLedger: [
          {
            id: `hunger_call:${timeoutAt}`,
            reasonKey: "hunger_call",
            occurredAt: timeoutAt,
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            source: "backfill",
          },
        ],
        activityLogs: [
          {
            type: "CAREMISTAKE",
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            timestamp: timeoutAt,
          },
        ],
      },
      sleepStatus: "AWAKE",
      currentTime: now,
    });

    const hungerEntries = viewModel.recentCallHistory.filter((entry) => entry.callType === "hunger");

    expect(hungerEntries).toHaveLength(1);
    expect(hungerEntries[0]).toEqual(
      expect.objectContaining({
        source: "ledger",
        text: "배고픔 호출이 케어미스로 처리되었습니다.",
        timestamp: timeoutAt,
      })
    );
  });

  test("케어미스로 처리된 수면 조명 경고는 현재 호출이 아니라 최근 호출로 분류한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        sleepLightOnStart: now - 35 * 60 * 1000,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: now - 35 * 60 * 1000,
            isLogged: true,
          },
        },
      },
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.hasActiveCalls).toBe(false);
    expect(viewModel.defaultTab).toBe("recent");
    expect(viewModel.recentCallHistory[0]).toEqual(
      expect.objectContaining({
        title: "수면 조명 경고",
        text: "수면 조명 경고가 케어미스로 처리되었습니다.",
      })
    );
  });

  test("영문 호출 로그 문구를 한국어로 바꾼다", () => {
    expect(normalizeCallLogText("Call: No Energy!")).toBe("힘 호출이 시작되었습니다.");
  });

  test("과거 재구성 내부 태그는 일반 표시 문구에서 제거한다", () => {
    expect(normalizeCallLogText("케어미스(사유: 힘 콜 10분 무시) [과거 재구성]")).toBe(
      "케어미스(사유: 힘 호출 10분 무시)"
    );
  });
});
