const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_db, ...segments) => ({
  path: segments.join("/"),
}));
const mockUpdateDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
}));

const {
  ACHIEVEMENT_VER1_MASTER,
  BASE_MAX_SLOTS,
  computeMaxSlotsFromAchievements,
  ensureUserProfileMirror,
  getAchievementsAndMaxSlots,
  updateAchievementsAndMaxSlots,
} = require("./userProfileUtils");

function createSnapshot(data) {
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
  };
}

describe("userProfileUtils", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockSetDoc.mockReset();
  });

  test("profile/main의 achievements를 우선 사용하고 maxSlots는 achievements 기준으로 계산한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        createSnapshot({
          achievements: [ACHIEVEMENT_VER1_MASTER],
        })
      )
      .mockResolvedValueOnce(
        createSnapshot({
          achievements: [],
          maxSlots: BASE_MAX_SLOTS,
        })
      );

    const result = await getAchievementsAndMaxSlots("tester");

    expect(result).toEqual({
      achievements: [ACHIEVEMENT_VER1_MASTER],
      maxSlots: computeMaxSlotsFromAchievements([ACHIEVEMENT_VER1_MASTER]),
    });
  });

  test("profile/main이 없으면 루트 users 문서를 fallback으로 사용한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          achievements: [ACHIEVEMENT_VER1_MASTER],
          maxSlots: 15,
        })
      );

    const result = await getAchievementsAndMaxSlots("tester");

    expect(result).toEqual({
      achievements: [ACHIEVEMENT_VER1_MASTER],
      maxSlots: 15,
    });
  });

  test("칭호 저장은 루트와 profile/main에 동시에 반영한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot({ displayName: "테스터" }))
      .mockResolvedValueOnce(createSnapshot(null));

    await updateAchievementsAndMaxSlots("tester", [ACHIEVEMENT_VER1_MASTER]);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        achievements: [ACHIEVEMENT_VER1_MASTER],
        maxSlots: computeMaxSlotsFromAchievements([ACHIEVEMENT_VER1_MASTER]),
        updatedAt: expect.any(Date),
      })
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        achievements: [ACHIEVEMENT_VER1_MASTER],
        maxSlots: computeMaxSlotsFromAchievements([ACHIEVEMENT_VER1_MASTER]),
        updatedAt: expect.any(Date),
      })
    );
    expect(mockSetDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  test("ensureUserProfileMirror는 루트 fallback 값을 profile/main에 보정한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        createSnapshot({
          achievements: [ACHIEVEMENT_VER1_MASTER],
          maxSlots: 15,
        })
      )
      .mockResolvedValueOnce(createSnapshot(null));

    const result = await ensureUserProfileMirror("tester");

    expect(result).toEqual({
      achievements: [ACHIEVEMENT_VER1_MASTER],
      maxSlots: 15,
    });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        achievements: [ACHIEVEMENT_VER1_MASTER],
        maxSlots: 15,
        updatedAt: expect.any(Date),
      })
    );
  });
});
