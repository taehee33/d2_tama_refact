export function buildGuestPairingRoomUpdate({
  currentUser,
  tamerName,
  guestSlot,
  guestVersion,
  hostTargetId,
  serverTimestampValue,
}) {
  return {
    status: "paired",
    guestUid: currentUser.uid,
    guestTamerName: tamerName || currentUser?.displayName || null,
    guestSlotId: guestSlot.id,
    guestDigimonId: guestSlot.selectedDigimon,
    guestDigimonNickname:
      guestSlot.digimonNickname && guestSlot.digimonNickname.trim()
        ? guestSlot.digimonNickname.trim()
        : null,
    guestSlotVersion: guestVersion,
    targetId: hostTargetId,
    updatedAt: serverTimestampValue,
  };
}

export function buildCompletedJogressSlotUpdate({
  targetId,
  statsForDb,
  nowMs,
  serverTimestampValue,
  clearJogressStatus = true,
}) {
  return {
    selectedDigimon: targetId,
    digimonStats: statsForDb,
    ...(clearJogressStatus ? { jogressStatus: {} } : {}),
    lastSavedAt: nowMs,
    lastSavedAtServer: serverTimestampValue,
    updatedAt: serverTimestampValue,
  };
}

export function buildCompletedJogressRoomUpdate(serverTimestampValue) {
  return {
    status: "completed",
    completedAt: serverTimestampValue,
    updatedAt: serverTimestampValue,
  };
}

export async function syncCurrentJogressSlot({
  isCurrentSlot,
  targetId,
  nextStatsWithLogs,
  updatedLogs,
  appendLogToSubcollection,
  appendLogWhenCurrent = false,
  syncMode = "save-if-possible",
  setDigimonStatsAndSave,
  setSelectedDigimonAndSave,
  setDigimonStats,
  setSelectedDigimon,
}) {
  if (!isCurrentSlot) {
    return false;
  }

  const latestLog = Array.isArray(updatedLogs)
    ? updatedLogs[updatedLogs.length - 1]
    : null;

  if (appendLogWhenCurrent && appendLogToSubcollection && latestLog) {
    await appendLogToSubcollection(latestLog).catch(() => {});
  }

  if (
    syncMode === "save-if-possible" &&
    typeof setDigimonStatsAndSave === "function" &&
    typeof setSelectedDigimonAndSave === "function"
  ) {
    await setDigimonStatsAndSave(nextStatsWithLogs, updatedLogs).catch(() => {});
    await setSelectedDigimonAndSave(targetId).catch(() => {});
    return true;
  }

  if (typeof setDigimonStats === "function") {
    setDigimonStats(nextStatsWithLogs);
  }
  if (typeof setSelectedDigimon === "function") {
    setSelectedDigimon(targetId);
  }

  return true;
}
