import { toEpochMs } from "./time";

function toMillisecondsFromTimestamp(value) {
  return toEpochMs(value) ?? 0;
}

export function getSlotRecentActivityAt(slot = {}) {
  return (
    toMillisecondsFromTimestamp(slot.lastSavedAt) ||
    toMillisecondsFromTimestamp(slot.updatedAt) ||
    toMillisecondsFromTimestamp(slot.createdAt)
  );
}

export function sortSlotsByRecentActivity(slots = []) {
  return [...slots].sort((left, right) => {
    const difference =
      getSlotRecentActivityAt(right) - getSlotRecentActivityAt(left);

    if (difference !== 0) {
      return difference;
    }

    const leftOrder = left.displayOrder ?? left.id ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? right.id ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}
