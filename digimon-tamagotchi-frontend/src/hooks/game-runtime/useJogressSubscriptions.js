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
  setSlotJogressStatus,
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

}
