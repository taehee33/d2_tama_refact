export const REALTIME_ARENA_ACTIONS = Object.freeze(["attack", "guard", "special_attack"]);

export function isRealtimeArenaAction(value) {
  return REALTIME_ARENA_ACTIONS.includes(value);
}

function outgoingDamage(action, opponentAction, damage) {
  if (action === "no_action" || opponentAction === "no_action") {
    if (action === "attack") return damage.normal;
    if (action === "special_attack") return damage.special;
    return 0;
  }
  if (action === "attack") return opponentAction === "attack" || opponentAction === "special_attack" ? damage.normal : 0;
  if (action === "guard") return 0;
  if (action === "special_attack") {
    if (opponentAction === "attack") return damage.reducedVsAttack;
    if (opponentAction === "guard") return damage.guardPenetration;
    return damage.special;
  }
  throw new Error("허용되지 않은 실시간 아레나 행동입니다.");
}

export function resolveRealtimeArenaActionMatchup({ hostAction, guestAction, hostDamage, guestDamage }) {
  return {
    hostDamageTaken: outgoingDamage(guestAction, hostAction, guestDamage),
    guestDamageTaken: outgoingDamage(hostAction, guestAction, hostDamage),
  };
}
