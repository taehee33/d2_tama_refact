export const REALTIME_ARENA_ACTIONS = Object.freeze(["attack", "guard", "special_attack"]);

const ACTION_MATCHUP_RESULTS = Object.freeze({
  attack: Object.freeze({ attack: "hit", guard: "blocked", special_attack: "hit" }),
  guard: Object.freeze({ attack: "guard_success", guard: "none", special_attack: "breached" }),
  special_attack: Object.freeze({ attack: "interrupted", guard: "hit", special_attack: "hit" }),
});

export function isRealtimeArenaAction(value) {
  return REALTIME_ARENA_ACTIONS.includes(value);
}

function getMatchupResult(action, opponentAction) {
  if (action === "no_action") return "none";
  if (opponentAction === "no_action") return ["attack", "special_attack"].includes(action) ? "hit" : "none";
  const result = ACTION_MATCHUP_RESULTS[action]?.[opponentAction];
  if (!result) throw new Error("허용되지 않은 실시간 아레나 행동입니다.");
  return result;
}

/**
 * 공개 라운드 결과가 없는 오래된 배틀 문서에서도 화면 판정을 재생한다.
 * 서버 판정과 같은 표를 사용하므로 표현 계층이 별도 상성을 만들지 않는다.
 */
export function getRealtimeArenaActionMatchupResult(action, opponentAction) {
  return getMatchupResult(action || "no_action", opponentAction || "no_action");
}

function outgoingActionResult(action, opponentAction, attackPower, guardRecovery) {
  const result = getRealtimeArenaActionMatchupResult(action, opponentAction);
  return {
    result,
    damage: result === "hit" ? attackPower : 0,
    recovery: result === "guard_success" ? guardRecovery : 0,
  };
}

export function resolveRealtimeArenaActionMatchup({ hostAction, guestAction, hostDamage, guestDamage, guardRecovery = 1 }) {
  const hostActionResult = outgoingActionResult(hostAction, guestAction, hostDamage.attackPower, guardRecovery);
  const guestActionResult = outgoingActionResult(guestAction, hostAction, guestDamage.attackPower, guardRecovery);
  return {
    hostDamageTaken: guestActionResult.damage,
    guestDamageTaken: hostActionResult.damage,
    hostHpRecovered: hostActionResult.recovery,
    guestHpRecovered: guestActionResult.recovery,
    hostActionResult: hostActionResult.result,
    guestActionResult: guestActionResult.result,
  };
}
