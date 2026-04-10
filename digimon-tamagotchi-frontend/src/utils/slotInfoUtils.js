import { formatSlotCreatedAt } from "./dateUtils";
import { getSlotStageLabel } from "./slotViewUtils";

export function getSlotPrimaryInfo(slot) {
  const stageLabel = getSlotStageLabel(slot);
  const deviceLabel = slot?.device || "기종 미설정";
  const versionLabel = slot?.version || "Ver.1";

  return `${stageLabel} · ${deviceLabel} / ${versionLabel}`;
}

export function getSlotSecondaryInfo(slot) {
  const fallbackSlotName = slot?.id != null ? `슬롯${slot.id}` : "슬롯";
  const slotName =
    typeof slot?.slotName === "string" && slot.slotName.trim()
      ? slot.slotName.trim()
      : fallbackSlotName;
  const createdAtLabel = formatSlotCreatedAt(slot?.createdAt);

  return createdAtLabel ? `${slotName} · 생성일 ${createdAtLabel}` : slotName;
}
