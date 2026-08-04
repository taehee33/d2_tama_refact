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
        revision: "REVISION_INCREMENT",
      })
    );
    expect(params.refreshGameRevision).not.toHaveBeenCalled();
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
    expect(params.refreshGameRevision).toHaveBeenCalledWith(
      expect.objectContaining({ selectedDigimon: "Omegamon" })
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
        hostDigimonId: "Agumon",
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
        revision: "REVISION_INCREMENT",
      })
    );
    expect(params.refreshGameRevision).toHaveBeenCalledWith(
      expect.objectContaining({ selectedDigimon: "Omegamon" })
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
    expect(params.setEvolutionCompleteIsJogress).toHaveBeenCalledWith(true);
    expect(params.setEvolvedDigimonName).toHaveBeenCalledWith("오메가몬");
    expect(params.setEvolutionStage).toHaveBeenCalledWith("complete");
    expect(params.toggleModal).toHaveBeenCalledWith("jogressRoomList", false);
    expect(alertSpy).toHaveBeenCalledWith(
      "조그레스 진화 완료! 오메가몬(으)로 진화했습니다."
    );
  });

  test.each([
    ["Ver.3", "Chimairamon", "Ver.5", "Mugendramon", "Millenniumon"],
    ["Ver.3", "BanchoLeomon", "Ver.4", "Darkdramon", "Chaosmon"],
    ["Ver.4", "Darkdramon", "Ver.5", "Mugendramon", "Chaosdramon"],
  ])(
    "%s↔%s 온라인 흐름은 게스트 참가 후 호스트 완료까지 양쪽 슬롯을 진화·생존시킨다",
    async (hostVersion, hostDigimonId, guestVersion, guestDigimonId, targetId) => {
      const hostMap = getDigimonDataMapByVersion(hostVersion);
      const guestMap = getDigimonDataMapByVersion(guestVersion);
      const hostAdaptedMap = adaptDataMapToOldFormat(hostMap);
      const guestAdaptedMap = adaptDataMapToOldFormat(guestMap);
      const { resolveOnlineJogressPair } = jest.requireActual(
        "../logic/evolution/jogress"
      );
      const firestoreState = new Map([
        [
          "jogress_rooms/cross-room",
          {
            status: "waiting",
            hostUid: "host-user",
            hostSlotId: 1,
            hostSlotVersion: hostVersion,
            hostDigimonId,
          },
        ],
        [
          "users/guest-user/slots/slot2",
          {
            selectedDigimon: guestDigimonId,
            digimonStats: createStats(),
            version: guestVersion,
          },
        ],
        [
          "users/host-user/slots/slot1",
          {
            selectedDigimon: hostDigimonId,
            digimonStats: createStats(),
            version: hostVersion,
          },
        ],
      ]);
      const applyFirestoreUpdate = (ref, update) => {
        firestoreState.set(ref, {
          ...(firestoreState.get(ref) || {}),
          ...update,
        });
      };
      mockResolveOnlineJogressPair.mockImplementation(resolveOnlineJogressPair);
      mockSanitizeDigimonStatsForSlotDocument.mockImplementation((stats) => stats);
      mockBatchUpdate.mockImplementation(applyFirestoreUpdate);
      mockUpdateDoc.mockImplementation(async (ref, update) => {
        applyFirestoreUpdate(ref, update);
      });
      mockGetDoc.mockImplementation(async (ref) => ({
        exists: () => firestoreState.has(ref),
        data: () => firestoreState.get(ref) || {},
      }));

      const guestParams = createParams({
        currentUser: { uid: "guest-user", displayName: "게스트" },
        slotId: "2",
        selectedDigimon: guestDigimonId,
        version: guestVersion,
        digimonDataVer1: guestMap,
        newDigimonDataVer1: guestMap,
        adaptedDataMapsByVersion: {
          [hostVersion]: hostAdaptedMap,
          [guestVersion]: guestAdaptedMap,
        },
      });
      const { result: guestResult } = renderHook(() => useEvolution(guestParams));
      await act(async () => {
        await guestResult.current.proceedJogressOnlineAsGuest(
          {
            id: "cross-room",
            ...firestoreState.get("jogress_rooms/cross-room"),
          },
          {
            id: 2,
            selectedDigimon: guestDigimonId,
            digimonStats: createStats(),
            version: guestVersion,
          }
        );
      });

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        "jogress_rooms/cross-room",
        expect.objectContaining({
          status: "paired",
          guestSlotVersion: guestVersion,
          targetId,
        })
      );
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        "users/guest-user/slots/slot2",
        expect.objectContaining({
          selectedDigimon: targetId,
          combatRevision: "REVISION_INCREMENT",
        })
      );
      expect(firestoreState.get("jogress_rooms/cross-room")).toEqual(
        expect.objectContaining({
          status: "paired",
          guestSlotVersion: guestVersion,
          targetId,
        })
      );
      expect(firestoreState.get("users/guest-user/slots/slot2")).toEqual(
        expect.objectContaining({ selectedDigimon: targetId })
      );
      expect(
        firestoreState.get("users/guest-user/slots/slot2").digimonStats.isDead
      ).not.toBe(true);
      expect(firestoreState.get("users/host-user/slots/slot1")).toEqual(
        expect.objectContaining({ selectedDigimon: hostDigimonId })
      );

      const hostParams = createParams({
        currentUser: { uid: "host-user", displayName: "호스트" },
        slotId: "1",
        selectedDigimon: hostDigimonId,
        version: hostVersion,
        digimonDataVer1: hostMap,
        newDigimonDataVer1: hostMap,
        adaptedDataMapsByVersion: {
          [hostVersion]: hostAdaptedMap,
          [guestVersion]: guestAdaptedMap,
        },
      });
      const { result: hostResult } = renderHook(() => useEvolution(hostParams));
      await act(async () => {
        await hostResult.current.proceedJogressOnlineAsHostForRoom({
          id: "cross-room",
          ...firestoreState.get("jogress_rooms/cross-room"),
        });
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        "users/host-user/slots/slot1",
        expect.objectContaining({
          selectedDigimon: targetId,
          jogressStatus: {},
          combatRevision: "REVISION_INCREMENT",
        })
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith("jogress_rooms/cross-room", {
        status: "completed",
        completedAt: "SERVER_TS",
        updatedAt: "SERVER_TS",
      });
      expect(firestoreState.get("jogress_rooms/cross-room")).toEqual(
        expect.objectContaining({ status: "completed" })
      );
      expect(firestoreState.get("users/host-user/slots/slot1")).toEqual(
        expect.objectContaining({ selectedDigimon: targetId })
      );
      expect(
        firestoreState.get("users/host-user/slots/slot1").digimonStats.isDead
      ).not.toBe(true);
      expect(
        firestoreState.get("users/guest-user/slots/slot2").digimonStats.isDead
      ).not.toBe(true);
      const transitionInputs = mockSanitizeDigimonStatsForSlotDocument.mock.calls
        .map(([stats]) => stats)
        .filter((stats) => stats?.selectedDigimon === targetId);
      expect(transitionInputs).toHaveLength(2);
      expect(transitionInputs.every((stats) => stats.isDead !== true)).toBe(true);
      expect(transitionInputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            hungerTimer: guestAdaptedMap[targetId].hungerTimer,
            strengthTimer: guestAdaptedMap[targetId].strengthTimer,
            poopTimer: guestAdaptedMap[targetId].poopTimer,
            basePower: guestAdaptedMap[targetId].basePower,
            maxEnergy: guestAdaptedMap[targetId].maxEnergy,
            attackSprite: guestAdaptedMap[targetId].attackSprite,
            spriteBasePath: guestAdaptedMap[targetId].spriteBasePath,
          }),
          expect.objectContaining({
            hungerTimer: hostAdaptedMap[targetId].hungerTimer,
            strengthTimer: hostAdaptedMap[targetId].strengthTimer,
            poopTimer: hostAdaptedMap[targetId].poopTimer,
            basePower: hostAdaptedMap[targetId].basePower,
            maxEnergy: hostAdaptedMap[targetId].maxEnergy,
            attackSprite: hostAdaptedMap[targetId].attackSprite,
            spriteBasePath: hostAdaptedMap[targetId].spriteBasePath,
          }),
        ])
      );
      expect(mockUpdateEncyclopedia).toHaveBeenCalledWith(
        guestDigimonId,
        expect.any(Object),
        "evolution",
        expect.objectContaining({ uid: "guest-user" }),
        guestVersion
      );
      expect(mockUpdateEncyclopedia).toHaveBeenCalledWith(
        hostDigimonId,
        expect.any(Object),
        "evolution",
        expect.objectContaining({ uid: "host-user" }),
        hostVersion
      );
    }
  );
});
