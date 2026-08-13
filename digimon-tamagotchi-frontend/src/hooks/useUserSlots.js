import { useCallback, useEffect, useMemo, useState } from "react";
import {
  doc,
  serverTimestamp,
  setDoc,
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
          reorderTargets.map((slot) =>
            updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slot.id}`), {
              displayOrder: (slot.displayOrder || 0) + 1,
              updatedAt: serverTimestamp(),
            })
          )
        );
      }

      const startingDigimon = getStarterDigimonId(version);
      const createdAt = Date.now();

      await setDoc(doc(db, "users", currentUser.uid, "slots", `slot${slotId}`), {
        ...createSlotInstanceIdentity(),
        ...createNewLifeCombatIdentity(),
        logIdentitySchemaVersion: 1,
        revision: 0,
        selectedDigimon: startingDigimon,
        digimonStats: {},
        slotName: `슬롯${slotId}`,
        digimonNickname: null,
        createdAt,
        createdAtServer: serverTimestamp(),
        device,
        version,
        immersiveSettings: DEFAULT_IMMERSIVE_SETTINGS,
        displayOrder: 1,
        lastSavedAt: createdAt,
        lastSavedAtServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
      await userSlotRepository.deleteUserSlot(currentUser.uid, slotId);
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

      await updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slotId}`), {
        digimonNickname: trimmedNickname || null,
        updatedAt: serverTimestamp(),
      });

      await syncJogressRoomNickname(slotId, trimmedNickname || null);
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, syncJogressRoomNickname]
  );

  const resetNickname = useCallback(
    async (slotId) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("로그인이 필요합니다.");
      }

      await updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slotId}`), {
        digimonNickname: null,
        updatedAt: serverTimestamp(),
      });

      await syncJogressRoomNickname(slotId, null);
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots, syncJogressRoomNickname]
  );

  const saveOrder = useCallback(
    async (orderedSlots) => {
      if (!isFirebaseAvailable || !currentUser || !db) {
        throw new Error("로그인이 필요합니다.");
      }

      await Promise.all(
        orderedSlots.map((slot, index) =>
          updateDoc(doc(db, "users", currentUser.uid, "slots", `slot${slot.id}`), {
            displayOrder: index + 1,
            updatedAt: serverTimestamp(),
          })
        )
      );

      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots]
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
