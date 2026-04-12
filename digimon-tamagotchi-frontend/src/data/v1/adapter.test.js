import { adaptNewDataToOldFormat } from "./adapter";

describe("adaptNewDataToOldFormat", () => {
  test("24:00 수면 시간 문자열을 유지하면서 sleepSchedule 시작 시각은 자정으로 계산한다", () => {
    const adapted = adaptNewDataToOldFormat({
      id: "Testmon",
      name: "테스트몬",
      stage: "Adult",
      sprite: 10,
      stats: {
        hungerCycle: 10,
        strengthCycle: 10,
        poopCycle: 10,
        maxOverfeed: 2,
        basePower: 50,
        maxEnergy: 20,
        minWeight: 15,
        sleepTime: "24:00",
        wakeTime: "08:00",
        attackSprite: 99,
      },
    });

    expect(adapted.sleepTime).toBe("24:00");
    expect(adapted.sleepSchedule).toMatchObject({
      start: 0,
      startMinute: 0,
      startTime: "24:00",
      end: 8,
      endMinute: 0,
      endTime: "08:00",
    });
  });

  test("24:00 기상 시간도 표시 문자열은 유지하고 sleepSchedule 종료 시각은 0시로 계산한다", () => {
    const adapted = adaptNewDataToOldFormat({
      id: "Nightmon",
      name: "나이트몬",
      stage: "Perfect",
      sprite: 22,
      stats: {
        hungerCycle: 20,
        strengthCycle: 20,
        poopCycle: 20,
        maxOverfeed: 3,
        basePower: 80,
        maxEnergy: 30,
        minWeight: 25,
        sleepTime: "22:30",
        wakeTime: "24:00",
        attackSprite: 77,
      },
    });

    expect(adapted.wakeTime).toBe("24:00");
    expect(adapted.sleepSchedule).toMatchObject({
      start: 22,
      startMinute: 30,
      startTime: "22:30",
      end: 0,
      endMinute: 0,
      endTime: "24:00",
    });
  });
});
