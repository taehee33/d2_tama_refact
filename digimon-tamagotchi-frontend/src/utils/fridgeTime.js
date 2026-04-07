export function toTimestamp(value) {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = Number(value.seconds);
    const nanoseconds = value.nanoseconds != null ? Number(value.nanoseconds) : 0;
    return Number.isNaN(seconds) ? null : seconds * 1000 + nanoseconds / 1e6;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function toDurationMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

/**
 * 냉장고 구간을 제외한 경과 시간(ms)
 */
export function getElapsedTimeExcludingFridge(
  startTime,
  endTime = Date.now(),
  frozenAt = null,
  takeOutAt = null,
  extraExcludedMs = 0
) {
  const startMs = toTimestamp(startTime);
  const endMs = toTimestamp(endTime) ?? Date.now();

  if (startMs == null || endMs <= startMs) {
    return 0;
  }

  const extraPausedMs = toDurationMs(extraExcludedMs);

  const frozenMs = toTimestamp(frozenAt);
  if (frozenMs == null) {
    return Math.max(0, (endMs - startMs) - extraPausedMs);
  }

  const takeOutMs = toTimestamp(takeOutAt) ?? endMs;

  if (frozenMs < startMs || frozenMs >= endMs) {
    return endMs - startMs;
  }

  const frozenDuration = Math.max(0, takeOutMs - frozenMs);
  return Math.max(0, (endMs - startMs) - frozenDuration - extraPausedMs);
}
