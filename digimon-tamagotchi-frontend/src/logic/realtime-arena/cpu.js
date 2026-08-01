import {
  SUPPORTED_DIGIMON_VERSIONS,
  getDigimonDataMapByVersion,
  getSpriteBasePathByVersion,
} from "../../utils/digimonVersionUtils";

const STAGE_ORDER = ["Child", "Adult", "Perfect", "Ultimate", "Super Ultimate"];
const ACTIONS = ["attack", "guard", "special_attack"];

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRatio(value) {
  return stableHash(value) / 0x100000000;
}

export function createRealtimeArenaCpuCandidates(rules) {
  return SUPPORTED_DIGIMON_VERSIONS.flatMap((version) => {
    const spriteBasePath = getSpriteBasePathByVersion(version);
    return Object.values(getDigimonDataMapByVersion(version) || {}).map((digimon) => ({
      version,
      digimonId: digimon.id,
      digimonName: digimon.name || digimon.id,
      stage: digimon.stage,
      attribute: digimon.stats?.type || digimon.attribute || "Free",
      sourcePower: Number(digimon.stats?.basePower || 0),
      maxHp: Number(rules.hpByStage[digimon.stage]),
      baseAttack: Number(rules.baseAttackByStage[digimon.stage]),
      spriteBasePath: digimon.spriteBasePath || spriteBasePath,
      sprite: Number(digimon.sprite || 0),
      attackSprite: Number(digimon.stats?.attackSprite ?? digimon.attackSprite ?? digimon.sprite ?? 0),
    }));
  }).filter((candidate) => (
    rules.eligibleStages.includes(candidate.stage) &&
    Number.isFinite(candidate.sourcePower) &&
    Number.isFinite(candidate.maxHp) &&
    Number.isFinite(candidate.baseAttack)
  ));
}

export function selectRealtimeArenaCpuOpponent({ host, rules, seed, candidates = createRealtimeArenaCpuCandidates(rules) }) {
  const hostStageIndex = STAGE_ORDER.indexOf(host.stage);
  const ranked = [...candidates].sort((left, right) => {
    const powerGap = Math.abs(left.sourcePower - host.sourcePower) - Math.abs(right.sourcePower - host.sourcePower);
    if (powerGap !== 0) return powerGap;
    const stageGap = Math.abs(STAGE_ORDER.indexOf(left.stage) - hostStageIndex) - Math.abs(STAGE_ORDER.indexOf(right.stage) - hostStageIndex);
    if (stageGap !== 0) return stageGap;
    return `${left.version}:${left.digimonId}`.localeCompare(`${right.version}:${right.digimonId}`);
  });
  if (!ranked.length) throw new Error("CPU 배틀에 사용할 디지몬 후보가 없습니다.");
  const shortlist = ranked.slice(0, 5);
  return shortlist[Math.floor(seededRatio(`cpu-opponent:${seed}`) * shortlist.length)];
}

function resolveActionWeights({ currentHp, participants }) {
  const hostRatio = currentHp.host / participants.host.maxHp;
  const cpuRatio = currentHp.guest / participants.guest.maxHp;
  if (hostRatio <= 1 / 3) return [50, 20, 30];
  if (cpuRatio <= 1 / 3) return [30, 50, 20];
  return [40, 30, 30];
}

export function selectRealtimeArenaCpuAction({ seed, battleId, round, currentHp, participants }) {
  const weights = resolveActionWeights({ currentHp, participants });
  const roll = seededRatio(`cpu-action:${seed}:${battleId}:${round}`) * 100;
  let boundary = 0;
  for (let index = 0; index < ACTIONS.length; index += 1) {
    boundary += weights[index];
    if (roll < boundary) return ACTIONS[index];
  }
  return "special_attack";
}

export function selectRealtimeArenaFallbackAction({ seed, battleId, round, role }) {
  const index = Math.floor(seededRatio(`fallback-action:${seed}:${battleId}:${round}:${role}`) * ACTIONS.length);
  return ACTIONS[index] || "special_attack";
}
