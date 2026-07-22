import {
  buildFormTransitionCombatIdentity,
  createNewLifeCombatIdentity,
  hasValidCombatIdentity,
  preserveOrCreateCombatIdentity,
} from "./combatIdentity";

describe("arena combat identity", () => {
  test("새 생명은 새 instance와 revision 1을 사용한다", () => {
    expect(createNewLifeCombatIdentity(() => "life-a")).toEqual({
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "life-a",
      combatRevision: 1,
    });
  });

  test("기존 identity는 저장할 때 재발급하지 않는다", () => {
    const identity = {
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "life-a",
      combatRevision: 4,
    };
    expect(preserveOrCreateCombatIdentity(identity, () => "life-b")).toEqual(identity);
  });

  test("형태 전환은 instance를 보존하고 revision만 1 증가시킨다", () => {
    expect(
      buildFormTransitionCombatIdentity({
        arenaIdentitySchemaVersion: 1,
        digimonInstanceId: "life-a",
        combatRevision: 4,
      })
    ).toEqual({
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "life-a",
      combatRevision: 5,
    });
  });

  test("누락된 identity로 형태 전환하지 않는다", () => {
    expect(hasValidCombatIdentity({ combatRevision: 1 })).toBe(false);
    expect(() => buildFormTransitionCombatIdentity({ combatRevision: 1 })).toThrow(
      "backfill"
    );
  });
});
