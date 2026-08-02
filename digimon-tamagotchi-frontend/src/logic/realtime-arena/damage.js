const ATTRIBUTE_ADVANTAGE = Object.freeze({ Vaccine: "Virus", Virus: "Data", Data: "Vaccine" });

export function getRealtimeArenaAttributeBonus(attackerAttribute, defenderAttribute, rules) {
  if (attackerAttribute === "Free" || defenderAttribute === "Free") return 0;
  return ATTRIBUTE_ADVANTAGE[attackerAttribute] === defenderAttribute
    ? Number(rules.attribute.advantageBonus)
    : 0;
}

export function calculateRealtimeArenaDamage({ attacker, defender, rules }) {
  const baseAttack = Number(rules.baseAttackByStage[attacker.stage]);
  if (!Number.isFinite(baseAttack)) throw new Error("지원하지 않는 디지몬 단계입니다.");
  const positiveGap = Math.max(0, Number(attacker.sourcePower) - Number(defender.sourcePower));
  const powerGapAttack = Math.floor(Math.sqrt(positiveGap / Number(rules.powerGap.unit)));
  const attributeAttack = getRealtimeArenaAttributeBonus(attacker.attribute, defender.attribute, rules);
  const attackPower = baseAttack + powerGapAttack + attributeAttack;
  return { attackPower, powerGapAttack, attributeAttack };
}
