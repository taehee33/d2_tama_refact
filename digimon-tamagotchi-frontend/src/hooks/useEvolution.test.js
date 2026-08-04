import { act, renderHook } from "@testing-library/react";
import { persistJogressLogWithArchive, useEvolution } from "./useEvolution";
import { getDigimonDataMapByVersion } from "../utils/digimonVersionUtils";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockLimit = jest.fn();
const mockIncrement = jest.fn();
const mockQuery = jest.fn();
const mockServerTimestamp = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
const mockWriteBatch = jest.fn();
const mockGetJogressResult = jest.fn();
const mockResolveOnlineJogressPair = jest.fn();
const mockSanitizeDigimonStatsForSlotDocument = jest.fn();
const mockUpdateEncyclopedia = jest.fn();
const mockArchiveJogressLog = jest.fn();
const mockCreateLogArchiveId = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockJoinJogressRoomApi = jest.fn();
const mockCompleteJogressRoomApi = jest.fn();

jest.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  limit: (...args) => mockLimit(...args),
  increment: (...args) => mockIncrement(...args),
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
  resolveOnlineJogressPair: (...args) => mockResolveOnlineJogressPair(...args),
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

jest.mock("../utils/jogressApi", () => ({
  JogressApiError: class JogressApiError extends Error {},
  joinJogressRoomApi: (...args) => mockJoinJogressRoomApi(...args),
  completeJogressRoomApi: (...args) => mockCompleteJogressRoomApi(...args),
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
      refreshGameRevision: jest.fn().mockResolvedValue(1),
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
    mockIncrement.mockReturnValue("REVISION_INCREMENT");
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });
    mockBatchCommit.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetJogressResult.mockReturnValue({ success: true, targetId: "Omegamon" });
    const onlineMap = createDigimonMap();
    mockResolveOnlineJogressPair.mockReturnValue({
      success: true,
      hostVersion: "Ver.1",
      guestVersion: "Ver.1",
      hostMap: onlineMap,
      guestMap: onlineMap,
      hostSourceId: "Agumon",
      guestSourceId: "Betamon",
      hostTargetId: "Omegamon",
      guestTargetId: "Omegamon",
      hostTargetEntry: onlineMap.Omegamon,
      guestTargetEntry: onlineMap.Omegamon,
    });
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
    jest.useRealTimers();
    if (Date.now.mockRestore) {
      Date.now.mockRestore();
    }
    alertSpy.mockRestore();
  });

  test("개발자 모드 조건 무시 진화도 애니메이션을 거친 뒤 저장한다", async () => {
    jest.useFakeTimers();
    const digimonMap = createDigimonMap();
    digimonMap.Agumon = {
      ...digimonMap.Agumon,
      evolutions: [{ targetId: "Betamon", jogress: false }],
    };
    const params = createParams({
      developerMode: true,
      ignoreEvolutionTime: true,
      digimonDataVer1: digimonMap,
      newDigimonDataVer1: digimonMap,
      evolutionDataVer1: digimonMap,
    });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedEvolution();
    });

    expect(params.setEvolvedDigimonName).toHaveBeenCalledWith("베타몬");
    expect(params.setIsEvolving).toHaveBeenCalledWith(true);
    expect(params.setEvolutionStage).toHaveBeenCalledWith("shaking");
    expect(params.setSelectedDigimonAndSave).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(params.setEvolutionStage).toHaveBeenCalledWith("flashing");
    expect(params.setSelectedDigimonAndSave).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(params.setEvolutionStage).toHaveBeenCalledWith("revealing");
    expect(params.setSelectedDigimonAndSave).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(params.setSelectedDigimonAndSave).toHaveBeenCalledWith("Betamon");
    expect(params.setEvolutionStage).toHaveBeenCalledWith("revealed");
    expect(params.setIsEvolving).not.toHaveBeenLastCalledWith(false);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(params.setEvolutionStage).toHaveBeenLastCalledWith("complete");
    const appendedEvolutionLog = params.appendLogToSubcollection.mock.calls[0][0];
    const savedEvolutionLog = params.setDigimonStatsAndSave.mock.calls[0][1].slice(-1)[0];
    expect(appendedEvolutionLog.type).toBe("EVOLUTION");
    expect(appendedEvolutionLog.transitionId).toMatch(
      /^evolution:\d+:Agumon:Betamon:/
    );
    expect(appendedEvolutionLog.eventId).toBe(
      `activity:evolution:${appendedEvolutionLog.transitionId}`
    );
    expect(savedEvolutionLog.transitionId).toBe(appendedEvolutionLog.transitionId);
    expect(savedEvolutionLog.eventId).toBe(appendedEvolutionLog.eventId);
    expect(params.setIsEvolving).toHaveBeenLastCalledWith(false);
  });

  test("개발자 전체 조건 무시에서는 선택한 일반 진화 후보로 진행한다", async () => {
    jest.useFakeTimers();
    const digimonMap = createDigimonMap();
    digimonMap.Agumon = {
      ...digimonMap.Agumon,
      evolutions: [
        { targetId: "Betamon", jogress: false },
        { targetId: "Omegamon", jogress: false },
        { targetId: "JogressOnly", jogress: true },
      ],
    };
    const params = createParams({
      developerMode: true,
      ignoreEvolutionTime: true,
      digimonDataVer1: digimonMap,
      newDigimonDataVer1: digimonMap,
      evolutionDataVer1: digimonMap,
    });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedEvolution("Omegamon");
    });

    expect(params.setEvolvedDigimonName).toHaveBeenCalledWith("오메가몬");
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("개발자 모드가 OFF면 남아 있는 조건 무시 값으로 선택 진화를 실행하지 않는다", async () => {
    const digimonMap = createDigimonMap();
    digimonMap.Agumon = {
      ...digimonMap.Agumon,
      evolutions: [{ targetId: "Betamon", jogress: false }],
    };
    const params = createParams({
      developerMode: false,
      ignoreEvolutionTime: true,
      digimonDataVer1: digimonMap,
      newDigimonDataVer1: digimonMap,
      evolutionDataVer1: digimonMap,
    });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedEvolution("Betamon");
    });

    expect(params.setEvolvedDigimonName).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
  });

  test("proceedEvolution은 진화 플로우 진행 중 중복 실행되지 않는다", async () => {
    jest.useFakeTimers();
    const digimonMap = createDigimonMap();
    digimonMap.Agumon = {
      ...digimonMap.Agumon,
      evolutions: [{ targetId: "Betamon", jogress: false }],
    };
    const params = createParams({
      developerMode: true,
      ignoreEvolutionTime: true,
      digimonDataVer1: digimonMap,
      newDigimonDataVer1: digimonMap,
      evolutionDataVer1: digimonMap,
    });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      const first = result.current.proceedEvolution();
      const second = result.current.proceedEvolution();
      await Promise.all([first, second]);
    });

    expect(params.applyLazyUpdateBeforeAction).toHaveBeenCalledTimes(1);
    expect(params.setIsEvolving).toHaveBeenCalledTimes(1);
    expect(params.setEvolutionStage).toHaveBeenCalledWith("shaking");

    await act(async () => {
      jest.advanceTimersByTime(4500);
      await Promise.resolve();
    });

    expect(params.setDigimonStatsAndSave).toHaveBeenCalledTimes(1);
    expect(params.setSelectedDigimonAndSave).toHaveBeenCalledTimes(1);
    expect(params.setIsEvolving).not.toHaveBeenLastCalledWith(false);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(params.setIsEvolving).toHaveBeenLastCalledWith(false);
  });

  test("evolve 직접 호출은 저장 중 중복 실행되지 않고 완료 후 guard를 해제한다", async () => {
    let resolveSave;
    let saveCallCount = 0;
    const params = createParams({
      setDigimonStatsAndSave: jest.fn(() => {
        saveCallCount += 1;
        if (saveCallCount === 1) {
          return new Promise((resolve) => {
            resolveSave = resolve;
          });
        }
        return Promise.resolve();
      }),
    });
    const { result } = renderHook(() => useEvolution(params));

    const first = result.current.evolve("Betamon");
    await Promise.resolve();
    await Promise.resolve();

    await act(async () => {
      await result.current.evolve("Betamon");
    });

    expect(params.setDigimonStatsAndSave).toHaveBeenCalledTimes(1);
    expect(params.setSelectedDigimonAndSave).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave();
      await first;
    });

    expect(params.setSelectedDigimonAndSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.evolve("Betamon");
    });

    expect(params.setDigimonStatsAndSave).toHaveBeenCalledTimes(2);
  });

  test("proceedJogressLocal은 현재 슬롯만 진화시키고 파트너 슬롯은 사망 상태로 보존한다", async () => {
    const params = createParams({ slotId: "1" });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedJogressLocal({
        id: 2,
        slotName: "파트너 슬롯",
        selectedDigimon: "Betamon",
        digimonStats: createStats(),
        version: "Ver.2",
      });
    });

    expect(mockBatchUpdate).toHaveBeenNthCalledWith(
      1,
      "users/user-1/slots/slot1",
      expect.objectContaining({
        selectedDigimon: "Omegamon",
        revision: "REVISION_INCREMENT",
        combatRevision: "REVISION_INCREMENT",
      })
    );
    expect(mockBatchUpdate).toHaveBeenNthCalledWith(
      2,
      "users/user-1/slots/slot2",
      expect.objectContaining({
        digimonStats: expect.objectContaining({
          persistedDigimon: undefined,
        }),
        revision: "REVISION_INCREMENT",
      })
    );
    const partnerUpdate = mockBatchUpdate.mock.calls[1][1];
    expect(partnerUpdate).not.toHaveProperty("selectedDigimon");
    expect(mockSanitizeDigimonStatsForSlotDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        isDead: true,
        deathReason: "JOGRESS_PARTNER (조그레스 파트너)",
      })
    );
  });

  test("온라인 참가와 완료는 서버 API outcome으로 현재 슬롯을 재동기화한다", async () => {
    const params = createParams({
      currentUser: { uid: "user-1" },
      slotId: 2,
      refreshGameRevision: jest.fn().mockResolvedValue(4),
      flushOutbox: jest.fn().mockResolvedValue(true),
    });
    const guestOutcome = { selectedDigimon: "Omegamon", resultName: "오메가몬", digimonStats: { isDead: false } };
    mockJoinJogressRoomApi.mockResolvedValue({ room: { id: "room-api", status: "paired" }, slotOutcome: guestOutcome });
    mockCompleteJogressRoomApi.mockResolvedValue({ room: { id: "room-api", status: "completed" }, slotOutcome: guestOutcome });
    const { result } = renderHook(() => useEvolution(params));

    await act(async () => {
      await result.current.proceedJogressOnlineAsGuest(
        { id: "room-api" },
        { id: 2, revision: 4, selectedDigimon: "Betamon", digimonStats: {}, version: "Ver.1" }
      );
    });
    expect(mockJoinJogressRoomApi).toHaveBeenCalledWith(params.currentUser, {
      roomId: "room-api",
      guestSlotId: 2,
      expectedRevision: 4,
    });
    expect(params.setSelectedDigimon).toHaveBeenCalledWith("Omegamon");
    expect(params.setDigimonStats).toHaveBeenCalledWith({ isDead: false });

    await act(async () => {
      await result.current.proceedJogressOnlineAsHostForRoom({ id: "room-api", hostSlotId: 2, hostRevision: 4 });
    });
    expect(mockCompleteJogressRoomApi).toHaveBeenCalledWith(params.currentUser, {
      roomId: "room-api",
      expectedRevision: 4,
    });
  });

});
