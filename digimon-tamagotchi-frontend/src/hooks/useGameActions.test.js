import {
  applyBattleInjuryOutcome,
  buildArenaBattleArchiveWrite,
  buildActivityLogCommitState,
  buildBattleCostStats,
  buildBattleLogCommitState,
  buildBattleLogEntry,
  buildCleanOutcome,
  buildFeedOutcome,
  buildFeedLogText,
  buildRecordedBattleStats,
  buildSleepDisturbanceCommitState,
  buildTrainingLogText,
  buildTrainingOutcome,
  buildTrainingSkipOutcome,
  wakeForInteraction,
} from "./useGameActions";

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

describe("buildBattleCostStats", () => {
  test("배틀 공통 비용으로 무게 -4g, 에너지 -1을 적용하고 변화량을 반환한다", () => {
    const result = buildBattleCostStats({
      weight: 12,
      energy: 5,
    });

    expect(result).toEqual({
      battleStats: {
        weight: 8,
        energy: 4,
      },
      weightDelta: -4,
      energyDelta: -1,
    });
  });

  test("무게와 에너지는 0 아래로 내려가지 않는다", () => {
    const result = buildBattleCostStats({
      weight: 2,
      energy: 0,
    });

    expect(result).toEqual({
      battleStats: {
        weight: 0,
        energy: 0,
      },
      weightDelta: -2,
      energyDelta: 0,
    });
  });
});

describe("buildActivityLogCommitState", () => {
  test("새 활동 로그를 앞에 붙이고 nextStats에 activityLogs를 반영한다", () => {
    const result = buildActivityLogCommitState({
      prevStats: {
        activityLogs: [{ type: "OLD", text: "old", timestamp: 1000 }],
      },
      nextStats: {
        energy: 4,
      },
      entry: {
        type: "TRAIN",
        text: "new",
        timestamp: 2000,
      },
    });

    expect(result.updatedLogs).toEqual([
      { type: "TRAIN", text: "new", timestamp: 2000 },
      { type: "OLD", text: "old", timestamp: 1000 },
    ]);
    expect(result.statsWithLogs).toEqual({
      energy: 4,
      activityLogs: [
        { type: "TRAIN", text: "new", timestamp: 2000 },
        { type: "OLD", text: "old", timestamp: 1000 },
      ],
    });
  });

  test("기존 로그가 없어도 단일 활동 로그 배열을 만든다", () => {
    const result = buildActivityLogCommitState({
      prevStats: {},
      nextStats: {
        fullness: 3,
      },
      entry: {
        type: "FEED",
        text: "feed",
        timestamp: 3000,
      },
    });

    expect(result.updatedLogs).toEqual([
      { type: "FEED", text: "feed", timestamp: 3000 },
    ]);
    expect(result.statsWithLogs).toEqual({
      fullness: 3,
      activityLogs: [{ type: "FEED", text: "feed", timestamp: 3000 }],
    });
  });
});

describe("buildBattleLogEntry", () => {
  test("배틀 로그 공통 필드와 snapshot을 합치고 선택 필드만 포함한다", () => {
    const result = buildBattleLogEntry({
      mode: "quest",
      text: "Quest: Defeated 베타몬",
      win: true,
      enemyName: "베타몬",
      injury: false,
      timestamp: 1234,
      digimonSnapshot: {
        digimonId: "Agumon",
        digimonName: "아구몬",
      },
    });

    expect(result).toEqual({
      mode: "quest",
      text: "Quest: Defeated 베타몬",
      win: true,
      enemyName: "베타몬",
      injury: false,
      timestamp: 1234,
      digimonId: "Agumon",
      digimonName: "아구몬",
    });
  });

  test("선택 필드가 없으면 mode/text/timestamp와 snapshot만 남긴다", () => {
    const result = buildBattleLogEntry({
      mode: "skip",
      text: "Battle: Skipped",
      timestamp: 5678,
      digimonSnapshot: {
        digimonId: "Agumon",
      },
    });

    expect(result).toEqual({
      mode: "skip",
      text: "Battle: Skipped",
      timestamp: 5678,
      digimonId: "Agumon",
    });
  });
});

describe("buildBattleLogCommitState", () => {
  test("새 배틀 로그를 앞에 붙이고 nextStats에 battleLogs를 반영한다", () => {
    const result = buildBattleLogCommitState({
      prevStats: {
        battleLogs: [{ mode: "quest", text: "old", timestamp: 1000 }],
      },
      nextStats: {
        energy: 4,
      },
      entry: {
        mode: "arena",
        text: "new",
        timestamp: 2000,
      },
    });

    expect(result.updatedBattleLogs).toEqual([
      { mode: "arena", text: "new", timestamp: 2000 },
      { mode: "quest", text: "old", timestamp: 1000 },
    ]);
    expect(result.statsWithBattleLogs).toEqual({
      energy: 4,
      battleLogs: [
        { mode: "arena", text: "new", timestamp: 2000 },
        { mode: "quest", text: "old", timestamp: 1000 },
      ],
    });
  });
});

describe("buildFeedLogText", () => {
  test("고기 일반 섭취 로그를 변화량과 결과값으로 만든다", () => {
    const result = buildFeedLogText({
      type: "meat",
      beforeStats: {
        fullness: 2,
        weight: 10,
      },
      updatedStats: {
        fullness: 3,
        weight: 11,
      },
      eatResult: {},
    });

    expect(result).toBe(
      "Feed: Meat (Wt +1g, Hun +1) => (Wt 10→11g, Hun 2→3)"
    );
  });

  test("고기 오버피드와 거절 로그를 구분한다", () => {
    expect(
      buildFeedLogText({
        type: "meat",
        eatResult: { isOverfeed: true },
        beforeStats: {
          overfeeds: 1,
        },
        updatedStats: {
          overfeeds: 2,
        },
      })
    ).toBe("Overfeed! (거절 상태, Overfeed 1→2)");

    expect(
      buildFeedLogText({
        type: "meat",
        isRefused: true,
        eatResult: {},
        beforeStats: {},
        updatedStats: {},
      })
    ).toBe("Feed: Refused (고기 거절, Overfeed 증가 없음)");
  });

  test("프로틴 보너스 로그는 힘과 에너지 변화를 함께 포함한다", () => {
    const result = buildFeedLogText({
      type: "protein",
      eatResult: { energyRestored: true },
      beforeStats: {
        weight: 10,
        strength: 2,
        energy: 1,
      },
      updatedStats: {
        weight: 11,
        strength: 3,
        energy: 2,
      },
    });

    expect(result).toBe(
      "Feed: Protein (Wt +1g, Str +1, En +1) - Protein Bonus! (En +1, Overdose +1) => (Wt 10→11g, Str 2→3, En 1→2)"
    );
  });
});

describe("buildFeedOutcome", () => {
  test("고기 거절 상태 아니오 선택은 스탯을 유지하고 거절 로그를 반환한다", () => {
    const baseStats = {
      fullness: 0,
      weight: 12,
      overfeeds: 1,
      callStatus: {
        hunger: { isActive: true, startedAt: 1, isLogged: true },
      },
    };

    const result = buildFeedOutcome({
      type: "meat",
      baseStats,
      isRefused: true,
    });

    expect(result.eatResult).toMatchObject({
      fullnessIncreased: false,
      canEatMore: false,
      isOverfeed: false,
    });
    expect(result.updatedStats).toEqual(baseStats);
    expect(result.logText).toBe("Feed: Refused (고기 거절, Overfeed 증가 없음)");
  });

  test("프로틴 결과는 hunger/strength 호출을 해제하고 로그까지 함께 반환한다", () => {
    const baseStats = {
      fullness: 2,
      weight: 10,
      strength: 3,
      energy: 0,
      maxEnergy: 5,
      callStatus: {
        hunger: { isActive: true, startedAt: 1, isLogged: true },
        strength: { isActive: true, startedAt: 2, isLogged: true },
      },
    };

    const result = buildFeedOutcome({
      type: "protein",
      baseStats,
    });

    expect(result.updatedStats.weight).toBe(12);
    expect(result.updatedStats.strength).toBe(4);
    expect(result.updatedStats.energy).toBe(1);
    expect(result.updatedStats.callStatus.hunger.isActive).toBe(false);
    expect(result.updatedStats.callStatus.strength.isActive).toBe(false);
    expect(baseStats.callStatus.hunger.isActive).toBe(true);
    expect(baseStats.callStatus.strength.isActive).toBe(true);
    expect(result.logText).toBe(
      "Feed: Protein (Wt +2g, Str +1, En +1) - Protein Bonus! (En +1, Overdose +1) => (Wt 10→12g, Str 3→4, En 0→1)"
    );
  });
});

describe("buildCleanOutcome", () => {
  test("청소 결과는 똥 관련 overflow 상태를 초기화하고 로그 문구를 반환한다", () => {
    const now = new Date("2026-04-11T12:34:56.000Z");
    const result = buildCleanOutcome({
      prevStats: {
        poopCount: 3,
        poopReachedMaxAt: 1000,
        lastPoopPenaltyAt: 2000,
        poopPenaltyFrozenDurationMs: 3000,
        lastSavedAt: 500,
        isInjured: true,
      },
      now,
    });

    expect(result.logText).toBe("Cleaned Poop (Full flush, 3 → 0)");
    expect(result.updatedStats).toMatchObject({
      poopCount: 0,
      poopReachedMaxAt: null,
      lastPoopPenaltyAt: null,
      poopPenaltyFrozenDurationMs: 0,
      isInjured: true,
      lastSavedAt: now.getTime(),
    });
  });
});

describe("buildSleepDisturbanceCommitState", () => {
  test("수면 방해 로그 entry와 activity commit state를 함께 반환한다", () => {
    const result = buildSleepDisturbanceCommitState({
      prevStats: {
        activityLogs: [{ type: "OLD", text: "old", timestamp: 1000 }],
      },
      nextStats: {
        sleepDisturbances: 2,
      },
      reason: "훈련",
      timestamp: 2000,
    });

    expect(result.entry).toEqual({
      type: "SLEEP_DISTURBANCE",
      text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
      timestamp: 2000,
    });
    expect(result.updatedLogs).toEqual([
      {
        type: "SLEEP_DISTURBANCE",
        text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
        timestamp: 2000,
      },
      { type: "OLD", text: "old", timestamp: 1000 },
    ]);
    expect(result.statsWithLogs).toEqual({
      sleepDisturbances: 2,
      activityLogs: [
        {
          type: "SLEEP_DISTURBANCE",
          text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
          timestamp: 2000,
        },
        { type: "OLD", text: "old", timestamp: 1000 },
      ],
    });
  });
});

describe("buildTrainingLogText", () => {
  test("훈련 성공 로그를 변화 전후 값으로 만든다", () => {
    const result = buildTrainingLogText({
      result: { isSuccess: true },
      beforeStats: {
        weight: 12,
        strength: 2,
        energy: 5,
        trainings: 4,
      },
      finalStats: {
        weight: 11,
        strength: 3,
        energy: 4,
        trainings: 5,
      },
    });

    expect(result).toBe(
      "훈련 성공! 힘 2→3, 무게 12→11g, 에너지 5→4, 훈련횟수 4→5"
    );
  });

  test("훈련 실패 로그도 같은 형식으로 만든다", () => {
    const result = buildTrainingLogText({
      result: { isSuccess: false },
      beforeStats: {
        weight: 12,
        strength: 2,
        energy: 5,
        trainings: 4,
      },
      finalStats: {
        weight: 11,
        strength: 2,
        energy: 4,
        trainings: 5,
      },
    });

    expect(result).toBe(
      "훈련 실패. 힘 2→2, 무게 12→11g, 에너지 5→4, 훈련횟수 4→5"
    );
  });
});

describe("buildTrainingOutcome", () => {
  test("strength가 남아 있으면 호출 상태를 해제하고 성공 로그를 반환한다", () => {
    const updatedStats = {
      strength: 2,
      callStatus: {
        strength: { isActive: true },
      },
      weight: 11,
      energy: 4,
      trainings: 5,
    };
    const result = buildTrainingOutcome({
      baseStats: {
        strength: 0,
        callStatus: {
          strength: { isActive: true },
        },
        weight: 12,
        energy: 5,
        trainings: 4,
      },
      trainingResult: {
        isSuccess: true,
        updatedStats,
      },
    });

    expect(result.finalStats.callStatus?.strength?.isActive).toBe(false);
    expect(updatedStats.callStatus.strength.isActive).toBe(true);
    expect(result.logText).toBe(
      "훈련 성공! 힘 0→2, 무게 12→11g, 에너지 5→4, 훈련횟수 4→5"
    );
  });

  test("실패 케이스에서도 finalStats와 로그를 함께 반환한다", () => {
    const result = buildTrainingOutcome({
      baseStats: {
        strength: 2,
        weight: 12,
        energy: 5,
        trainings: 4,
      },
      trainingResult: {
        isSuccess: false,
        updatedStats: {
          strength: 2,
          weight: 11,
          energy: 4,
          trainings: 5,
        },
      },
    });

    expect(result.finalStats).toMatchObject({
      strength: 2,
      weight: 11,
      energy: 4,
      trainings: 5,
    });
    expect(result.logText).toBe(
      "훈련 실패. 힘 2→2, 무게 12→11g, 에너지 5→4, 훈련횟수 4→5"
    );
  });
});

describe("buildTrainingSkipOutcome", () => {
  test("체중 부족 사유면 체중 부족 로그와 안내 문구를 반환한다", () => {
    const result = buildTrainingSkipOutcome({
      reason: "underweight",
      baseStats: {
        weight: 0,
        energy: 3,
      },
      timestamp: 1234,
    });

    expect(result).toEqual({
      entry: {
        type: "TRAIN",
        text: "훈련 건너뜀(사유: 체중 부족). 무게: 0g",
        timestamp: 1234,
      },
      alertMessage: "⚠️ 체중이 너무 낮습니다!\n먹이로 체중을 늘려 주세요.",
    });
  });

  test("에너지 부족 사유면 에너지 부족 로그와 안내 문구를 반환한다", () => {
    const result = buildTrainingSkipOutcome({
      reason: "lowEnergy",
      baseStats: {
        weight: 9,
        energy: 0,
      },
      timestamp: 5678,
    });

    expect(result).toEqual({
      entry: {
        type: "TRAIN",
        text: "훈련 건너뜀(사유: 에너지 부족). 에너지: 0, 무게: 9g",
        timestamp: 5678,
      },
      alertMessage: "⚠️ 에너지가 부족합니다!\n잠을 재워 에너지를 회복해 주세요.",
    });
  });
});

describe("buildRecordedBattleStats", () => {
  test("승리 시 현재/총 전적과 승률을 함께 갱신한다", () => {
    const result = buildRecordedBattleStats(
      {
        battles: 4,
        battlesWon: 2,
        battlesLost: 2,
        totalBattles: 10,
        totalBattlesWon: 6,
        totalBattlesLost: 4,
      },
      true
    );

    expect(result).toMatchObject({
      battles: 5,
      battlesWon: 3,
      battlesLost: 2,
      winRate: 60,
      totalBattles: 11,
      totalBattlesWon: 7,
      totalBattlesLost: 4,
      totalWinRate: 64,
    });
  });

  test("패배 시 현재/총 패배 전적과 승률을 갱신한다", () => {
    const result = buildRecordedBattleStats(
      {
        battles: 4,
        battlesWon: 2,
        battlesLost: 2,
        totalBattles: 10,
        totalBattlesWon: 6,
        totalBattlesLost: 4,
      },
      false
    );

    expect(result).toMatchObject({
      battles: 5,
      battlesWon: 2,
      battlesLost: 3,
      winRate: 40,
      totalBattles: 11,
      totalBattlesWon: 6,
      totalBattlesLost: 5,
      totalWinRate: 55,
    });
  });
});

describe("applyBattleInjuryOutcome", () => {
  test("확률에 걸리면 부상 상태와 관련 필드를 전투 부상 기준으로 세팅한다", () => {
    const result = applyBattleInjuryOutcome({
      finalStats: {
        injuries: 2,
        healedDosesCurrent: 3,
      },
      win: true,
      proteinOverdose: 0,
      randomValue: 0,
      nowMs: 123456789,
    });

    expect(result.isInjured).toBe(true);
    expect(result.finalStats).toMatchObject({
      isInjured: true,
      injuredAt: 123456789,
      injuryFrozenDurationMs: 0,
      injuries: 3,
      healedDosesCurrent: 0,
      injuryReason: "battle",
    });
  });

  test("확률에 걸리지 않으면 스탯을 그대로 유지한다", () => {
    const result = applyBattleInjuryOutcome({
      finalStats: {
        injuries: 1,
      },
      win: false,
      proteinOverdose: 0,
      randomValue: 0.99,
      nowMs: 123456789,
    });

    expect(result.isInjured).toBe(false);
    expect(result.finalStats).toEqual({
      injuries: 1,
    });
  });
});
