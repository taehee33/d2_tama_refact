import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { recordRuntimeMetric } from "../../utils/runtimeMetrics";

export function extractJogressStatusFromSlotData(slotData = {}) {
  return slotData.jogressStatus && typeof slotData.jogressStatus === "object"
    ? slotData.jogressStatus
    : null;
}

export function resolveNextSlotJogressStatus(prevStatus, slotData = {}) {
  const nextStatus = extractJogressStatusFromSlotData(slotData);

  return JSON.stringify(prevStatus ?? null) === JSON.stringify(nextStatus ?? null)
    ? prevStatus
    : nextStatus;
}

export function useJogressSubscriptions({
  currentUserUid,
  slotId,
  myJogressRoomId,
  setMyJogressRoomId,
  slotJogressStatus,
  setSlotJogressStatus,
  applyHostJogressStatusFromRoom,
}) {
  useEffect(() => {
    if (!db || !currentUserUid || slotId == null) {
      setSlotJogressStatus(null);
      return;
    }

    const slotRef = doc(db, "users", currentUserUid, "slots", `slot${slotId}`);
    const unsubscribe = onSnapshot(
      slotRef,
      (snapshot) => {
        const slotData = snapshot.data() || {};
        const nextStatus = extractJogressStatusFromSlotData(slotData);

        recordRuntimeMetric("slot_jogress_snapshot_wakeups", {
          slotId,
          hasStatus: Boolean(nextStatus),
        });

        setSlotJogressStatus((prevStatus) => {
          const resolvedStatus = resolveNextSlotJogressStatus(prevStatus, slotData);

          if (resolvedStatus !== prevStatus) {
            recordRuntimeMetric("slot_jogress_state_updates", {
              slotId,
              hasStatus: Boolean(resolvedStatus),
            });
          }

          return resolvedStatus;
        });
      },
      (error) => {
        console.warn("[Game] slot jogressStatus 구독 오류:", error);
        setSlotJogressStatus(null);
      }
    );

    return () => unsubscribe();
  }, [currentUserUid, setSlotJogressStatus, slotId]);

  useEffect(() => {
    if (!db || !currentUserUid || !myJogressRoomId || !applyHostJogressStatusFromRoom) {
      return;
    }

    const roomRef = doc(db, "jogress_rooms", myJogressRoomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        const roomData = snapshot.data() || {};

        if (roomData.status === "paired") {
          applyHostJogressStatusFromRoom(roomData, myJogressRoomId);
          setMyJogressRoomId(null);
          return;
        }

        if (roomData.status === "cancelled" || roomData.status === "completed") {
          setMyJogressRoomId(null);
        }
      },
      (error) => {
        console.warn("[Game] jogress room 구독 오류:", error);
        setMyJogressRoomId(null);
      }
    );

    return () => unsubscribe();
  }, [
    applyHostJogressStatusFromRoom,
    currentUserUid,
    myJogressRoomId,
    setMyJogressRoomId,
  ]);

  useEffect(() => {
    if (!db || !currentUserUid || !slotId || !applyHostJogressStatusFromRoom) {
      return;
    }

    const roomIdToSubscribe =
      slotJogressStatus?.roomId && !slotJogressStatus?.canEvolve
        ? slotJogressStatus.roomId
        : null;

    if (!roomIdToSubscribe) {
      return;
    }

    const roomRef = doc(db, "jogress_rooms", roomIdToSubscribe);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        const roomData = snapshot.data() || {};

        if (roomData.status === "paired" && roomData.hostUid === currentUserUid) {
          applyHostJogressStatusFromRoom(roomData, roomIdToSubscribe);
        }
      },
      (error) => {
        console.warn("[Game] slot jogress room 구독 오류:", error);
      }
    );

    return () => unsubscribe();
  }, [
    applyHostJogressStatusFromRoom,
    currentUserUid,
    slotId,
    slotJogressStatus?.canEvolve,
    slotJogressStatus?.roomId,
  ]);
}
