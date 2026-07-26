export const GAME_SAVE_RECEIPT_STATUS = {
  SYNCED: "synced",
  QUEUED: "queued",
  CONFLICT: "conflict",
  BLOCKED: "blocked",
  FAILED: "failed",
};

export const GAME_SAVE_LOCAL_CLEANUP = {
  COMPLETE: "complete",
  FAILED: "failed",
  NOT_NEEDED: "not-needed",
};

export const GAME_SAVE_BLOCKED_REASON = {
  USER_CHANGED: "user-changed",
  SLOT_CHANGED: "slot-changed",
  GENERATION_CHANGED: "generation-changed",
  AUTH_UNAVAILABLE: "auth-unavailable",
};

export function normalizeGameSaveErrorCode(error) {
  const code = String(error?.code || "").trim();
  return code || "UNKNOWN";
}

export function createGameSaveReceipt({
  status,
  commandId = null,
  mutationId = null,
  blockedReason = null,
  localCleanup = GAME_SAVE_LOCAL_CLEANUP.NOT_NEEDED,
  errorCode = null,
} = {}) {
  return {
    status,
    commandId,
    mutationId,
    blockedReason,
    localCleanup,
    errorCode,
  };
}

export function resolveGameplayWriteBlockedReason({
  currentUid,
  currentSlotId,
  currentGeneration,
  saveContext,
  isFirebaseAvailable = true,
} = {}) {
  if (!isFirebaseAvailable || !currentUid) {
    return GAME_SAVE_BLOCKED_REASON.AUTH_UNAVAILABLE;
  }
  if (saveContext?.uid != null && saveContext.uid !== currentUid) {
    return GAME_SAVE_BLOCKED_REASON.USER_CHANGED;
  }
  if (
    saveContext?.slotId != null &&
    String(saveContext.slotId) !== String(currentSlotId)
  ) {
    return GAME_SAVE_BLOCKED_REASON.SLOT_CHANGED;
  }
  if (
    saveContext?.generation != null &&
    saveContext.generation !== currentGeneration
  ) {
    return GAME_SAVE_BLOCKED_REASON.GENERATION_CHANGED;
  }
  return GAME_SAVE_BLOCKED_REASON.GENERATION_CHANGED;
}
