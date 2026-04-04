import {
  getSlotRecentActivityAt,
  sortSlotsByRecentActivity,
} from "./slotRecency";

describe("slotRecency", () => {
  test("최근성은 lastSavedAt, updatedAt, createdAt 순으로 판정한다", () => {
    expect(
      getSlotRecentActivityAt({
        createdAt: 1000,
        updatedAt: 2000,
        lastSavedAt: 3000,
      })
    ).toBe(3000);

    expect(
      getSlotRecentActivityAt({
        createdAt: 1000,
        updatedAt: 2000,
      })
    ).toBe(2000);

    expect(
      getSlotRecentActivityAt({
        createdAt: 1000,
      })
    ).toBe(1000);
  });

  test("Firestore Timestamp 형태도 밀리초로 변환한다", () => {
    expect(
      getSlotRecentActivityAt({
        updatedAt: {
          seconds: 10,
          nanoseconds: 250000000,
        },
      })
    ).toBe(10250);

    expect(
      getSlotRecentActivityAt({
        lastSavedAt: {
          toDate: () => new Date("2026-04-04T00:00:05.000Z"),
        },
      })
    ).toBe(new Date("2026-04-04T00:00:05.000Z").getTime());
  });

  test("recentSlots는 표시 순서와 무관하게 최근 활동 순으로 정렬한다", () => {
    const sorted = sortSlotsByRecentActivity([
      {
        id: 2,
        displayOrder: 1,
        updatedAt: 1000,
      },
      {
        id: 1,
        displayOrder: 3,
        lastSavedAt: 5000,
      },
      {
        id: 3,
        displayOrder: 2,
        createdAt: 3000,
      },
    ]);

    expect(sorted.map((slot) => slot.id)).toEqual([1, 3, 2]);
  });
});

