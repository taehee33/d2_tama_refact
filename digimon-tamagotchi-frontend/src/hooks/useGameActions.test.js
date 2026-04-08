import { buildArenaBattleArchiveWrite, wakeForInteraction } from "./useGameActions";

describe("wakeForInteraction", () => {
  test("자는 중 액션 1회는 sleepDisturbances를 올리고 wakeUntil을 설정하지만 careMistakes는 올리지 않는다", () => {
    const setWakeUntil = jest.fn();
    const onSleepDisturbance = jest.fn();
    const stats = {
      careMistakes: 3,
      sleepDisturbances: 1,
      napUntil: null,
    };

    const before = Date.now();
    const result = wakeForInteraction(stats, setWakeUntil, jest.fn(), true, onSleepDisturbance);
    const after = Date.now();

    expect(result.sleepDisturbances).toBe(2);
    expect(result.careMistakes).toBe(3);
    expect(result.wakeUntil).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(result.wakeUntil).toBeLessThanOrEqual(after + 10 * 60 * 1000);
    expect(setWakeUntil).toHaveBeenCalledWith(result.wakeUntil);
    expect(onSleepDisturbance).toHaveBeenCalledTimes(1);
  });

  test("낮잠 중 깨움은 wakeUntil만 설정하고 sleepDisturbances는 올리지 않는다", () => {
    const setWakeUntil = jest.fn();
    const onSleepDisturbance = jest.fn();
    const stats = {
      careMistakes: 1,
      sleepDisturbances: 4,
      napUntil: Date.now() + 5 * 60 * 1000,
    };

    const result = wakeForInteraction(stats, setWakeUntil, jest.fn(), false, onSleepDisturbance);

    expect(result.sleepDisturbances).toBe(4);
    expect(result.careMistakes).toBe(1);
    expect(setWakeUntil).toHaveBeenCalledTimes(1);
    expect(onSleepDisturbance).not.toHaveBeenCalled();
  });
});

describe("buildArenaBattleArchiveWrite", () => {
  test("Firestore summary 로그에는 replay logs를 저장하지 않고 Supabase payload에만 유지한다", () => {
    const result = buildArenaBattleArchiveWrite({
      archiveId: "arena_test_1",
      currentUser: {
        uid: "user-1",
        displayName: "테스터",
      },
      slotId: 3,
      slotName: "슬롯3",
      arenaChallenger: {
        userId: "enemy-1",
        tamerName: "상대",
      },
      enemyEntryId: "enemy-entry",
      myArenaEntryId: "my-entry",
      battleResult: {
        win: true,
        logs: [
          { type: "START", text: "배틀 시작" },
          { type: "ATTACK", text: "공격 성공" },
        ],
      },
      currentSeasonId: "season-1",
      userDigimonName: "코로몬",
      enemyDigimonName: "베타몬",
    });

    expect(result.firestoreLogData).toMatchObject({
      archiveId: "arena_test_1",
      attackerId: "user-1",
      defenderId: "enemy-1",
      winnerId: "user-1",
    });
    expect(result.firestoreLogData.logs).toBeUndefined();
    expect(result.archivePayload.replayLogs).toEqual([
      { type: "START", text: "배틀 시작" },
      { type: "ATTACK", text: "공격 성공" },
    ]);
    expect(result.archivePayload.payload.result.logs).toHaveLength(2);
  });
});
