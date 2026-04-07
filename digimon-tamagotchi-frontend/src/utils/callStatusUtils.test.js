import { buildCallStatusViewModel, normalizeCallLogText } from "./callStatusUtils";

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
          statusLabel: expect.stringContaining("8분 0초"),
        }),
      ])
    );
  });

  test("수면 호출은 경고 전용으로 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 3,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: now - 20 * 60 * 1000,
          },
        },
      },
      sleepStatus: "TIRED",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sleep",
          riskText: "경고 전용 호출이며 케어미스는 증가하지 않습니다.",
        }),
      ])
    );
    expect(viewModel.activeCalls.find((call) => call.type === "sleep")?.riskText).not.toContain(
      "1 증가"
    );
  });

  test("수면 중인 배고픔 호출은 일시정지로 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 3,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt: now - 1000,
            isLogged: false,
          },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
        hungerMistakeDeadline: now + 10 * 60 * 1000,
      },
      sleepStatus: "SLEEPING",
      isLightsOn: false,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunger",
          isPaused: true,
          pauseReason: "잠든 동안에는 호출 타이머가 멈춰 있습니다.",
        }),
      ])
    );
  });

  test("TIRED 상태의 배고픔 호출은 일시정지 없이 10분 타이머를 계속 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 0,
        strength: 3,
        callStatus: {
          hunger: {
            isActive: true,
            startedAt: now - 2 * 60 * 1000,
            isLogged: false,
          },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: now - 2 * 60 * 1000,
          },
        },
        hungerMistakeDeadline: now + 8 * 60 * 1000,
      },
      sleepStatus: "TIRED",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hunger",
          isPaused: false,
          pauseReason: "",
          statusLabel: expect.stringContaining("8분 0초"),
        }),
      ])
    );
  });

  test("TIRED 상태의 힘 호출은 일시정지 없이 10분 타이머를 계속 표시한다", () => {
    const viewModel = buildCallStatusViewModel({
      digimonStats: {
        fullness: 3,
        strength: 0,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: {
            isActive: true,
            startedAt: now - 4 * 60 * 1000,
            isLogged: false,
          },
          sleep: {
            isActive: true,
            startedAt: now - 4 * 60 * 1000,
          },
        },
        strengthMistakeDeadline: now + 6 * 60 * 1000,
      },
      sleepStatus: "TIRED",
      isLightsOn: true,
      currentTime: now,
    });

    expect(viewModel.activeCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "strength",
          isPaused: false,
          pauseReason: "",
          statusLabel: expect.stringContaining("6분 0초"),
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
        title: "수면 호출",
        text: "수면 호출이 시작되었습니다.",
      })
    );
    expect(viewModel.recentCallHistory[1].text).toContain("배고픔 호출");
    expect(viewModel.summaryLabel).toBe("최근 호출 기록 확인");
  });

  test("영문 호출 로그 문구를 한국어로 바꾼다", () => {
    expect(normalizeCallLogText("Call: No Energy!")).toBe("힘 호출이 시작되었습니다.");
  });
});
