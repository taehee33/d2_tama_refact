import {
  createNewLifeCombatIdentity,
  hasValidCombatIdentity,
} from "../logic/arena/combatIdentity";
import {
  createSlotInstanceIdentity,
  hasValidSlotInstanceIdentity,
} from "./slotInstanceIdentity";

/**
 * 플레이 진입 전에 legacy 슬롯의 슬롯/디지몬 생명 ID를 트랜잭션으로 보강합니다.
 * revision과 게임 상태는 변경하지 않습니다.
 */
export async function ensureSlotPersistenceIdentity({
  db,
  slotRef,
  runTransaction,
  createSlotIdentity = createSlotInstanceIdentity,
  createCombatIdentity = createNewLifeCombatIdentity,
} = {}) {
  if (!db || !slotRef || typeof runTransaction !== "function") {
    throw new TypeError("슬롯 identity backfill에 필요한 Firestore 인수가 없습니다.");
  }

  let generatedSlotIdentity = null;
  let generatedCombatIdentity = null;

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(slotRef);
    if (!snapshot.exists()) {
      const error = new Error("생명 ID를 보강할 슬롯 문서를 찾을 수 없습니다.");
      error.code = "game/slot-not-found";
      throw error;
    }

    const slotData = snapshot.data() || {};
    const patch = {};

    if (!hasValidSlotInstanceIdentity(slotData)) {
      generatedSlotIdentity = generatedSlotIdentity || createSlotIdentity();
      Object.assign(patch, generatedSlotIdentity);
    }

    if (!hasValidCombatIdentity(slotData)) {
      generatedCombatIdentity = generatedCombatIdentity || createCombatIdentity();
      Object.assign(patch, generatedCombatIdentity);
    }

    if (Object.keys(patch).length > 0) {
      transaction.update(slotRef, patch);
    }

    return {
      didBackfill: Object.keys(patch).length > 0,
      slotData: { ...slotData, ...patch },
    };
  });
}
