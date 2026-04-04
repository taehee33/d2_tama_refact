import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { userSlotRepository } from "../repositories/UserSlotRepository";
import { sortSlotsByRecentActivity } from "../utils/slotRecency";

function normalizeSlotOrder(slots) {
  const slotsWithoutOrder = slots
    .filter((slot) => slot.displayOrder === undefined)
    .sort((a, b) => {
      const aTime = typeof a.createdAt === "number" ? a.createdAt : new Date(a.createdAt || 0).getTime();
      const bTime = typeof b.createdAt === "number" ? b.createdAt : new Date(b.createdAt || 0).getTime();
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
        loadedSlots.map((slot) => ({
          ...slot,
          isFrozen: slot.digimonStats?.isFrozen || false,
        }))
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
              updatedAt: new Date(),
            })
          )
        );
      }

      const startingDigimon = version === "Ver.2" ? "DigitamaV2" : "Digitama";
      const createdAt = Date.now();

      await setDoc(doc(db, "users", currentUser.uid, "slots", `slot${slotId}`), {
        selectedDigimon: startingDigimon,
        digimonStats: {},
        slotName: `슬롯${slotId}`,
        digimonNickname: null,
        createdAt,
        device,
        version,
        displayOrder: 1,
        updatedAt: new Date(),
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

      await userSlotRepository.deleteUserSlot(currentUser.uid, slotId);
      await loadSlots();
    },
    [currentUser, isFirebaseAvailable, loadSlots]
  );

  const syncJogressRoomNickname = useCallback(
    async (slotId, digimonNickname) => {
      if (!db || !currentUser) {
        return;
      }

      const roomsRef = collection(db, "jogress_rooms");
      const roomQuery = query(
        roomsRef,
        where("hostUid", "==", currentUser.uid),
        where("hostSlotId", "==", slotId)
      );
      const snapshot = await getDocs(roomQuery);
      const now = new Date();

      await Promise.all(
        snapshot.docs.map((room) =>
          updateDoc(doc(db, "jogress_rooms", room.id), {
            hostDigimonNickname: digimonNickname,
            updatedAt: now,
          })
        )
      );
    },
    [currentUser]
  );

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
        updatedAt: new Date(),
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
        updatedAt: new Date(),
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
            updatedAt: new Date(),
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
