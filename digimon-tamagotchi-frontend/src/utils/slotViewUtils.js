import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { translateStage } from "./stageTranslator";

export function getSlotDigimonData(slot) {
  if (!slot) {
    return null;
  }

  const digimonMap = slot.version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
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
