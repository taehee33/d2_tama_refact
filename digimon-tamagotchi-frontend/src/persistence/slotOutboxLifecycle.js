import { hasValidSlotInstanceIdentity } from "./slotInstanceIdentity";

/**
 * Firestore 슬롯 삭제가 끝난 뒤 해당 슬롯 생애의 로컬 대기 항목만 정리합니다.
 * 정리에 실패해도 새 슬롯은 다른 slotInstanceId를 사용하므로 서로 섞이지 않습니다.
 */
export async function clearDeletedSlotOutbox({
  outbox,
  uid,
  slotId,
  slotData,
} = {}) {
  if (
    !outbox ||
    typeof outbox.clearSlotInstanceScope !== "function" ||
    !uid ||
    slotId == null ||
    !hasValidSlotInstanceIdentity(slotData)
  ) {
    return false;
  }

  await outbox.clearSlotInstanceScope({
    uid,
    slotId,
    slotInstanceId: slotData.slotInstanceId,
  });
  return true;
}
