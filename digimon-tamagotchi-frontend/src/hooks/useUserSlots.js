import { useCallback, useEffect, useMemo, useState } from "react";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";
import { userSlotRepository } from "../repositories/UserSlotRepository";
import { sortSlotsByRecentActivity } from "../utils/slotRecency";
import { getStarterDigimonId } from "../utils/digimonVersionUtils";
import { buildPlayHubProjectedSlot } from "../utils/playHubSlotProjection";
import { toEpochMs } from "../utils/time";
import { createNewLifeCombatIdentity } from "../logic/arena/combatIdentity";
import { createSlotInstanceIdentity } from "../persistence/slotInstanceIdentity";
import { createIndexedDbOutbox } from "../persistence/indexedDbOutbox";
import { clearDeletedSlotOutbox } from "../persistence/slotOutboxLifecycle";
import { buildEvolutionStageInstanceId } from "../logic/stats/careMistakeProjection";
import {
  buildCareMistakeV2Command,
  commitCareMistakeV2ApiCommand,
  deleteCareMistakeV2ApiSlot,
  nativeInitCareMistakeV2ApiSlot,
} from "../persistence/careMistakeV2Api";

function normalizeSlotOrder(slots) {
  const slotsWithoutOrder = slots
    .filter((slot) => slot.displayOrder === undefined)
    .sort((a, b) => {
      const aTime = toEpochMs(a.createdAt) || 0;
      const bTime = toEpochMs(b.createdAt) || 0;
      return bTime - aTime;
    });

  const slotsWithOrder = slots.filter((slot) => slot.displayOrder !== undefined);
  const maxExistingOrder = slotsWithOrder.length > 0
    ? Math.max(...slotsWithOrder.map((slot) => slot.displayOrder))
    : 0;

  slotsWithoutOrder.forEach((slot, index) => {
    slot.displayOrder = maxExistingOrder + index + 1;
  });

  return [...slotsWithOrder, ...slotsWithoutOrder].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
}

function createSlotCommandId(prefix, slotId) {
  const randomId = typeof window !== "undefined" &&
    typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return `${prefix}:slot${slotId}:${randomId}`;
}

/**
 * V1은 기존 클라이언트 삭제를 유지하고 V2만 trusted server 삭제로 보냅니다.
 * 호출자는 이 함수가 성공한 뒤에만 해당 slot instance의 로컬 outbox를 정리해야 합니다.
 */
export async function deleteSlotByCareSchema({
  currentUser,
  slotId,
  slotData,
  deleteV2 = deleteCareMistakeV2ApiSlot,
  deleteLegacy = (uid, id) => userSlotRepository.deleteUserSlot(uid, id),
} = {}) {
  if (slotData?.careMistakeState?.schemaVersion !== 2) {
    await deleteLegacy(currentUser.uid, slotId);
    return { status: "complete", schemaVersion: 1 };
  }

  const result = await deleteV2(currentUser, slotId, {
    slotInstanceId: slotData.slotInstanceId,
    expectedRevision: slotData.revision,
  });
  if (result.status !== "complete") {
    const pendingError = new Error(
      "슬롯 삭제가 진행 중입니다. 잠시 후 다시 시도해 주세요."
    );
    pendingError.code = "SLOT_DELETION_IN_PROGRESS";
    throw pendingError;
  }
  return result;
}

export function useUserSlots({ maxSlots = 10 } = {}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const outbox = useMemo(() => {
    try {
      return createIndexedDbOutbox();
    } catch (_error) {
      return null;
    }
  }, []);

  const loadSlots = useCallback(async () => {
    if (!isFirebaseAvailable || !currentUser) {
      setSlots([]);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      const loadedSlots = await userSlotRepository.getUserSlots(
        currentUser.uid,
        maxSlots
      );

      const normalizedSlots = normalizeSlotOrder(
        loadedSlots.map((slot) =>
          buildPlayHubProjectedSlot({
            ...slot,
            isFrozen: slot.digimonStats?.isFrozen || false,
          })
        )
      );

      setSlots(normalizedSlots);
      return normalizedSlots;
    } catch (loadError) {
      console.error("슬롯 로드 오류:", loadError);
      setError(loadError);
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser, isFirebaseAvailable, maxSlots]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const saveSlotPatch = useCallback(async (slotId, updateData, slotData = null) => {
    const currentSlot = slotData || slots.find((slot) => String(slot.id) === String(slotId));
    if (currentSlot?.careMistakeState?.schemaVersion === 2) {
      return commitCareMistakeV2ApiCommand(
        currentUser,
        slotId,
        buildCareMistakeV2Command({
          commandId: createSlotCommandId("slot-metadata", slotId),
          commandType: "STATE_MUTATION",
          state: currentSlot.careMistakeState,
          expectedRevision: currentSlot.revision,
          payload: { updateData },
        })
      );
    }
    return updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slotId}`), {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  }, [currentUser, slots]);

  const createSlot = useCallback(
    async ({
      device = "Digital Monster Color 25th",
      version = "Ver.1",
    } = {}) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("Firebase 로그인이 필요합니다.");
      }

      const existingSlots = await userSlotRepository.getUserSlots(
        currentUser.uid,
        maxSlots
      );
      const usedSlots = new Set(existingSlots.map((slot) => slot.id));

      let slotId = null;
      for (let index = 1; index <= maxSlots; index += 1) {
        if (!usedSlots.has(index)) {
          slotId = index;
          break;
        }
      }

      if (!slotId) {
        throw new Error("슬롯이 모두 찼습니다.");
      }

      const reorderTargets = normalizeSlotOrder(
        existingSlots.map((slot) => ({
          ...slot,
          displayOrder: slot.displayOrder !== undefined ? slot.displayOrder : slot.id,
        }))
      );

      if (reorderTargets.length > 0) {
        await Promise.all(
          reorderTargets.map((slot) => {
            const nextDisplayOrder = (slot.displayOrder || 0) + 1;
            if (slot.careMistakeState?.schemaVersion === 2) {
              return commitCareMistakeV2ApiCommand(
                currentUser,
                slot.id,
                buildCareMistakeV2Command({
                  commandId: createSlotCommandId("slot-reorder", slot.id),
                  commandType: "STATE_MUTATION",
                  state: slot.careMistakeState,
                  expectedRevision: slot.revision,
                  payload: { updateData: { displayOrder: nextDisplayOrder } },
                })
              );
            }
            return updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slot.id}`), {
              displayOrder: nextDisplayOrder,
              updatedAt: serverTimestamp(),
            });
          })
        );
      }

      const startingDigimon = getStarterDigimonId(version);
      const createdAt = Date.now();
      const slotIdentity = createSlotInstanceIdentity();
      const combatIdentity = createNewLifeCombatIdentity();
      const evolutionStageInstanceId = buildEvolutionStageInstanceId({
        digimonInstanceId: combatIdentity.digimonInstanceId,
        evolutionStageStartedAt: createdAt,
        evolutionStage: startingDigimon,
      });

      await nativeInitCareMistakeV2ApiSlot(currentUser, slotId, {
        commandId: createSlotCommandId("native-init", slotId),
        slotData: {
          ...slotIdentity,
          ...combatIdentity,
          logIdentitySchemaVersion: 1,
          evolutionStageInstanceId,
          selectedDigimon: startingDigimon,
          digimonStats: {},
          slotName: `슬롯${slotId}`,
          digimonNickname: null,
          createdAt,
          device,
          version,
          immersiveSettings: DEFAULT_IMMERSIVE_SETTINGS,
          displayOrder: 1,
          lastSavedAt: createdAt,
        },
      });

      await loadSlots();
      return slotId;
    },
    [currentUser, isFirebaseAvailable, loadSlots, maxSlots]
  );

  const deleteSlot = useCallback(
    async (slotId) => {
      if (!isFirebaseAvailable || !currentUser) {
        throw new Error("로그인이 필요합니다.");
      }

      const deletedSlot = slots.find((slot) => String(slot.id) === String(slotId)) || null;
      await deleteSlotByCareSchema({ currentUser, slotId, slotData: deletedSlot });
      try {
        await clearDeletedSlotOutbox({
          outbox,
          uid: currentUser.uid,
          slotId,
          slotData: deletedSlot,
        });
      } catch (cleanupError) {
        console.warn("삭제된 슬롯의 로컬 outbox 정리에 실패했습니다.", cleanupError);
      }
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, outbox, slots]
  );

  const syncJogressRoomNickname = useCallback(async () => {
    // 방 표시명은 서버 목록 API가 현재 슬롯 정본에서 투영한다.
  }, []);

  const saveNickname = useCallback(
    async (slotId, nextNickname) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("로그인이 필요합니다.");
      }

      const trimmedNickname = typeof nextNickname === "string"
        ? nextNickname.trim()
        : "";

      await saveSlotPatch(slotId, { digimonNickname: trimmedNickname || null });

      await syncJogressRoomNickname(slotId, trimmedNickname || null);
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, saveSlotPatch, syncJogressRoomNickname]
  );

  const resetNickname = useCallback(
    async (slotId) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("로그인이 필요합니다.");
      }

      await saveSlotPatch(slotId, { digimonNickname: null });

      await syncJogressRoomNickname(slotId, null);
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, saveSlotPatch, syncJogressRoomNickname]
  );

  const saveOrder = useCallback(
    async (orderedSlots) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("로그인이 필요합니다.");
      }

      await Promise.all(
        orderedSlots.map((slot, index) =>
          saveSlotPatch(slot.id, { displayOrder: index + 1 }, slot)
        )
      );

      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, saveSlotPatch]
  );

  const recentSlots = useMemo(() => sortSlotsByRecentActivity(slots), [slots]);

  return {
    slots,
    recentSlots,
    loading,
    error,
    reload: loadSlots,
    createSlot,
    deleteSlot,
    saveNickname,
    resetNickname,
    saveOrder,
    canCreateMore: slots.length < maxSlots,
    recentSlot: recentSlots[0] || null,
  };
}

export default useUserSlots;
