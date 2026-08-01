import {
  createRealtimeArenaCpuCandidates,
  selectRealtimeArenaCpuAction,
  selectRealtimeArenaCpuOpponent,
} from "./cpu";
import { createRealtimeArenaRulesSnapshot } from "./rulesets";

const rules = createRealtimeArenaRulesSnapshot();

test("CPU 후보는 실시간 배틀 참가 가능 단계만 포함한다", () => {
  const candidates = createRealtimeArenaCpuCandidates(rules);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((candidate) => rules.eligibleStages.includes(candidate.stage))).toBe(true);
  expect(candidates.some((candidate) => candidate.stage === "Digitama")).toBe(false);
});

test("같은 시드와 전투력은 같은 상위 후보를 선택한다", () => {
  const input = { host: { stage: "Adult", sourcePower: 50 }, rules, seed: "fixed-seed" };
  expect(selectRealtimeArenaCpuOpponent(input)).toEqual(selectRealtimeArenaCpuOpponent(input));
});

test("CPU 행동은 플레이어가 제출할 현재 행동 없이 배틀 상태와 시드로 결정한다", () => {
  const input = {
    seed: "fixed-seed",
    battleId: "rtb_test",
    round: 1,
    currentHp: { host: 13, guest: 13 },
    participants: { host: { maxHp: 13 }, guest: { maxHp: 13 } },
  };
  expect(selectRealtimeArenaCpuAction(input)).toBe(selectRealtimeArenaCpuAction(input));
  expect(["attack", "guard", "special_attack"]).toContain(selectRealtimeArenaCpuAction(input));
});
