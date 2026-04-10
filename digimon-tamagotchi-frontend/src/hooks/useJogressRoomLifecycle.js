import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  getDigimonDataMapByVersion,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";

export function isOnlineJogressSupported(versionLabel = "Ver.1") {
  const normalizedVersion = normalizeDigimonVersionLabel(versionLabel);
  return normalizedVersion === "Ver.1" || normalizedVersion === "Ver.2";
}

function hasJogressEvolution(dataMap, digimonId) {
  const evolutions = dataMap?.[digimonId]?.evolutions || [];
  return evolutions.some((evolution) => evolution.jogress);
}

export function useJogressRoomLifecycle({
  currentUser,
  slotId,
  selectedDigimon,
  version = "Ver.1",
  tamerName,
  digimonNickname,
  slotEvolutionDataMap,
  resolveGuestDigimonName,
}) {
  async function createJogressRoom() {
    if (!currentUser?.uid || !slotId || !db) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }

    if (!isOnlineJogressSupported(version)) {
      alert(
        "Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다. 로컬 조그레스를 이용해 주세요."
      );
      return null;
    }

    if (!hasJogressEvolution(slotEvolutionDataMap, selectedDigimon)) {
      alert("현재 디지몬은 조그레스 진화가 불가능합니다.");
      return null;
    }

    try {
      const hostTamerName = tamerName || currentUser.displayName || null;
      const roomsRef = collection(db, "jogress_rooms");
      const docRef = await addDoc(roomsRef, {
        hostUid: currentUser.uid,
        hostSlotId: slotId,
        hostDigimonId: selectedDigimon,
        hostSlotVersion: version || "Ver.1",
        hostTamerName,
        hostDigimonNickname:
          digimonNickname && digimonNickname.trim()
            ? digimonNickname.trim()
            : null,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await updateDoc(slotRef, {
        jogressStatus: { isWaiting: true, roomId: docRef.id },
        updatedAt: serverTimestamp(),
      });
      return { roomId: docRef.id };
    } catch (err) {
      console.error("[createJogressRoom] 오류:", err);
      alert("방 생성 중 오류가 발생했습니다.");
      return null;
    }
  }

  async function createJogressRoomForSlot(slot) {
    if (!currentUser?.uid || !db || !slot?.id) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }

    const digimonId = slot.selectedDigimon;
    const slotVersion = slot.version || "Ver.1";

    if (!isOnlineJogressSupported(slotVersion)) {
      alert(
        "Ver.3~Ver.5 온라인 조그레스는 아직 준비 중입니다. 로컬 조그레스를 이용해 주세요."
      );
      return null;
    }

    const dataMap = getDigimonDataMapByVersion(slotVersion);
    if (!hasJogressEvolution(dataMap, digimonId)) {
      alert("선택한 디지몬은 조그레스 진화가 불가능합니다.");
      return null;
    }

    try {
      const hostTamerName = tamerName || currentUser.displayName || null;
      const roomsRef = collection(db, "jogress_rooms");
      const docRef = await addDoc(roomsRef, {
        hostUid: currentUser.uid,
        hostSlotId: slot.id,
        hostDigimonId: digimonId,
        hostSlotVersion: slotVersion,
        hostTamerName,
        hostDigimonNickname:
          slot.digimonNickname && slot.digimonNickname.trim()
            ? slot.digimonNickname.trim()
            : null,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slot.id}`);
      await updateDoc(slotRef, {
        jogressStatus: { isWaiting: true, roomId: docRef.id },
        updatedAt: serverTimestamp(),
      });
      return { roomId: docRef.id };
    } catch (err) {
      console.error("[createJogressRoomForSlot] 오류:", err);
      alert("방 생성 중 오류가 발생했습니다.");
      return null;
    }
  }

  async function cancelJogressRoom(roomId) {
    if (!currentUser?.uid || !roomId || !db) {
      return;
    }

    try {
      const roomRef = doc(db, "jogress_rooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const data = roomSnap.exists() ? roomSnap.data() : {};

      if (data.hostUid !== currentUser.uid || data.status !== "waiting") {
        alert("취소할 수 있는 방이 없습니다.");
        return;
      }

      const hostSlotId = data.hostSlotId;
      await updateDoc(roomRef, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });

      if (hostSlotId != null) {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${hostSlotId}`);
        await updateDoc(slotRef, {
          jogressStatus: {},
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("[cancelJogressRoom] 오류:", err);
      alert("방 취소 중 오류가 발생했습니다.");
    }
  }

  async function cancelOwnedWaitingJogressRoomsForSlot(hostSlotId) {
    if (!currentUser?.uid || hostSlotId == null || !db) {
      return 0;
    }

    try {
      const myRoomsRef = collection(db, "jogress_rooms");
      let myRoomsDocs = [];

      try {
        const roomsQuery = query(
          myRoomsRef,
          where("hostUid", "==", currentUser.uid),
          where("status", "==", "waiting")
        );
        const snap = await getDocs(roomsQuery);
        myRoomsDocs = snap.docs;
      } catch (idxErr) {
        const fallbackQuery = query(
          myRoomsRef,
          where("status", "==", "waiting"),
          limit(50)
        );
        const all = await getDocs(fallbackQuery);
        myRoomsDocs = all.docs.filter((roomDoc) => roomDoc.data().hostUid === currentUser.uid);
      }

      const hostSlotIdNum =
        typeof hostSlotId === "number" ? hostSlotId : parseInt(hostSlotId, 10);
      let cancelledCount = 0;

      for (const roomDoc of myRoomsDocs) {
        const roomData = roomDoc.data();
        const matchesSlot =
          roomData.hostSlotId === hostSlotId ||
          (!Number.isNaN(hostSlotIdNum) && roomData.hostSlotId === hostSlotIdNum);

        if (!matchesSlot) {
          continue;
        }

        await cancelJogressRoom(roomDoc.id);
        cancelledCount += 1;
      }

      return cancelledCount;
    } catch (err) {
      console.warn(
        "[cancelOwnedWaitingJogressRoomsForSlot] 내 등록 방 취소 시 오류(무시):",
        err
      );
      return 0;
    }
  }

  async function applyHostJogressStatusFromRoom(roomData, roomId) {
    if (
      !isOnlineJogressSupported(roomData?.hostSlotVersion) ||
      !isOnlineJogressSupported(roomData?.guestSlotVersion)
    ) {
      return;
    }

    if (
      !currentUser?.uid ||
      roomData?.hostUid !== currentUser.uid ||
      roomData?.status !== "paired" ||
      !db
    ) {
      return;
    }

    const hostSlotId = roomData.hostSlotId;
    if (hostSlotId == null) {
      return;
    }

    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${hostSlotId}`);
    const guestDigimonName = resolveGuestDigimonName?.({
      versionLabel: roomData.guestSlotVersion,
      digimonId: roomData.guestDigimonId,
    });

    await updateDoc(slotRef, {
      jogressStatus: {
        canEvolve: true,
        roomId,
        targetId: roomData.targetId,
        partnerUserId: roomData.guestUid || null,
        partnerSlotId: roomData.guestSlotId ?? null,
        guestTamerName: roomData.guestTamerName || null,
        guestDigimonId: roomData.guestDigimonId || null,
        guestDigimonName:
          guestDigimonName || roomData.guestDigimonId || null,
      },
      updatedAt: serverTimestamp(),
    });
  }

  return {
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    cancelOwnedWaitingJogressRoomsForSlot,
    applyHostJogressStatusFromRoom,
  };
}
