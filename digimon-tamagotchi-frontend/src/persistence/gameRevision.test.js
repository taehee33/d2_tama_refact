import {
  GameRevisionConflictError,
  buildReplayAction,
  commitRevisionedSlot,
  normalizeGameRevision,
  replaySafeActions,
} from "./gameRevision";

describe("gameRevision", () => {
  test("구 슬롯의 잘못된 revision은 0으로 취급한다", () => {
    expect(normalizeGameRevision(undefined)).toBe(0);
    expect(normalizeGameRevision(-1)).toBe(0);
    expect(normalizeGameRevision("4")).toBe(4);
  });

  test("revision이 같으면 transaction에서 한 번 증가시킨다", async () => {
    const update = jest.fn();
    const runTransaction = async (_db, callback) => callback({
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ revision: 7 }),
      }),
      update,
    });

    await expect(commitRevisionedSlot({
      db: {},
      slotRef: {},
      baseRevision: 7,
      updateData: { digimonStats: { fullness: 3 } },
      runTransaction,
    })).resolves.toEqual({ revision: 8 });
    expect(update).toHaveBeenCalledWith({}, expect.objectContaining({ revision: 8 }));
  });

  test("revision이 다르면 원격 상태를 덮어쓰지 않는다", async () => {
    const update = jest.fn();
    const runTransaction = async (_db, callback) => callback({
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ revision: 9, digimonStats: { fullness: 5 } }),
      }),
      update,
    });

    await expect(commitRevisionedSlot({
      db: {},
      slotRef: {},
      baseRevision: 7,
      updateData: { digimonStats: { fullness: 1 } },
      runTransaction,
    })).rejects.toBeInstanceOf(GameRevisionConflictError);
    expect(update).not.toHaveBeenCalled();
  });

  test("먹이와 훈련 결과를 원격 최신 상태에 순서대로 재생한다", () => {
    const feed = buildReplayAction({
      eventId: "feed-1",
      type: "FEED",
      timestamp: 10,
      beforeStats: { fullness: 2, weight: 10, strength: 1, energy: 2 },
      afterStats: { fullness: 3, weight: 11, strength: 1, energy: 2 },
    });
    const train = buildReplayAction({
      eventId: "train-1",
      type: "TRAIN",
      timestamp: 20,
      beforeStats: { weight: 11, energy: 2, strength: 1, trainings: 0, effort: 0 },
      afterStats: { weight: 9, energy: 1, strength: 2, trainings: 1, effort: 0 },
    });

    expect(replaySafeActions({
      fullness: 3,
      weight: 20,
      strength: 2,
      energy: 4,
      trainings: 4,
      effort: 1,
      maxEnergy: 5,
    }, [train, feed])).toMatchObject({
      status: "replayed",
      stats: {
        fullness: 4,
        weight: 19,
        strength: 3,
        energy: 3,
        trainings: 5,
        effort: 1,
      },
    });
  });

  test("사망·진화 같은 위험 액션이 있으면 자동 재생하지 않는다", () => {
    const death = buildReplayAction({
      eventId: "death-1",
      type: "DEATH",
      timestamp: 10,
      beforeStats: { isDead: false },
      afterStats: { isDead: true },
    });

    expect(replaySafeActions({ isDead: false }, [death])).toEqual({
      status: "conflict",
      stats: { isDead: false },
      unsafeAction: death,
    });
  });

  test("조명 액션은 원격 루트 상태 위에 순서대로 재생한다", () => {
    const lightsOff = buildReplayAction({
      eventId: "lights-1",
      type: "ACTION",
      timestamp: 10,
      beforeStats: { isLightsOn: true, wakeUntil: null },
      afterStats: { isLightsOn: false, wakeUntil: 1234 },
    });

    expect(replaySafeActions(
      { isLightsOn: true, wakeUntil: null },
      [lightsOff]
    )).toMatchObject({
      status: "replayed",
      stats: { isLightsOn: false, wakeUntil: 1234 },
    });
  });
});
