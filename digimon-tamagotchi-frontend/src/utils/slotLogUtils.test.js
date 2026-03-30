import { filterEntriesForSlotCreation, toComparableTimestampMs } from "./slotLogUtils";

describe("slotLogUtils", () => {
  test("숫자 timestamp를 그대로 비교 값으로 사용한다", () => {
    expect(toComparableTimestampMs(1710000000000)).toBe(1710000000000);
  });

  test("Firestore Timestamp 형태의 toMillis 값을 비교 값으로 변환한다", () => {
    const mockTimestamp = { toMillis: () => 1710000001234 };
    expect(toComparableTimestampMs(mockTimestamp)).toBe(1710000001234);
  });

  test("슬롯 생성 이전 로그는 걸러내고 현재 슬롯 이후 로그만 남긴다", () => {
    const entries = [
      { id: "old", timestamp: 1709999999000 },
      { id: "new", timestamp: 1710000001000 },
      { id: "untimed" },
    ];

    expect(filterEntriesForSlotCreation(entries, 1710000000000)).toEqual([
      { id: "new", timestamp: 1710000001000 },
      { id: "untimed" },
    ]);
  });
});
