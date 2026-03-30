/**
 * Firestore Timestamp/Date/string/number를 비교 가능한 epoch ms로 변환합니다.
 * @param {unknown} value
 * @returns {number}
 */
export function toComparableTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value.toMillis === "function") {
    try {
      return value.toMillis();
    } catch (_error) {
      return 0;
    }
  }

  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 슬롯 생성 시각보다 오래된 로그는 제외합니다.
 * 이전 슬롯 문서 삭제 후 서브컬렉션이 남아 있을 때, 새 슬롯에 옛 로그가 섞이는 문제를 막습니다.
 *
 * @template T
 * @param {T[]} entries
 * @param {unknown} slotCreatedAt
 * @returns {T[]}
 */
export function filterEntriesForSlotCreation(entries, slotCreatedAt) {
  const thresholdMs = toComparableTimestampMs(slotCreatedAt);
  if (!thresholdMs) {
    return Array.isArray(entries) ? entries : [];
  }

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const entryTimestampMs = toComparableTimestampMs(entry?.timestamp);
    if (!entryTimestampMs) {
      return true;
    }

    return entryTimestampMs >= thresholdMs;
  });
}
