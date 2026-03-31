import { getSlotDisplayName, getSlotStageLabel } from "./slotViewUtils";

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

const previewStageTranslations = {
  Digitama: "디지타마",
  "Baby I": "유년기 I",
  "Baby II": "유년기 II",
  Baby1: "유년기 I",
  Baby2: "유년기 II",
  Child: "성장기",
  Adult: "성숙기",
  Perfect: "완전체",
  Ultimate: "궁극체",
  "Super Ultimate": "초궁극체",
  SuperUltimate: "초궁극체",
};

function resolvePreviewStageLabel(slot) {
  const rawStage = slot?.digimonStats?.evolutionStage;

  if (rawStage && previewStageTranslations[rawStage]) {
    return previewStageTranslations[rawStage];
  }

  const stageLabel = getSlotStageLabel(slot);

  if (stageLabel && stageLabel !== "Unknown") {
    return stageLabel;
  }

  return "단계 미상";
}

export function buildCommunityPreviewFromSlot(slot) {
  if (!slot) {
    return null;
  }

  const stats = slot.digimonStats || {};
  const totalBattles = normalizeInteger(stats.totalBattles);
  const totalBattlesWon = normalizeInteger(stats.totalBattlesWon);

  return {
    slotId: String(slot.id),
    slotName: slot.slotName || `슬롯${slot.id}`,
    digimonDisplayName: slot.digimonDisplayName || getSlotDisplayName(slot),
    stageLabel: resolvePreviewStageLabel(slot),
    version: slot.version || "Ver.1",
    device: slot.device || "Digital Monster Color 25th",
    weight: normalizeInteger(stats.weight),
    careMistakes: normalizeInteger(stats.careMistakes),
    totalBattles,
    totalBattlesWon,
    winRate: totalBattles > 0 ? Math.round((totalBattlesWon / totalBattles) * 100) : 0,
  };
}
