import { act, renderHook } from "@testing-library/react";
import { persistJogressLogWithArchive, useEvolution } from "./useEvolution";

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockLimit = jest.fn();
const mockQuery = jest.fn();
const mockServerTimestamp = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
const mockWriteBatch = jest.fn();
const mockGetJogressResult = jest.fn();
const mockSanitizeDigimonStatsForSlotDocument = jest.fn();
const mockUpdateEncyclopedia = jest.fn();
const mockArchiveJogressLog = jest.fn();
const mockCreateLogArchiveId = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  limit: (...args) => mockLimit(...args),
  query: (...args) => mockQuery(...args),
  serverTimestamp: (...args) => mockServerTimestamp(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  where: (...args) => mockWhere(...args),
  writeBatch: (...args) => mockWriteBatch(...args),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("../logic/evolution/jogress", () => ({
  getJogressResult: (...args) => mockGetJogressResult(...args),
}));

jest.mock("./useGameData", () => ({
  sanitizeDigimonStatsForSlotDocument: (...args) =>
    mockSanitizeDigimonStatsForSlotDocument(...args),
}));

jest.mock("./useEncyclopedia", () => ({
  updateEncyclopedia: (...args) => mockUpdateEncyclopedia(...args),
}));

jest.mock("../utils/logArchiveApi", () => ({
  archiveJogressLog: (...args) => mockArchiveJogressLog(...args),
  createLogArchiveId: (...args) => mockCreateLogArchiveId(...args),
}));

describe("persistJogressLogWithArchive", () => {
  const currentUser = { uid: "user-1" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateLogArchiveId.mockReturnValue("jogress_test_1");
  });

  test("조그레스 로그는 Supabase archive에만 저장한다", async () => {
    mockArchiveJogressLog.mockResolvedValue({ id: "jogress_test_1" });

    await persistJogressLogWithArchive({
      currentUser,
      warningLabel: "[test]",
      archivePayload: {
        hostUid: "user-1",
        targetName: "오메가몬",
      },
    });

    expect(mockCreateLogArchiveId).toHaveBeenCalledWith("jogress");
    expect(mockArchiveJogressLog).toHaveBeenCalledWith(currentUser, {
      id: "jogress_test_1",
      hostUid: "user-1",
      targetName: "오메가몬",
    });
  });

  test("archive 저장 실패는 삼키고 게임 흐름을 막지 않는다", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockArchiveJogressLog.mockRejectedValue(new Error("archive failed"));

    await expect(
      persistJogressLogWithArchive({
        currentUser,
        warningLabel: "[test]",
        archivePayload: {
          hostUid: "user-1",
          targetName: "오메가몬",
        },
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("useEvolution jogress flows", () => {
  let alertSpy;

  function createDigimonMap() {
    return {
      Agumon: {
        id: "Agumon",
        name: "아구몬",
        stage: "Child",
        hungerTimer: 10,
        strengthTimer: 10,
        poopTimer: 10,
        stats: {
          minWeight: 5,
          maxEnergy: 10,
        },
        evolutions: [{ targetId: "Omegamon", jogress: true }],
      },
      Betamon: {
        id: "Betamon",
        name: "베타몬",
        stage: "Child",
        hungerTimer: 10,
        strengthTimer: 10,
        poopTimer: 10,
        stats: {
          minWeight: 5,
          maxEnergy: 10,
        },
      },
      Omegamon: {
        id: "Omegamon",
        name: "오메가몬",
        stage: "Perfect",
        sprite: 77,
        hungerTimer: 10,
        strengthTimer: 10,
        poopTimer: 10,
        stats: {
          minWeight: 15,
          maxEnergy: 20,
        },
      },
    };
  }

  function createStats(overrides = {}) {
    return {
      isDead: false,
      age: 5,
      birthTime: 100,
      totalReincarnations: 1,
      careMistakes: 2,
      overfeeds: 1,
      proteinOverdose: 0,
      trainings: 3,
      sleepDisturbances: 0,
      strength: 4,
      effort: 5,
      battles: 6,
      battlesWon: 4,
      battlesLost: 2,
      winRate: 66,
      activityLogs: [{ type: "START", text: "start", timestamp: 1 }],
      ...overrides,
    };
  }

  function createParams(overrides = {}) {
    const digimonMap = createDigimonMap();
    return {
      digimonStats: createStats(),
      setDigimonStats: jest.fn(),
      setSelectedDigimon: jest.fn(),
      setSelectedDigimonAndSave: jest.fn().mockResolvedValue(undefined),
      setDigimonStatsAndSave: jest.fn().mockResolvedValue(undefined),
      applyLazyUpdateBeforeAction: jest.fn().mockResolvedValue(createStats()),
      setActivityLogs: jest.fn(),
      activityLogs: [{ type: "START", text: "start", timestamp: 1 }],
      appendLogToSubcollection: jest.fn().mockResolvedValue(undefined),
      selectedDigimon: "Agumon",
      developerMode: false,
      ignoreEvolutionTime: false,
      setIsEvolving: jest.fn(),
      setEvolutionStage: jest.fn(),
      setEvolvedDigimonName: jest.fn(),
      setEvolutionCompleteIsJogress: jest.fn(),
      setEvolutionCompleteJogressSummary: jest.fn(),
      digimonDataVer1: digimonMap,
      newDigimonDataVer1: digimonMap,
      evolutionDataVer1: digimonMap,
      digimonDataVer2: {},
      adaptedDataMapsByVersion: {},
      slotId: "1",
      slotName: "내 슬롯",
      tamerName: "내 테이머",
      digimonNickname: "아구",
      currentUser: { uid: "user-1", displayName: "유저원" },
      toggleModal: jest.fn(),
      version: "Ver.1",
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    mockCollection.mockImplementation((_db, ...segments) => segments.join("/"));
    mockDoc.mockImplementation((_db, ...segments) => segments.join("/"));
    mockWhere.mockImplementation((...args) => ({ type: "where", args }));
    mockLimit.mockImplementation((...args) => ({ type: "limit", args }));
    mockQuery.mockImplementation((...args) => ({ type: "query", args }));
    mockServerTimestamp.mockReturnValue("SERVER_TS");
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
    mockBatchCommit.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetJogressResult.mockReturnValue({ success: true, targetId: "Omegamon" });
    mockSanitizeDigimonStatsForSlotDocument.mockImplementation((stats) => ({
      persistedDigimon: stats.selectedDigimon,
      persistedLogs: Array.isArray(stats.activityLogs)
        ? stats.activityLogs.length
        : 0,
    }));
    mockUpdateEncyclopedia.mockResolvedValue(undefined);
    mockArchiveJogressLog.mockResolvedValue({ id: "archive-1" });
    mockCreateLogArchiveId.mockReturnValue("archive-1");

    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Date.now.mockRestore();
    alertSpy.mockRestore();
  });

  test("proceedJogressOnlineAsGuest는 room을 paired로 바꾸고 guest slot을 진화 결과로 저장한다", async () => {
    const params = createParams({ slotId: "99" });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedJogressOnlineAsGuest(
        {
          id: "room-1",
          hostSlotVersion: "Ver.1",
          hostDigimonId: "Agumon",
        },
        {
          id: 2,
          selectedDigimon: "Betamon",
          digimonStats: createStats(),
          digimonNickname: "베타",
          version: "Ver.1",
        }
      );
    });

    expect(mockBatchUpdate).toHaveBeenNthCalledWith(
      1,
      "jogress_rooms/room-1",
      expect.objectContaining({
        status: "paired",
        guestUid: "user-1",
        guestSlotId: 2,
        guestDigimonId: "Betamon",
        guestSlotVersion: "Ver.1",
        targetId: "Omegamon",
        updatedAt: "SERVER_TS",
      })
    );
    expect(mockBatchUpdate).toHaveBeenNthCalledWith(
      2,
      "users/user-1/slots/slot2",
      expect.objectContaining({
        selectedDigimon: "Omegamon",
        digimonStats: {
          persistedDigimon: "Omegamon",
          persistedLogs: 2,
        },
        lastSavedAt: 1700000000000,
        lastSavedAtServer: "SERVER_TS",
        updatedAt: "SERVER_TS",
      })
    );
    expect(params.setDigimonStatsAndSave).not.toHaveBeenCalled();
    expect(params.setSelectedDigimonAndSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "조그레스 진화 완료! 오메가몬(으)로 진화했습니다."
    );
  });

  test("proceedJogressOnlineAsGuest는 현재 슬롯이면 로컬 저장을 맞추고 내 waiting room을 정리한다", async () => {
    const params = createParams({ slotId: "2" });

    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "room-wait", data: () => ({ hostUid: "user-1", hostSlotId: 2 }) },
        { id: "room-other", data: () => ({ hostUid: "user-1", hostSlotId: 3 }) },
      ],
    });
    mockGetDoc.mockImplementation((ref) => {
      if (ref === "jogress_rooms/room-wait") {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            hostUid: "user-1",
            status: "waiting",
            hostSlotId: 2,
          }),
        });
      }

      return Promise.resolve({
        exists: () => false,
        data: () => ({}),
      });
    });

    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedJogressOnlineAsGuest(
        {
          id: "room-2",
          hostSlotVersion: "Ver.1",
          hostDigimonId: "Agumon",
        },
        {
          id: 2,
          selectedDigimon: "Betamon",
          digimonStats: createStats(),
          version: "Ver.1",
        }
      );
    });

    expect(params.setDigimonStatsAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDigimon: "Omegamon",
      }),
      expect.arrayContaining([
        expect.objectContaining({
          type: "EVOLUTION",
        }),
      ])
    );
    expect(params.setSelectedDigimonAndSave).toHaveBeenCalledWith("Omegamon");
    expect(mockUpdateDoc).toHaveBeenCalledWith("jogress_rooms/room-wait", {
      status: "cancelled",
      updatedAt: "SERVER_TS",
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith("users/user-1/slots/slot2", {
      jogressStatus: {},
      updatedAt: "SERVER_TS",
    });
  });

  test("proceedJogressOnlineAsHostForRoom는 completed 전이와 현재 슬롯 동기화를 함께 처리한다", async () => {
    const params = createParams({ slotId: "7" });

    mockGetDoc.mockImplementation((ref) => {
      if (ref === "users/user-1/slots/slot7") {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            selectedDigimon: "Agumon",
            digimonStats: createStats(),
          }),
        });
      }

      return Promise.resolve({
        exists: () => false,
        data: () => ({}),
      });
    });

    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedJogressOnlineAsHostForRoom({
        id: "room-3",
        status: "paired",
        hostSlotId: 7,
        hostSlotVersion: "Ver.1",
        guestUid: "user-2",
        guestTamerName: "게스트",
        guestSlotId: 3,
        guestSlotVersion: "Ver.1",
        guestDigimonId: "Betamon",
        targetId: "Omegamon",
      });
    });

    expect(mockUpdateDoc).toHaveBeenNthCalledWith(
      1,
      "users/user-1/slots/slot7",
      expect.objectContaining({
        selectedDigimon: "Omegamon",
        digimonStats: {
          persistedDigimon: "Omegamon",
          persistedLogs: 2,
        },
        jogressStatus: {},
        lastSavedAt: 1700000000000,
        lastSavedAtServer: "SERVER_TS",
        updatedAt: "SERVER_TS",
      })
    );
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, "jogress_rooms/room-3", {
      status: "completed",
      completedAt: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });
    expect(params.appendLogToSubcollection).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EVOLUTION",
      })
    );
    expect(params.setDigimonStatsAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDigimon: "Omegamon",
      }),
      expect.arrayContaining([
        expect.objectContaining({
          type: "EVOLUTION",
        }),
      ])
    );
    expect(params.setSelectedDigimonAndSave).toHaveBeenCalledWith("Omegamon");
    expect(mockArchiveJogressLog).toHaveBeenCalledWith(
      params.currentUser,
      expect.objectContaining({
        id: "archive-1",
        targetId: "Omegamon",
        payload: {
          mode: "online-room",
          resultName: "오메가몬",
          roomId: "room-3",
        },
      })
    );
    expect(params.toggleModal).toHaveBeenCalledWith("jogressRoomList", false);
  });
});
