import { act, renderHook } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import { useGameData } from "./useGameData";
import { initializeStats, clearPoopOverflowState, clearActiveInjuryState } from "../data/stats";
import { feedMeat } from "../logic/food/meat";
import { feedProtein } from "../logic/food/protein";

const mockGetLatestStateSnapshot = jest.fn();
jest.mock("../firebase", () => ({ db: "DB" }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  doc: jest.fn(() => "slot"),
  getDoc: jest.fn(),
}));
jest.mock("./game-persistence/useDurableGamePersistence", () => ({
  ...jest.requireActual("./game-persistence/useDurableGamePersistence"),
  useDurableGamePersistence: () => ({
    getLatestStateSnapshot: mockGetLatestStateSnapshot,
    setLoadedRevision: jest.fn(),
    captureSaveContext: jest.fn(() => ({ uid: "user-1", slotId: 1 })),
  }),
}));

const dataMap = { Agumon: { evolutionStage: "Child", hungerTimer: 20, strengthTimer: 20, poopTimer: 20 } };
const now = new Date(2026, 8, 6, 12, 0).getTime();
function setup() {
  const remote = {
    ...initializeStats("Agumon", {}, dataMap), selectedDigimon: "Agumon",
    evolutionStage: "Child", fullness: 1, strength: 1,
    poopCount: 2, isInjured: true, injuredAt: now - 60000,
    lastSavedAt: now - 60000, activityLogs: [],
  };
  // 슬롯 로드 effect는 대기시키고 액션이 읽는 원격 응답은 이전 상태로 고정한다.
  getDoc.mockImplementationOnce(() => new Promise(() => {}));
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ digimonStats: remote, lastSavedAt: remote.lastSavedAt }) });
  let durable = { ...remote, lastSavedAt: now };
  mockGetLatestStateSnapshot.mockImplementation(async () => ({ statsSnapshot: durable }));
  const noop = jest.fn();
  const params = {
    slotId: 1, currentUser: { uid: "user-1" }, isFirebaseAvailable: true,
    digimonStats: remote, selectedDigimon: "Agumon", digimonDataVer1: dataMap,
    activityLogs: [], isLightsOn: true, wakeUntil: null,
    setDigimonStats: noop, setActivityLogs: noop, setIsLoadingSlot: noop,
    setDeathReason: noop, toggleModal: noop, navigate: noop,
  };
  const { result } = renderHook(() => useGameData(params));
  return { result, remote, setDurable: (stats) => { durable = stats; } };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  getDoc.mockReset();
});
afterEach(() => jest.useRealTimers());

test.each([
  ["고기", feedMeat, "fullness"],
  ["프로틴", feedProtein, "strength"],
])("동기화 전 %s를 연속으로 주면 이전 결과부터 누적한다", async (_, feed, field) => {
  const { result, setDurable } = setup();
  let stats;
  for (let index = 0; index < 3; index += 1) {
    await act(async () => { stats = await result.current.applyLazyUpdate(); });
    stats = { ...feed(stats).updatedStats, lastSavedAt: now };
    setDurable(stats);
  }
  expect(stats[field]).toBe(4);
});

test("청소와 치료가 저장 대기 중이어도 다음 액션에서 되살아나지 않는다", async () => {
  const { result, remote, setDurable } = setup();
  setDurable({ ...clearActiveInjuryState(clearPoopOverflowState(remote, new Date(now))), lastSavedAt: now });
  let stats;
  await act(async () => { stats = await result.current.applyLazyUpdate(); });
  expect(stats).toMatchObject({ poopCount: 0, isInjured: false, injuredAt: null });
});

test("경과 시간은 대기함 스냅샷의 시각부터 한 번만 계산한다", async () => {
  const { result, remote, setDurable } = setup();
  setDurable({ ...remote, lastSavedAt: now, hungerCountdown: 100, strengthCountdown: 100, poopCountdown: 100 });
  jest.setSystemTime(now + 10000);
  let stats;
  await act(async () => { stats = await result.current.applyLazyUpdate(); });
  expect(stats.hungerCountdown).toBe(90);
  expect(stats.strengthCountdown).toBe(90);
  expect(stats.poopCountdown).toBe(90);
});

test("대기함 읽기가 실패하면 이전 원격 상태로 액션을 진행하지 않는다", async () => {
  const { result } = setup();
  const error = new Error("대기함 읽기 실패");
  mockGetLatestStateSnapshot.mockRejectedValueOnce(error);
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await act(async () => {
      await expect(result.current.applyLazyUpdate()).rejects.toBe(error);
    });
    expect(result.current.error).toBe(error);
    expect(getDoc).toHaveBeenCalledTimes(1);
  } finally {
    errorLog.mockRestore();
  }
});

test("슬롯 identity 검증에서 차단되면 메모리 상태로 액션을 진행하지 않는다", async () => {
  const { result } = setup();
  mockGetLatestStateSnapshot.mockResolvedValueOnce(null);
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await act(async () => {
      await expect(result.current.applyLazyUpdate()).rejects.toMatchObject({ code: "game/action-state-unavailable" });
    });
    expect(getDoc).toHaveBeenCalledTimes(1);
  } finally {
    errorLog.mockRestore();
  }
});
