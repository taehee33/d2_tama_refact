import { calculateRealtimeArenaDamage } from "./damage";
import { REALTIME_ARENA_ACTIONS, resolveRealtimeArenaActionMatchup } from "./actionMatchup";
import { determineRealtimeArenaOutcome } from "./outcome";
import { assertRealtimeArenaRules } from "./rulesets";

export function resolveRealtimeArenaRound({ battleState, hostAction, guestAction, rules }) {
  assertRealtimeArenaRules(rules);
  const allowed = [...REALTIME_ARENA_ACTIONS, "no_action"];
  if (!allowed.includes(hostAction) || !allowed.includes(guestAction)) throw new Error("허용되지 않은 행동입니다.");
  const hostDamage = calculateRealtimeArenaDamage({ attacker: battleState.participants.host, defender: battleState.participants.guest, rules });
  const guestDamage = calculateRealtimeArenaDamage({ attacker: battleState.participants.guest, defender: battleState.participants.host, rules });
  const matchup = resolveRealtimeArenaActionMatchup({
    hostAction,
    guestAction,
    hostDamage,
    guestDamage,
    guardRecovery: Number(rules.recovery?.guardVsAttack ?? 1),
  });
  const hostHpTransition = applyHpTransition({
    currentHp: battleState.currentHp.host,
    maxHp: battleState.participants.host.maxHp,
    damageTaken: matchup.hostDamageTaken,
    requestedRecovery: matchup.hostHpRecovered,
  });
  const guestHpTransition = applyHpTransition({
    currentHp: battleState.currentHp.guest,
    maxHp: battleState.participants.guest.maxHp,
    damageTaken: matchup.guestDamageTaken,
    requestedRecovery: matchup.guestHpRecovered,
  });
  const damage = {
    ...matchup,
    hostHpRecovered: hostHpTransition.recovered,
    guestHpRecovered: guestHpTransition.recovered,
  };
  const currentHp = {
    host: hostHpTransition.hp,
    guest: guestHpTransition.hp,
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

function applyHpTransition({ currentHp, maxHp, damageTaken, requestedRecovery }) {
  const afterDamage = Math.max(0, Number(currentHp) - Number(damageTaken));
  const recoveryLimit = Math.max(0, Number(maxHp) - afterDamage);
  const recovered = Math.max(0, Math.min(recoveryLimit, Number(requestedRecovery)));
  return { hp: afterDamage + recovered, recovered };
}
