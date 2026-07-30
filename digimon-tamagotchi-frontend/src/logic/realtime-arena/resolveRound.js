import { calculateRealtimeArenaDamage } from "./damage";
import { resolveRealtimeArenaActionMatchup } from "./actionMatchup";
import { determineRealtimeArenaOutcome } from "./outcome";
import { assertRealtimeArenaRules } from "./rulesets";

export function resolveRealtimeArenaRound({ battleState, hostAction, guestAction, rules }) {
  assertRealtimeArenaRules(rules);
  const allowed = ["attack", "guard", "special_attack", "no_action"];
  if (!allowed.includes(hostAction) || !allowed.includes(guestAction)) throw new Error("허용되지 않은 행동입니다.");
  const hostDamage = calculateRealtimeArenaDamage({ attacker: battleState.participants.host, defender: battleState.participants.guest, rules });
  const guestDamage = calculateRealtimeArenaDamage({ attacker: battleState.participants.guest, defender: battleState.participants.host, rules });
  const damage = resolveRealtimeArenaActionMatchup({ hostAction, guestAction, hostDamage, guestDamage });
  const currentHp = {
    host: Math.max(0, Number(battleState.currentHp.host) - damage.hostDamageTaken),
    guest: Math.max(0, Number(battleState.currentHp.guest) - damage.guestDamageTaken),
  };
  const timeoutSides = [];
  if (hostAction === "no_action") timeoutSides.push("host");
  if (guestAction === "no_action") timeoutSides.push("guest");
  const timeoutStreaks = {
    host: hostAction === "no_action" ? Number(battleState.timeoutStreaks.host || 0) + 1 : 0,
    guest: guestAction === "no_action" ? Number(battleState.timeoutStreaks.guest || 0) + 1 : 0,
  };
  const result = determineRealtimeArenaOutcome({
    currentHp,
    participants: battleState.participants,
    round: battleState.round,
    maxRounds: rules.maxRounds,
    timeoutStreaks,
    timeoutLossCount: rules.timeout.consecutiveLossCount,
  });
  return { ...damage, currentHp, timeoutSides, timeoutStreaks, result };
}
