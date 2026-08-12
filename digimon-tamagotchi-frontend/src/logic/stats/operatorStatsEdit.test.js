import {
  buildChangedOperatorStatsPatch,
  buildOperatorStatsDraft,
  normalizeOperatorStatsPatch,
  persistOperatorStatsPatch,
  resolveOperatorMaxEnergy,
} from "./operatorStatsEdit";

describe("operatorStatsEdit", () => {
  test("허용된 1차 운영자 스탯만 표시용 초안으로 만든다", () => {
    const draft = buildOperatorStatsDraft({
      fullness: 9,
      strength: -1,
      energy: 40,
      maxEnergy: 20,
      weight: 101,
      poopCount: 12,
      careMistakes: 2,
      trainings: 3,
      overfeeds: 4,
      proteinOverdose: 9,
      injuries: 20,
      battlesWon: 6,
      battlesLost: 7,
      isInjured: true,
      lifespanSeconds: 999,
    });

    expect(draft).toEqual({
      fullness: 5,
      strength: 0,
      energy: 20,
      weight: 101,
      poopCount: 8,
      careMistakes: 2,
      trainings: 3,
      overfeeds: 4,
      proteinOverdose: 7,
      injuries: 15,
      battlesWon: 6,
      battlesLost: 7,
      isInjured: true,
    });
    expect(draft).not.toHaveProperty("lifespanSeconds");
  });

  test("종 데이터의 에너지 최대치를 fallback으로 사용한다", () => {
    expect(resolveOperatorMaxEnergy({}, { stats: { energy: 30 } })).toBe(30);
    expect(normalizeOperatorStatsPatch(
      { energy: 99 },
      {},
      { stats: { energy: 30 } }
    )).toEqual({ energy: 30 });
  });

  test("현재 값과 달라진 허용 필드만 patch로 만든다", () => {
    expect(buildChangedOperatorStatsPatch(
      { fullness: 2, strength: 3, isInjured: false, maxEnergy: 20 },
      { fullness: 5, strength: 3, isInjured: true },
    )).toEqual({ fullness: 5, isInjured: true });
  });

  test("허용되지 않은 필드는 실패 처리한다", () => {
    expect(() => normalizeOperatorStatsPatch(
      { lifespanSeconds: 0 },
      {},
    )).toThrow("운영자 수정이 허용되지 않은 스탯입니다");
  });

  test("불리언 필드는 명시적 true만 true로 저장한다", () => {
    expect(normalizeOperatorStatsPatch({ isInjured: true })).toEqual({ isInjured: true });
    expect(normalizeOperatorStatsPatch({ isInjured: "false" })).toEqual({ isInjured: false });
  });

  test("저장 시점에 운영자를 한 번 다시 확인하고 허용 patch만 순차 저장한다", async () => {
    const verifyOperator = jest.fn().mockResolvedValue({ isOperator: true });
    const saveCommand = jest.fn().mockResolvedValue({ status: "synced" });

    await expect(persistOperatorStatsPatch({
      requestedPatch: { fullness: 5, energy: 99 },
      stats: { maxEnergy: 20 },
      verifyOperator,
      saveCommand,
    })).resolves.toHaveLength(2);

    expect(verifyOperator).toHaveBeenCalledTimes(1);
    expect(saveCommand.mock.calls.map(([command]) => [command.field, command.value])).toEqual([
      ["fullness", 5],
      ["energy", 20],
    ]);
  });

  test("저장 시점에 운영자 권한이 없으면 아무 값도 저장하지 않는다", async () => {
    const saveCommand = jest.fn();
    await expect(persistOperatorStatsPatch({
      requestedPatch: { fullness: 5 },
      verifyOperator: jest.fn().mockResolvedValue({ isOperator: false }),
      saveCommand,
    })).rejects.toThrow("운영자 권한을 확인할 수 없어");
    expect(saveCommand).not.toHaveBeenCalled();
  });
});
