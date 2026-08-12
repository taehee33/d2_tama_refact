import { buildStatsPopupCommandIntent } from "./statsPopupCommands";

export const OPERATOR_EDITABLE_STAT_FIELDS = Object.freeze([
  "fullness",
  "strength",
  "energy",
  "weight",
  "poopCount",
  "careMistakes",
  "trainings",
  "overfeeds",
  "proteinOverdose",
  "injuries",
  "battlesWon",
  "battlesLost",
  "isInjured",
]);

const FIELD_RULES = Object.freeze({
  fullness: { min: 0, max: 5 },
  strength: { min: 0, max: 5 },
  energy: { min: 0, dynamicMax: "maxEnergy" },
  weight: { min: 0 },
  poopCount: { min: 0, max: 8 },
  careMistakes: { min: 0 },
  trainings: { min: 0 },
  overfeeds: { min: 0 },
  proteinOverdose: { min: 0, max: 7 },
  injuries: { min: 0, max: 15 },
  battlesWon: { min: 0 },
  battlesLost: { min: 0 },
  isInjured: { type: "boolean" },
});

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

export function resolveOperatorMaxEnergy(stats = {}, digimonData = null) {
  const speciesStats = digimonData?.stats || digimonData || {};
  const candidates = [
    stats.maxEnergy,
    stats.maxStamina,
    speciesStats.maxEnergy,
    speciesStats.energy,
  ];

  for (const candidate of candidates) {
    const normalized = Number(candidate);
    if (Number.isFinite(normalized) && normalized > 0) {
      return Math.trunc(normalized);
    }
  }
  return 0;
}

export function normalizeOperatorStatValue(field, value, { maxEnergy = 0 } = {}) {
  const rule = FIELD_RULES[field];
  if (!rule) {
    throw new Error(`운영자 수정이 허용되지 않은 스탯입니다: ${field}`);
  }
  if (rule.type === "boolean") {
    return value === true;
  }

  const normalized = toNonNegativeInteger(value);
  const maximum = rule.dynamicMax === "maxEnergy" ? maxEnergy : rule.max;
  if (Number.isFinite(maximum)) {
    return Math.min(normalized, Math.max(rule.min, Math.trunc(maximum)));
  }
  return Math.max(rule.min, normalized);
}

export function buildOperatorStatsDraft(stats = {}, digimonData = null) {
  const maxEnergy = resolveOperatorMaxEnergy(stats, digimonData);
  return OPERATOR_EDITABLE_STAT_FIELDS.reduce((draft, field) => {
    draft[field] = normalizeOperatorStatValue(field, stats?.[field], { maxEnergy });
    return draft;
  }, {});
}

export function normalizeOperatorStatsPatch(patch = {}, stats = {}, digimonData = null) {
  const maxEnergy = resolveOperatorMaxEnergy(stats, digimonData);
  return Object.entries(patch).reduce((normalizedPatch, [field, value]) => {
    normalizedPatch[field] = normalizeOperatorStatValue(field, value, { maxEnergy });
    return normalizedPatch;
  }, {});
}

export function buildChangedOperatorStatsPatch(stats = {}, draft = {}, digimonData = null) {
  const currentDraft = buildOperatorStatsDraft(stats, digimonData);
  const normalizedDraft = normalizeOperatorStatsPatch(draft, stats, digimonData);

  return OPERATOR_EDITABLE_STAT_FIELDS.reduce((patch, field) => {
    if (
      Object.prototype.hasOwnProperty.call(normalizedDraft, field) &&
      !Object.is(currentDraft[field], normalizedDraft[field])
    ) {
      patch[field] = normalizedDraft[field];
    }
    return patch;
  }, {});
}

export async function persistOperatorStatsPatch({
  requestedPatch = {},
  stats = {},
  digimonData = null,
  verifyOperator,
  saveCommand,
} = {}) {
  const latestOperatorStatus = await verifyOperator?.();
  if (!latestOperatorStatus?.isOperator) {
    throw new Error("운영자 권한을 확인할 수 없어 저장하지 않았습니다.");
  }
  if (typeof saveCommand !== "function") {
    throw new Error("스탯 저장 기능을 사용할 수 없습니다.");
  }

  const normalizedPatch = normalizeOperatorStatsPatch(requestedPatch, stats, digimonData);
  const receipts = [];
  for (const [field, value] of Object.entries(normalizedPatch)) {
    const receipt = await saveCommand(buildStatsPopupCommandIntent({ field, value }));
    if (!receipt || !["synced", "queued", "saved", "pending"].includes(receipt.status)) {
      throw new Error("일부 스탯을 저장하지 못했습니다. 현재 값을 확인해 주세요.");
    }
    receipts.push(receipt);
  }
  return receipts;
}
