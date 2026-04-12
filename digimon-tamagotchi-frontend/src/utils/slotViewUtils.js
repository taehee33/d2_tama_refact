import { translateStage } from "./stageTranslator";
import { getDigimonDataMapByVersion } from "./digimonVersionUtils";

export function getSlotDigimonData(slot) {
  if (!slot) {
    return null;
  }

  const digimonMap = getDigimonDataMapByVersion(slot.version);
  return digimonMap[slot.selectedDigimon] || null;
}

export function getSlotDisplayName(slot) {
  const slotDigimonData = getSlotDigimonData(slot);
  const baseName = slotDigimonData?.name || slot?.selectedDigimon || "디지몬";

  if (slot?.digimonNickname?.trim()) {
    return `${slot.digimonNickname}(${baseName})`;
  }

  return baseName;
}

export function getSlotStageLabel(slot) {
  return translateStage(getSlotDigimonData(slot)?.stage);
}

export function getSlotSpriteSrc(slot) {
  const slotDigimonData = getSlotDigimonData(slot);
  const spriteBasePath = slotDigimonData?.spriteBasePath || "/images";
  const spriteNumber = slotDigimonData?.sprite ?? 0;
  return `${spriteBasePath}/${spriteNumber}.png`;
}
