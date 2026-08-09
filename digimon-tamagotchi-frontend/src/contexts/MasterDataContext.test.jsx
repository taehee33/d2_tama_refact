import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import {
  MasterDataProvider,
  createMasterDataRequestId,
  normalizeMasterDataRevision,
  useMasterData,
} from "./MasterDataContext";
import { useAuth } from "./AuthContext";
import {
  restoreOperatorMasterData,
  saveOperatorMasterData,
} from "../utils/operatorApi";
import { getDoc, getDocs } from "firebase/firestore";
import {
  deepClonePlain,
  formatSnapshotAction,
  getChangedDigimonIdsBetweenOverrides,
  getMasterDataVersionKey,
  normalizeMasterDataOverrides,
} from "../utils/masterDataUtils";

jest.mock("../firebase", () => ({ db: { name: "firestore" } }));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => ({ type: "collection", args })),
  doc: jest.fn((...args) => ({ type: "document", args })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value) => value),
  orderBy: jest.fn((...args) => args),
  query: jest.fn((...args) => args),
}));

jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("../utils/operatorApi", () => ({
  restoreOperatorMasterData: jest.fn(),
  saveOperatorMasterData: jest.fn(),
}));

jest.mock("../utils/masterDataUtils", () => ({
  MASTER_DATA_DOC_PATH: {
    collection: "game_settings",
    documentId: "digimon_master_data",
    snapshotSubcollection: "snapshots",
  },
  applyMasterDataOverrides: jest.fn(),
  buildMasterRowOverrideFromDraft: jest.fn((value) => value),
  deepClonePlain: jest.fn((value) => JSON.parse(JSON.stringify(value))),
  formatSnapshotAction: jest.fn((value) => value),
  getChangedDigimonIdsBetweenOverrides: jest.fn(() => ({
    ver1: ["agumon"],
    ver2: [],
    totalCount: 1,
  })),
  getMasterDataVersionKey: jest.fn(() => "ver1"),
  normalizeMasterDataOverrides: jest.fn((value = {}) => ({
    ver1: value.ver1 || value.ver1Overrides || {},
    ver2: value.ver2 || value.ver2Overrides || {},
  })),
}));

jest.mock("../utils/digimonVersionUtils", () => ({
  SUPPORTED_MASTER_DATA_VERSION_KEYS: ["ver1", "ver2"],
}));

function ContextProbe({ onValue }) {
  const value = useMasterData();
  onValue(value);
  return null;
}

describe("MasterDataContext 서버 저장 경계", () => {
  let contextValue;
  const currentUser = {
    uid: "operator-1",
    displayName: "운영자",
    getIdToken: jest.fn().mockResolvedValue("token"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    contextValue = null;
    deepClonePlain.mockImplementation((value) => JSON.parse(JSON.stringify(value)));
    formatSnapshotAction.mockImplementation((value) => value);
    getChangedDigimonIdsBetweenOverrides.mockReturnValue({
      ver1: ["agumon"],
      ver2: [],
      totalCount: 1,
    });
    getMasterDataVersionKey.mockReturnValue("ver1");
    normalizeMasterDataOverrides.mockImplementation((value = {}) => ({
      ver1: value.ver1 || value.ver1Overrides || {},
      ver2: value.ver2 || value.ver2Overrides || {},
    }));
    useAuth.mockReturnValue({ currentUser });
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    getDocs.mockResolvedValue({ docs: [] });
    saveOperatorMasterData.mockResolvedValue({
      snapshotId: "receipt-save",
      revisionAfter: 1,
      updatedAt: "2026-08-09T00:00:00.000Z",
      changeSummary: { ver1: ["agumon"], ver2: [], totalCount: 1 },
    });
    restoreOperatorMasterData.mockResolvedValue({
      snapshotId: "receipt-restore",
      revisionAfter: 1,
      updatedAt: "2026-08-09T00:00:00.000Z",
      changeSummary: { ver1: ["agumon"], ver2: [], totalCount: 1 },
    });
  });

  test("revision이 없거나 손상된 기존 문서는 0으로 bootstrap한다", () => {
    expect(normalizeMasterDataRevision(undefined)).toBe(0);
    expect(normalizeMasterDataRevision(-1)).toBe(0);
    expect(normalizeMasterDataRevision("3")).toBe(3);
  });

  test("requestId를 빈 문자열이 아닌 값으로 생성한다", () => {
    expect(createMasterDataRequestId()).toEqual(expect.any(String));
    expect(createMasterDataRequestId().length).toBeGreaterThan(8);
  });

  test("저장은 클라이언트 Firestore write 대신 운영자 API를 호출한다", async () => {
    render(
      <MasterDataProvider>
        <ContextProbe onValue={(value) => { contextValue = value; }} />
      </MasterDataProvider>
    );
    await waitFor(() => expect(contextValue?.isMasterDataReady).toBe(true));

    await act(async () => {
      await contextValue.saveDigimonOverride(
        "Ver.1",
        "agumon",
        { name: "아구몬" },
        "메모"
      );
    });

    expect(saveOperatorMasterData).toHaveBeenCalledWith(
      currentUser,
      expect.objectContaining({
        requestId: expect.any(String),
        expectedRevision: 0,
        actionType: "save_row",
        note: "메모",
        versionLabel: "Ver.1",
        targetDigimonId: "agumon",
        overrides: expect.objectContaining({
          ver1: { agumon: { name: "아구몬" } },
        }),
      })
    );
  });

  test("스냅샷 복원도 expectedRevision을 포함한 운영자 API를 호출한다", async () => {
    render(
      <MasterDataProvider>
        <ContextProbe onValue={(value) => { contextValue = value; }} />
      </MasterDataProvider>
    );
    await waitFor(() => expect(contextValue?.isMasterDataReady).toBe(true));

    await act(async () => {
      await contextValue.restoreMasterDataSnapshot("snapshot-source", "복원 메모");
    });

    expect(restoreOperatorMasterData).toHaveBeenCalledWith(currentUser, {
      requestId: expect.any(String),
      expectedRevision: 0,
      snapshotId: "snapshot-source",
      note: "복원 메모",
    });
  });
});
