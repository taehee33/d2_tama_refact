import { getAttributeAdvantage } from "../battle/hitrate";

export const ARENA_BATTLE_RULES_VERSION = "arena-ghost-v1";
const TARGET_HITS = 3;
const MAX_ROUNDS = 100;

function hashSeed(seed) {
  const value = String(seed || "");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function calculateArenaHitRate(attackerPower, defenderPower, attributeBonus = 0) {
  const leftPower = Math.max(0, Number(attackerPower) || 0);
  const rightPower = Math.max(0, Number(defenderPower) || 0);
  const totalPower = leftPower + rightPower;
  const baseRate = totalPower === 0 ? 50 : (leftPower * 100) / totalPower;
  return Math.max(0, Math.min(100, baseRate + attributeBonus));
}

function normalizeParticipant(participant = {}, fallbackName) {
  return {
    name:
      typeof participant.name === "string" && participant.name.trim()
        ? participant.name.trim().slice(0, 80)
        : fallbackName,
    power: Math.max(0, Math.trunc(Number(participant.power) || 0)),
    attribute:
      typeof participant.attribute === "string" ? participant.attribute : "Free",
  };
}

export function calculateArenaBattle({
  seed,
  attacker,
  defender,
  battleRulesVersion = ARENA_BATTLE_RULES_VERSION,
} = {}) {
  if (battleRulesVersion !== ARENA_BATTLE_RULES_VERSION) {
    throw new Error(`지원하지 않는 아레나 배틀 규칙입니다: ${battleRulesVersion}`);
  }
  if (typeof seed !== "string" || !seed.trim()) {
    throw new Error("결정적 아레나 배틀 seed가 필요합니다.");
  }

  const normalizedAttacker = normalizeParticipant(attacker, "공격자");
  const normalizedDefender = normalizeParticipant(defender, "방어자");
  const attackerBonus = getAttributeAdvantage(
    normalizedAttacker.attribute,
    normalizedDefender.attribute
  );
  const defenderBonus = getAttributeAdvantage(
    normalizedDefender.attribute,
    normalizedAttacker.attribute
  );
  const attackerHitRate = calculateArenaHitRate(
    normalizedAttacker.power,
    normalizedDefender.power,
    attackerBonus
  );
  const defenderHitRate = calculateArenaHitRate(
    normalizedDefender.power,
    normalizedAttacker.power,
    defenderBonus
  );
  const random = createSeededRandom(seed);
  const replay = [];
  let attackerHits = 0;
  let defenderHits = 0;
  let round = 0;

  while (attackerHits < TARGET_HITS && defenderHits < TARGET_HITS && round < MAX_ROUNDS) {
    round += 1;
    const attackerRoll = random() * 100;
    const attackerHit = attackerRoll < attackerHitRate;
    if (attackerHit) attackerHits += 1;
    replay.push({
      round,
      actor: "attacker",
      hit: attackerHit,
      roll: Number(attackerRoll.toFixed(2)),
      hitRate: Number(attackerHitRate.toFixed(2)),
      attackerHits,
      defenderHits,
    });
    if (attackerHits >= TARGET_HITS) break;

    const defenderRoll = random() * 100;
    const defenderHit = defenderRoll < defenderHitRate;
    if (defenderHit) defenderHits += 1;
    replay.push({
      round,
      actor: "defender",
      hit: defenderHit,
      roll: Number(defenderRoll.toFixed(2)),
      hitRate: Number(defenderHitRate.toFixed(2)),
      attackerHits,
      defenderHits,
    });
  }

  return {
    battleRulesVersion,
    winner: attackerHits >= TARGET_HITS ? "attacker" : "defender",
    rounds: round,
    attackerHits,
    defenderHits,
    attackerHitRate: Number(attackerHitRate.toFixed(2)),
    defenderHitRate: Number(defenderHitRate.toFixed(2)),
    replay,
  };
}
