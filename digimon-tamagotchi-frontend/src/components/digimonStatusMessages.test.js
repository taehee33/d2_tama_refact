import {
  buildDigimonStatusMessages,
  getSummaryDigimonStatusMessages,
} from "./digimonStatusMessages";

function createBaseStats(overrides = {}) {
  return {
    fullness: 3,
    strength: 3,
    poopCount: 0,
    injuries: 0,
    proteinOverdose: 0,
    maxOverfeed: 0,
    callStatus: {
      hunger: { isActive: false },
      strength: { isActive: false },
      sleep: { isActive: false },
    },
    ...overrides,
  };
}

describe("digimonStatusMessages", () => {
  test("배고픔/힘 경고가 있으면 수면까지 메시지는 상세로만 남고 상단 요약에서는 빠진다", () => {
    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats({
        fullness: 0,
        strength: 0,
      }),
      sleepStatus: "AWAKE",
      canEvolve: true,
      sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
      currentTime: new Date(2026, 3, 7, 20, 0, 0).getTime(),
    });

    const summaryMessages = getSummaryDigimonStatusMessages(messages, 3);

    expect(messages.map((message) => message.id)).toContain("time-until-sleep");
    expect(summaryMessages).toHaveLength(3);
    expect(summaryMessages.map((message) => message.id)).toEqual([
      "hunger-zero",
      "strength-zero",
      "can-evolve",
    ]);
  });

  test("평온한 AWAKE 상태에서는 수면까지 메시지가 생활 정보로 생성된다", () => {
    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats(),
      sleepStatus: "AWAKE",
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      currentTime: new Date(2026, 3, 7, 19, 30, 0).getTime(),
    });

    const sleepMessage = messages.find((message) => message.id === "time-until-sleep");

    expect(sleepMessage).toBeTruthy();
    expect(sleepMessage.category).toBe("info");
    expect(sleepMessage.text).toContain("수면까지");
  });

  test("wakeUntil이 있으면 수면 방해만 남고 수면까지 메시지는 중복 생성되지 않는다", () => {
    const now = new Date(2026, 3, 7, 22, 10, 0).getTime();

    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats(),
      sleepStatus: "AWAKE",
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      wakeUntil: now + 5 * 60 * 1000,
      currentTime: now,
    });

    expect(messages.map((message) => message.id)).toContain("sleep-disturbance");
    expect(messages.map((message) => message.id)).not.toContain("time-until-sleep");
  });

  test("SLEEPING_LIGHT_ON 상태는 한국어 경고 문구와 남은 시간 힌트로 표시된다", () => {
    const now = new Date(2026, 3, 7, 23, 10, 0).getTime();

    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats(),
      sleepStatus: "SLEEPING_LIGHT_ON",
      sleepLightOnStart: now - 10 * 60 * 1000,
      currentTime: now,
    });

    const tiredMessage = messages.find((message) => message.id === "sleep-light-on");

    expect(tiredMessage).toBeTruthy();
    expect(tiredMessage.text).toBe("수면 중(불 켜짐 경고!) 😴");
    expect(tiredMessage.detailHint).toContain("케어 미스까지");
    expect(tiredMessage.text).not.toContain("TIRED");
  });

  test("FALLING_ASLEEP 상태는 남은 15초 카운트다운을 본문과 힌트에 표시한다", () => {
    const now = new Date(2026, 3, 7, 23, 10, 5).getTime();

    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats({
        fastSleepStart: now - 5 * 1000,
      }),
      sleepStatus: "FALLING_ASLEEP",
      currentTime: now,
    });

    const fallingAsleepMessage = messages.find(
      (message) => message.id === "sleep-falling-asleep"
    );

    expect(fallingAsleepMessage).toBeTruthy();
    expect(fallingAsleepMessage.text).toBe("잠들기 준비 10초 🌙");
    expect(fallingAsleepMessage.detailHint).toBe(
      "10초 후 실제 수면 상태로 전환돼요."
    );
  });

  test("NAPPING 상태는 남은 낮잠 시간을 본문과 힌트에 표시한다", () => {
    const now = new Date(2026, 3, 7, 23, 10, 5).getTime();

    const messages = buildDigimonStatusMessages({
      digimonStats: createBaseStats({
        napUntil: now + 65 * 1000,
      }),
      sleepStatus: "NAPPING",
      currentTime: now,
    });

    const nappingMessage = messages.find(
      (message) => message.id === "sleep-napping"
    );

    expect(nappingMessage).toBeTruthy();
    expect(nappingMessage.text).toBe("낮잠 1분 5초 남음 😴");
    expect(nappingMessage.detailHint).toBe("1분 5초 뒤에 다시 깨어나요.");
  });
});
