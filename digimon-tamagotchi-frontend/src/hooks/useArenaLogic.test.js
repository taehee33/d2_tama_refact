import { act, renderHook, waitFor } from "@testing-library/react";
import {
  buildArenaBattlePlan,
  buildArenaConfigState,
  useArenaLogic,
} from "./useArenaLogic";

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

function createParams(overrides = {}) {
  return {
    slotId: "slot-1",
    currentSeasonId: 1,
    setCurrentSeasonId: jest.fn(),
    seasonName: "시즌 1",
    setSeasonName: jest.fn(),
    seasonDuration: 3600,
    setSeasonDuration: jest.fn(),
    setArenaChallenger: jest.fn(),
    setArenaEnemyId: jest.fn(),
    setMyArenaEntryId: jest.fn(),
    toggleModal: jest.fn(),
    setBattleType: jest.fn(),
    setCurrentQuestArea: jest.fn(),
    setCurrentQuestRound: jest.fn(),
    ...overrides,
  };
}

describe("buildArenaConfigState", () => {
  test("truthy 값만 arena config patch로 만든다", () => {
    expect(
      buildArenaConfigState({
        currentSeasonId: 2,
        seasonName: "봄 시즌",
        seasonDuration: 0,
      })
    ).toEqual({
      currentSeasonId: 2,
      seasonName: "봄 시즌",
    });
  });
});

describe("buildArenaBattlePlan", () => {
  test("도전자 id가 있으면 아레나 배틀 plan을 반환한다", () => {
    expect(
      buildArenaBattlePlan({
        challenger: { id: "enemy-1", name: "상대" },
        myEntryId: "entry-7",
      })
    ).toEqual({
      challenger: { id: "enemy-1", name: "상대" },
      enemyId: "enemy-1",
      myArenaEntryId: "entry-7",
      battleType: "arena",
      currentQuestArea: null,
      currentQuestRound: 0,
      modalUpdates: [
        { name: "battleScreen", isOpen: true },
        { name: "arenaScreen", isOpen: false },
      ],
    });
  });

  test("도전자 id가 없으면 null을 반환한다", () => {
    expect(
      buildArenaBattlePlan({
        challenger: { name: "상대" },
      })
    ).toBeNull();
  });
});

describe("useArenaLogic", () => {
  let alertSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDoc.mockReturnValue("arena-config-ref");
  });

  afterEach(() => {
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("slotId가 있으면 Firestore arena config를 읽어 setter에 반영한다", async () => {
    const params = createParams();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        currentSeasonId: 4,
        seasonName: "여름 시즌",
        seasonDuration: 7200,
      }),
    });

    renderHook(() => useArenaLogic(params));

    await waitFor(() => {
      expect(params.setCurrentSeasonId).toHaveBeenCalledWith(4);
    });

    expect(mockDoc).toHaveBeenCalledWith({}, "game_settings", "arena_config");
    expect(params.setSeasonName).toHaveBeenCalledWith("여름 시즌");
    expect(params.setSeasonDuration).toHaveBeenCalledWith(7200);
  });

  test("handleArenaBattleStart는 plan에 맞춰 battle 상태를 연다", () => {
    const params = createParams();
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });
    const { result } = renderHook(() => useArenaLogic(params));

    act(() => {
      result.current.handleArenaBattleStart(
        { id: "enemy-9", name: "메탈그레이몬" },
        "entry-3"
      );
    });

    expect(params.setArenaChallenger).toHaveBeenCalledWith({
      id: "enemy-9",
      name: "메탈그레이몬",
    });
    expect(params.setArenaEnemyId).toHaveBeenCalledWith("enemy-9");
    expect(params.setMyArenaEntryId).toHaveBeenCalledWith("entry-3");
    expect(params.setBattleType).toHaveBeenCalledWith("arena");
    expect(params.setCurrentQuestArea).toHaveBeenCalledWith(null);
    expect(params.setCurrentQuestRound).toHaveBeenCalledWith(0);
    expect(params.toggleModal).toHaveBeenNthCalledWith(1, "battleScreen", true);
    expect(params.toggleModal).toHaveBeenNthCalledWith(2, "arenaScreen", false);
  });

  test("handleArenaBattleStart는 challenger id가 없으면 경고 후 중단한다", () => {
    const params = createParams();
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });
    const { result } = renderHook(() => useArenaLogic(params));

    act(() => {
      result.current.handleArenaBattleStart({ name: "문제 상대" });
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "배틀을 시작할 수 없습니다. Challenger 데이터에 문제가 있습니다."
    );
    expect(params.setArenaChallenger).not.toHaveBeenCalled();
    expect(params.toggleModal).not.toHaveBeenCalled();
  });

  test("handleAdminConfigUpdated는 전달된 설정만 반영한다", () => {
    const params = createParams();
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });
    const { result } = renderHook(() => useArenaLogic(params));

    act(() => {
      result.current.handleAdminConfigUpdated({
        seasonName: "관리자 시즌",
      });
    });

    expect(params.setSeasonName).toHaveBeenCalledWith("관리자 시즌");
    expect(params.setCurrentSeasonId).not.toHaveBeenCalled();
    expect(params.setSeasonDuration).not.toHaveBeenCalled();
  });
});
