function toMillisecondsFromTimestamp(value) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date ? converted.getTime() : 0;
  }

  if (typeof value?.seconds === "number") {
    const milliseconds = value.seconds * 1000;
    const nanoseconds = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return milliseconds + Math.floor(nanoseconds / 1000000);
  }

  return 0;
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

