const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((_db, ...segments) => ({
  path: segments.join("/"),
}));
const mockCollection = jest.fn((parent, ...segments) => {
  return {
    path:
      parent && typeof parent.path === "string"
        ? [parent.path, ...segments].join("/")
        : segments.join("/"),
  };
});
const mockGetAchievementsAndMaxSlots = jest.fn();
const mockUpdateAchievementsAndMaxSlots = jest.fn();
const mockEnsureUserProfileMirror = jest.fn();
const TEST_DIGIMON_DATA_MAPS = {
  "Ver.1": {
    Digitama: { id: "Digitama", name: "디지타마" },
    Koromon: { id: "Koromon", name: "코로몬" },
    Agumon: { id: "Agumon", name: "아구몬" },
    Patamon: { id: "Patamon", name: "파타몬" },
  },
  "Ver.2": {
    GabumonV2: { id: "GabumonV2", name: "가부몬X" },
  },
  "Ver.3": {
    Poyomon: { id: "Poyomon", name: "뽀요몬" },
    Tokomon: { id: "Tokomon", name: "토코몬" },
    DigitamaV3: { id: "DigitamaV3", name: "디지타마V3" },
  },
  "Ver.4": {
    Yuramon: { id: "Yuramon", name: "유라몬" },
    DigitamaV4: { id: "DigitamaV4", name: "디지타마V4" },
  },
  "Ver.5": {
    Zurumon: { id: "Zurumon", name: "즈루몬" },
    DigitamaV5: { id: "DigitamaV5", name: "디지타마V5" },
  },
};

jest.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
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

jest.mock("../utils/digimonVersionUtils", () => ({
  SUPPORTED_DIGIMON_VERSIONS: ["Ver.1", "Ver.2", "Ver.3", "Ver.4", "Ver.5"],
  getDigimonDataMapByVersion: (version) => TEST_DIGIMON_DATA_MAPS[version] || {},
  getDigimonVersionByDigimonId: (digimonId) => {
    if (["Yuramon", "DigitamaV4"].includes(digimonId)) {
      return "Ver.4";
    }
    if (["Zurumon", "DigitamaV5"].includes(digimonId)) {
      return "Ver.5";
    }
    if (["Poyomon", "Tokomon", "DigitamaV3"].includes(digimonId)) {
      return "Ver.3";
    }
    if (typeof digimonId === "string" && digimonId.endsWith("V2")) {
      return "Ver.2";
    }
    return "Ver.1";
  },
  normalizeDigimonVersionLabel: (version) =>
    ["Ver.1", "Ver.2", "Ver.3", "Ver.4", "Ver.5"].includes(version)
      ? version
      : "Ver.1",
}));

jest.mock("../utils/digimonLogSnapshot", () => ({
  resolveDigimonSnapshotFromToken: (token, ...maps) => {
    const normalizedToken = typeof token === "string" ? token.trim() : "";
    if (!normalizedToken) {
      return { digimonId: null, digimonName: null };
    }

    for (const map of maps) {
      if (!map || typeof map !== "object") {
        continue;
      }

      if (map[normalizedToken]) {
        return {
          digimonId: normalizedToken,
          digimonName: map[normalizedToken]?.name || normalizedToken,
        };
      }

      const matchedEntry = Object.entries(map).find(([, entry]) => {
        return entry && (entry.id === normalizedToken || entry.name === normalizedToken);
      });

      if (matchedEntry) {
        const [key, entry] = matchedEntry;
        return {
          digimonId: entry?.id || key,
          digimonName: entry?.name || normalizedToken,
        };
      }
    }

    return {
      digimonId: null,
      digimonName: normalizedToken,
    };
  },
}));

jest.mock("../utils/userProfileUtils", () => ({
  ACHIEVEMENT_VER1_MASTER: "ver1_master",
  ACHIEVEMENT_VER2_MASTER: "ver2_master",
  getAchievementsAndMaxSlots: (...args) => mockGetAchievementsAndMaxSlots(...args),
  updateAchievementsAndMaxSlots: (...args) => mockUpdateAchievementsAndMaxSlots(...args),
  ensureUserProfileMirror: (...args) => mockEnsureUserProfileMirror(...args),
}));

const {
  addMissingEncyclopediaEntries,
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

function createQuerySnapshot(documents = []) {
  const snapshots = documents.map((entry, index) => {
    const snapshot =
      entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "data")
        ? createSnapshot(entry.data)
        : createSnapshot(entry);

    return {
      ...snapshot,
      id:
        entry && typeof entry === "object" && typeof entry.id === "string"
          ? entry.id
          : `doc${index + 1}`,
    };
  });

  return {
    forEach: (callback) => {
      snapshots.forEach((snapshot) => callback(snapshot));
    },
  };
}

describe("useEncyclopedia", () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockGetAchievementsAndMaxSlots.mockReset();
    mockUpdateAchievementsAndMaxSlots.mockReset();
    mockEnsureUserProfileMirror.mockReset();
    mockGetAchievementsAndMaxSlots.mockResolvedValue({ achievements: [], maxSlots: 10 });
    mockEnsureUserProfileMirror.mockResolvedValue({ achievements: [], maxSlots: 10 });
    mockGetDocs.mockResolvedValue(createQuerySnapshot([]));
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
  });

  test("버전 문서가 있어도 루트 legacy 도감과 병합해서 과거 발견 이력을 유지한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot({ Agumon: { isDiscovered: true } }))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": {
              Patamon: { isDiscovered: true },
            },
            "Ver.2": {
              GabumonV2: { isDiscovered: true },
            },
          },
        })
      );

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(mockGetDoc).toHaveBeenCalledTimes(6);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockDoc.mock.calls.slice(0, 6)).toEqual([
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.1"],
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.2"],
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.3"],
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.4"],
      [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.5"],
      [{ name: "test-db" }, "users", "tester"],
    ]);
    expect(result).toEqual({
      "Ver.1": {
        Patamon: { isDiscovered: true },
        Agumon: { isDiscovered: true },
      },
      "Ver.2": { GabumonV2: { isDiscovered: true } },
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
  });

  test("새 버전 문서가 없으면 루트 users 문서의 encyclopedia를 fallback으로 읽는다", async () => {
    const uid = "tester-root-fallback";

    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": { Agumon: { isDiscovered: true } },
            "Ver.2": { Gabumon: { isDiscovered: true } },
            "Ver.3": { Poyomon: { isDiscovered: true } },
            "Ver.4": { Yuramon: { isDiscovered: true } },
            "Ver.5": { Zurumon: { isDiscovered: true } },
          },
        })
      );

    const result = await loadEncyclopedia({ uid });

    expect(mockGetDoc).toHaveBeenCalledTimes(6);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockDoc.mock.calls[5]).toEqual([{ name: "test-db" }, "users", uid]);
    expect(mockEnsureUserProfileMirror).toHaveBeenCalledWith(uid);
    expect(mockSetDoc).toHaveBeenCalledTimes(6);
    expect(mockSetDoc.mock.calls[0][1]).toEqual({ Agumon: { isDiscovered: true } });
    expect(mockSetDoc.mock.calls[5][1]).toEqual(
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.1": { Agumon: { isDiscovered: true } },
        }),
        encyclopediaStructure: expect.objectContaining({
          storageMode: "version-docs-with-root-mirror",
        }),
      })
    );
    expect(mockSetDoc.mock.calls[5][2]).toEqual({ merge: true });
    expect(result).toEqual({
      "Ver.1": { Agumon: { isDiscovered: true } },
      "Ver.2": { Gabumon: { isDiscovered: true } },
      "Ver.3": { Poyomon: { isDiscovered: true } },
      "Ver.4": { Yuramon: { isDiscovered: true } },
      "Ver.5": { Zurumon: { isDiscovered: true } },
    });
  });

  test("비어 있는 버전 문서가 있어도 루트 도감 발견 이력이 가려지지 않는다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot({}))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": {
              Agumon: { isDiscovered: true, raisedCount: 3 },
            },
          },
        })
      );

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(result).toEqual({
      "Ver.1": {
        Agumon: { isDiscovered: true, raisedCount: 3 },
      },
      "Ver.2": {},
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
  });

  test("legacy 엔트리에 isDiscovered가 없어도 기록 흔적이 있으면 발견 처리한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": {
              Agumon: {
                raisedCount: 2,
                bestStats: {
                  maxAge: 4,
                },
              },
            },
          },
        })
      );

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(result).toEqual({
      "Ver.1": {
        Agumon: {
          isDiscovered: true,
          raisedCount: 2,
          bestStats: {
            maxAge: 4,
          },
        },
      },
      "Ver.2": {},
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
  });

  test("버전 문서 읽기가 일부 실패해도 루트 legacy 도감 fallback으로 계속 복구한다", async () => {
    mockGetDoc
      .mockRejectedValueOnce(new Error("permission-denied"))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": {
              Agumon: { isDiscovered: true, raisedCount: 2 },
            },
          },
        })
      );

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(result).toEqual({
      "Ver.1": {
        Agumon: { isDiscovered: true, raisedCount: 2 },
      },
      "Ver.2": {},
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[loadEncyclopedia] 버전 문서(Ver.1) 로드 실패, legacy fallback 계속 진행:"),
      expect.any(Error)
    );
  });

  test("슬롯 legacy 읽기가 실패해도 루트 users 문서 encyclopedia는 계속 사용한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.1": {
              Agumon: { isDiscovered: true },
            },
          },
        })
      );
    mockGetDocs.mockRejectedValueOnce(new Error("permission-denied"));

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(result).toEqual({
      "Ver.1": {
        Agumon: { isDiscovered: true },
      },
      "Ver.2": {},
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[loadEncyclopedia] 슬롯 legacy 도감 로드 실패:",
      expect.any(Error)
    );
  });

  test("루트와 버전 문서가 모두 비어 있으면 예전 슬롯별 도감을 병합해서 읽는다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null));
    mockGetDocs
      .mockResolvedValueOnce(
        createQuerySnapshot([
          {
            encyclopedia: {
              "Ver.1": {
                Agumon: { isDiscovered: true, raisedCount: 2 },
              },
            },
          },
          {
            encyclopedia: {
              "Ver.1": {
                Patamon: { isDiscovered: true, raisedCount: 1 },
              },
              "Ver.2": {
                GabumonV2: { isDiscovered: true, raisedCount: 4 },
              },
            },
          },
        ])
      )
      .mockResolvedValueOnce(createQuerySnapshot([]))
      .mockResolvedValueOnce(createQuerySnapshot([]))
      .mockResolvedValueOnce(createQuerySnapshot([]))
      .mockResolvedValueOnce(createQuerySnapshot([]));

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(mockCollection).toHaveBeenCalledWith(
      { name: "test-db" },
      "users",
      "tester",
      "slots"
    );
    expect(mockGetDocs).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      "Ver.1": {
        Agumon: { isDiscovered: true, raisedCount: 2 },
        Patamon: { isDiscovered: true, raisedCount: 1 },
      },
      "Ver.2": {
        GabumonV2: { isDiscovered: true, raisedCount: 4 },
      },
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
  });

  test("도감 문서가 비어 있으면 현재 슬롯과 로그 기록으로 발견 이력을 재구성한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null));
    mockGetDocs
      .mockResolvedValueOnce(
        createQuerySnapshot([
          {
            id: "slot1",
            data: {
              version: "Ver.1",
              selectedDigimon: "Agumon",
              digimonStats: {
                activityLogs: [
                  {
                    type: "EVOLUTION",
                    text: "Evolution: Evolved to Koromon!",
                    timestamp: 1000,
                  },
                ],
              },
            },
          },
          {
            id: "slot2",
            data: {
              version: "Ver.4",
              selectedDigimon: "Yuramon",
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        createQuerySnapshot([
          {
            data: {
              type: "EVOLUTION",
              text: "Evolution: Evolved to Poyomon!",
              timestamp: 2000,
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        createQuerySnapshot([
          {
            data: {
              digimonId: "Tokomon",
              digimonName: "토코몬",
              timestamp: 3000,
            },
          },
        ])
      )
      .mockResolvedValueOnce(createQuerySnapshot([]))
      .mockResolvedValueOnce(createQuerySnapshot([]));

    const result = await loadEncyclopedia({ uid: "tester" });

    expect(mockGetDocs).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      "Ver.1": {
        Agumon: expect.objectContaining({ isDiscovered: true }),
        Koromon: expect.objectContaining({ isDiscovered: true }),
      },
      "Ver.2": {},
      "Ver.3": {
        Poyomon: expect.objectContaining({ isDiscovered: true }),
        Tokomon: expect.objectContaining({ isDiscovered: true }),
      },
      "Ver.4": {
        Yuramon: expect.objectContaining({ isDiscovered: true }),
      },
      "Ver.5": {},
    });
  });

  test("도감 저장은 버전 문서와 루트 legacy mirror를 함께 유지한다", async () => {
    await saveEncyclopedia(
      {
        "Ver.1": { Agumon: { isDiscovered: true } },
        "Ver.2": {},
      },
      { uid: "tester" }
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc).toHaveBeenCalledWith(
      { name: "test-db" },
      "users",
      "tester",
      "encyclopedia",
      "Ver.1"
    );
    expect(mockSetDoc.mock.calls[0][1]).toEqual({ Agumon: { isDiscovered: true } });
    expect(mockDoc).toHaveBeenCalledWith({ name: "test-db" }, "users", "tester");
    expect(mockSetDoc.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.1": { Agumon: { isDiscovered: true } },
        }),
        encyclopediaStructure: {
          storageMode: "version-docs-with-root-mirror",
          canonicalCollection: "encyclopedia",
          canonicalDocStrategy: "version",
          rootMirrorEnabled: true,
          phase: "compat",
        },
      })
    );
    expect(mockSetDoc.mock.calls[1][2]).toEqual({ merge: true });
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
      )
      .mockResolvedValueOnce(
        createSnapshot({
          Poyomon: {
            isDiscovered: true,
            raisedCount: 1,
            bestStats: {},
            history: [],
          },
        })
      )
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.4": {
              Yuramon: {
                isDiscovered: true,
                raisedCount: 2,
                bestStats: {},
                history: [],
              },
            },
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

    expect(mockSetDoc).toHaveBeenCalledTimes(5);
    expect(mockDoc.mock.calls).toEqual(
      expect.arrayContaining([
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.1"],
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.2"],
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.3"],
        [{ name: "test-db" }, "users", "tester", "encyclopedia", "Ver.4"],
        [{ name: "test-db" }, "users", "tester"],
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
    expect(mockSetDoc.mock.calls[2][1]).toEqual({
      Poyomon: {
        isDiscovered: true,
        raisedCount: 1,
        bestStats: {},
        history: [],
      },
    });
    expect(mockSetDoc.mock.calls[3][1]).toEqual({
      Yuramon: {
        isDiscovered: true,
        raisedCount: 2,
        bestStats: {},
        history: [],
      },
    });
    expect(mockSetDoc.mock.calls[4][1]).toEqual(
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.1": expect.objectContaining({
            Gabumon: expect.objectContaining({
              isDiscovered: true,
              raisedCount: 1,
            }),
          }),
          "Ver.4": expect.objectContaining({
            Yuramon: expect.any(Object),
          }),
        }),
      })
    );
    expect(mockSetDoc.mock.calls[4][2]).toEqual({ merge: true });
  });

  test("누락 도감 보정은 디지몬 버전에 맞는 문서로 저장한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null));

    const result = await addMissingEncyclopediaEntries({ uid: "tester" }, ["Poyomon"]);

    expect(result).toEqual({
      added: ["Poyomon"],
      skipped: [],
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc).toHaveBeenCalledWith(
      { name: "test-db" },
      "users",
      "tester",
      "encyclopedia",
      "Ver.3"
    );
    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        Poyomon: expect.objectContaining({
          isDiscovered: true,
          raisedCount: 1,
        }),
      })
    );
    expect(mockDoc).toHaveBeenCalledWith({ name: "test-db" }, "users", "tester");
    expect(mockSetDoc.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.3": expect.objectContaining({
            Poyomon: expect.objectContaining({
              isDiscovered: true,
              raisedCount: 1,
            }),
          }),
        }),
      })
    );
    expect(mockSetDoc.mock.calls[1][2]).toEqual({ merge: true });
  });

  test("이미 발견된 디지몬을 다시 반영해도 구조 sync를 위해 저장을 수행한다", async () => {
    mockGetDoc
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          Elecmon: {
            isDiscovered: true,
            raisedCount: 2,
            bestStats: {},
            history: [],
          },
        })
      )
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(createSnapshot(null))
      .mockResolvedValueOnce(
        createSnapshot({
          encyclopedia: {
            "Ver.2": {
              Elecmon: {
                isDiscovered: true,
                raisedCount: 2,
                bestStats: {},
                history: [],
              },
            },
          },
        })
      );

    const result = await addMissingEncyclopediaEntries({ uid: "tester" }, ["Elecmon"], "Ver.2");

    expect(result).toEqual({
      added: [],
      skipped: ["Elecmon"],
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(4);
    const versionDocWrites = mockSetDoc.mock.calls
      .map((call) => call[1])
      .filter((payload) => payload && Object.prototype.hasOwnProperty.call(payload, "Elecmon"));
    const rootMirrorWrites = mockSetDoc.mock.calls
      .map((call) => call[1])
      .filter((payload) => payload && Object.prototype.hasOwnProperty.call(payload, "encyclopedia"));

    expect(versionDocWrites).toEqual([
      expect.objectContaining({
        Elecmon: expect.objectContaining({
          isDiscovered: true,
          raisedCount: 2,
        }),
      }),
      expect.objectContaining({
        Elecmon: expect.objectContaining({
          isDiscovered: true,
          raisedCount: 2,
        }),
      }),
    ]);
    expect(rootMirrorWrites).toEqual([
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.2": expect.objectContaining({
            Elecmon: expect.objectContaining({
              isDiscovered: true,
              raisedCount: 2,
            }),
          }),
        }),
      }),
      expect.objectContaining({
        encyclopedia: expect.objectContaining({
          "Ver.2": expect.objectContaining({
            Elecmon: expect.objectContaining({
              isDiscovered: true,
              raisedCount: 2,
            }),
          }),
        }),
      }),
    ]);
  });
});
