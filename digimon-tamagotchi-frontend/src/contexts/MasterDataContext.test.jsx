import { resolveMasterDataActor } from "./MasterDataContext";
import { getTamerName, resolveTamerNamePriority } from "../utils/tamerNameUtils";

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock("./AuthContext", () => ({
  useAuth: jest.fn(() => ({
    currentUser: null,
  })),
}));

jest.mock("../utils/masterDataUtils", () => ({
  MASTER_DATA_DOC_PATH: {
    collection: "master_data",
    documentId: "active",
    snapshotSubcollection: "snapshots",
  },
  applyMasterDataOverrides: jest.fn(),
  buildMasterRowOverrideFromDraft: jest.fn(),
  deepClonePlain: jest.fn((value) => value),
  formatSnapshotAction: jest.fn((value) => value),
  getChangedDigimonIdsBetweenOverrides: jest.fn(() => ({ totalCount: 0 })),
  getMasterDataVersionKey: jest.fn((value) => value),
  normalizeMasterDataOverrides: jest.fn((value) => value),
}));

jest.mock("../utils/digimonVersionUtils", () => ({
  SUPPORTED_MASTER_DATA_VERSION_KEYS: ["ver1", "ver2"],
}));

jest.mock("../utils/tamerNameUtils", () => ({
  getTamerName: jest.fn(),
  resolveTamerNamePriority: jest.fn(),
}));

describe("resolveMasterDataActor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("profile/main 기준 테이머명을 저장자 정보에 우선 반영한다", async () => {
    resolveTamerNamePriority.mockReturnValue("기본표시명");
    getTamerName.mockResolvedValue("커스텀 테이머");

    const actor = await resolveMasterDataActor({
      uid: "user-1",
      displayName: "기본표시명",
      email: "tester@example.com",
    });

    expect(resolveTamerNamePriority).toHaveBeenCalledWith({
      currentUser: {
        uid: "user-1",
        displayName: "기본표시명",
        email: "tester@example.com",
      },
    });
    expect(getTamerName).toHaveBeenCalledWith("user-1", "기본표시명");
    expect(actor).toEqual({
      uid: "user-1",
      tamerName: "커스텀 테이머",
      displayName: "기본표시명",
      email: "tester@example.com",
    });
  });

  test("테이머명 조회 실패 시 기존 fallback 이름으로 저장한다", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    resolveTamerNamePriority.mockReturnValue("fallback-name");
    getTamerName.mockRejectedValue(new Error("load failed"));

    const actor = await resolveMasterDataActor({
      uid: "user-2",
      displayName: "표시 이름",
      email: "user2@example.com",
    });

    expect(actor).toEqual({
      uid: "user-2",
      tamerName: "fallback-name",
      displayName: "표시 이름",
      email: "user2@example.com",
    });
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
