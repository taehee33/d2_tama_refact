export const GAME_STATE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const FEED_SUMMARY_BUCKET_MS = 15 * 60 * 1000;

export function getNextStateSyncAt(baseTime = Date.now()) {
  return Number(baseTime) + GAME_STATE_SYNC_INTERVAL_MS;
}

export function getFeedSummaryBucketEndAt(occurredAt = Date.now()) {
  const time = Number(occurredAt);
  return (Math.floor(time / FEED_SUMMARY_BUCKET_MS) + 1) * FEED_SUMMARY_BUCKET_MS;
}

export function formatSyncCountdown(targetAt, now = Date.now()) {
  if (targetAt == null || !Number.isFinite(Number(targetAt))) return null;
  const remainingSeconds = Math.max(0, Math.ceil((Number(targetAt) - Number(now)) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const relative = minutes > 0 ? `${minutes}분 ${seconds}초 후` : `${seconds}초 후`;
  const absolute = new Date(Number(targetAt)).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${relative} · ${absolute}`;
}
