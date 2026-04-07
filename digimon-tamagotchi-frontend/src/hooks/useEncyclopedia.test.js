const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((_db, ...segments) => ({
  path: segments.join("/"),
}));
const mockGetAchievementsAndMaxSlots = jest.fn();
const mockUpdateAchievementsAndMaxSlots = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
}));

jest.mock("../logic/encyclopediaMaster", () => ({
  getRequiredDigimonIds: jest.fn(() => []),
  isVersionComplete: jest.fn(() => false),
}));

jest.mock("../data/v1/digimons", () => ({
  digimonDataVer1: {},
}));

jest.mock("../data/v2modkor", () => ({
  digimonDataVer2: {},
}));

jest.mock("../utils/userProfileUtils", () => ({
  ACHIEVEMENT_VER1_MASTER: "ver1_master",
  ACHIEVEMENT_VER2_MASTER: "ver2_master",
  getAchievementsAndMaxSlots: (...args) => mockGetAchievementsAndMaxSlots(...args),
  updateAchievementsAndMaxSlots: (...args) => mockUpdateAchievementsAndMaxSlots(...args),
}));

const {
  loadEncyclopedia,
  saveEncyclopedia,
  updateEncyclopedia,
} = require("./useEncyclopedia");

function createSnapshot(data) {
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
  };
}

describe("useEncyclopedia", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockGetAchievementsAndMaxSlots.mockReset();
    mockUpdateAchievementsAndMaxSlots.mockReset();
    mockGetAchievementsAndMaxSlots.mockResolvedValue({ achievements: [], maxSlots: 10 });
  });

  test("새 encyclopedia 버전 문서가 있으면 루트 fallback보다 우선 사용한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot({ Agumon: { isDiscovered: true } }))
      .mockResolvedValueOnce(createSnapshot(null));

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc.mock.calls).toEqual([
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.1"],
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.2"],
    ]);
    expect(result).toEqual({
      "Ver.1": { Agumon: { isDiscovered: true } },
      "Ver.2": {},
    });
  });

  test("새 버전 문서가 없으면 루트 users 문서의 encyclopedia를 fallback으로 읽는다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": { Agumon: { isDiscovered: true } },
            "Ver.2": { Gabumon: { isDiscovered: true } },
          },
        })
      );

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(mockGetDoc).toHaveBeenCalledTimes(3);
    expect(mockDoc.mock.calls[2]).toEqual([{ name: "test-db" }, "users", "tester"]);
    expect(result).toEqual({
      "Ver.1": { Agumon: { isDiscovered: true } },
      "Ver.2": { Gabumon: { isDiscovered: true } },
    });
  });

  test("도감 저장은 버전 문서에만 기록하고 루트 users 문서는 쓰지 않는다", async () => {
    await saveEncyclopedia(
      {
        "Ver.1": { Agumon: { isDiscovered: true } },
        "Ver.2": {},
      },
      { uid: "tester" }
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(
      { name: "test-db" },
      "users",
      "tester",
      "encyclopedia",
      "Ver.1"
    );
    expect(mockSetDoc.mock.calls[0][1]).toEqual({ Agumon: { isDiscovered: true } });
  });

  test("버전별 업데이트는 다른 버전 데이터를 유지한 채 새 구조 문서에 저장한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        createSnapshot({
          Agumon: {
            isDiscovered: true,
            raisedCount: 1,
            bestStats: {},
            history: [],
          },
        })
      )
      .mockResolvedValueOnce(
        createSnapshot({
          Patamon: {
            isDiscovered: true,
            raisedCount: 1,
            bestStats: {},
            history: [],
          },
        })
      );

    await updateEncyclopedia(
      "Gabumon",
      { age: 3, winRate: 50, weight: 10, lifespanSeconds: 120, totalBattles: 2, totalBattlesWon: 1 },
      "discovery",
      { uid: "tester" },
      "Ver.1"
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc.mock.calls).toEqual(
      expect.arrayContaining([
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.1"],
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.2"],
      ])
    );
    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        Agumon: expect.any(Object),
        Gabumon: expect.objectContaining({
          isDiscovered: true,
          raisedCount: 1,
        }),
      })
    );
    expect(mockSetDoc.mock.calls[1][1]).toEqual({
        Patamon: {
          isDiscovered: true,
          raisedCount: 1,
          bestStats: {},
          history: [],
        },
      });
  });
});
