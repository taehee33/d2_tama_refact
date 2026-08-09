// src/contexts/MasterDataContext.jsx
// 디지몬 마스터 데이터 전역 저장/스냅샷 컨텍스트

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import {
  restoreOperatorMasterData,
  saveOperatorMasterData,
} from "../utils/operatorApi";
import {
  MASTER_DATA_DOC_PATH,
  applyMasterDataOverrides,
  buildMasterRowOverrideFromDraft,
  deepClonePlain,
  formatSnapshotAction,
  getChangedDigimonIdsBetweenOverrides,
  getMasterDataVersionKey,
  normalizeMasterDataOverrides,
} from "../utils/masterDataUtils";
import { SUPPORTED_MASTER_DATA_VERSION_KEYS } from "../utils/digimonVersionUtils";

const MasterDataContext = createContext(null);
const EMPTY_OVERRIDES = Object.freeze(
  SUPPORTED_MASTER_DATA_VERSION_KEYS.reduce((acc, versionKey) => {
    acc[versionKey] = {};
    return acc;
  }, {})
);
const SNAPSHOT_LIMIT = 30;

export function canLoadRemoteMasterData(database, currentUser) {
  return Boolean(database && currentUser);
}

export function createMasterDataRequestId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `master-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeMasterDataRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function buildEmptyMeta() {
  const emptyChangeSummary = SUPPORTED_MASTER_DATA_VERSION_KEYS.reduce(
    (acc, versionKey) => {
      acc[versionKey] = [];
      return acc;
    },
    {}
  );

  return {
    revision: 0,
    activeSnapshotId: null,
    updatedAt: null,
    updatedBy: null,
    latestActionType: null,
    latestActionLabel: null,
    latestNote: null,
    changeSummary: { ...emptyChangeSummary, totalCount: 0 },
  };
}

function buildSnapshotCollectionRef() {
  return collection(
    db,
    MASTER_DATA_DOC_PATH.collection,
    MASTER_DATA_DOC_PATH.documentId,
    MASTER_DATA_DOC_PATH.snapshotSubcollection
  );
}

export function MasterDataProvider({ children }) {
  const { currentUser } = useAuth();
  const hasLoadedRemoteRef = useRef(false);

  const [isMasterDataReady, setIsMasterDataReady] = useState(false);
  const [masterDataRevision, setMasterDataRevision] = useState(0);
  const [masterDataOverrides, setMasterDataOverrides] = useState(EMPTY_OVERRIDES);
  const [masterDataMeta, setMasterDataMeta] = useState(buildEmptyMeta());
  const [masterDataSnapshots, setMasterDataSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [masterDataError, setMasterDataError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const applyLoadedState = (nextOverrides, meta = buildEmptyMeta(), snapshots = []) => {
    const normalized = normalizeMasterDataOverrides(nextOverrides);
    applyMasterDataOverrides(normalized);
    setMasterDataOverrides(normalized);
    setMasterDataMeta(meta);
    setMasterDataSnapshots(snapshots);
    setMasterDataRevision((prev) => prev + 1);
    setLastSyncedAt(new Date().toISOString());
    setIsMasterDataReady(true);
    return normalized;
  };

  const loadMasterData = async () => {
    setMasterDataError(null);

    if (!canLoadRemoteMasterData(db, currentUser)) {
      applyLoadedState(EMPTY_OVERRIDES, buildEmptyMeta(), []);
      return normalizeMasterDataOverrides(EMPTY_OVERRIDES);
    }

    try {
      const activeRef = doc(
        db,
        MASTER_DATA_DOC_PATH.collection,
        MASTER_DATA_DOC_PATH.documentId
      );
      const snapshotQuery = query(
        buildSnapshotCollectionRef(),
        orderBy("createdAt", "desc"),
        limit(SNAPSHOT_LIMIT)
      );

      const [activeSnapshot, snapshotsSnapshot] = await Promise.all([
        getDoc(activeRef),
        getDocs(snapshotQuery),
      ]);

      const normalizedOverrides = activeSnapshot.exists()
        ? normalizeMasterDataOverrides(activeSnapshot.data())
        : normalizeMasterDataOverrides(EMPTY_OVERRIDES);

      const activeData = activeSnapshot.exists() ? activeSnapshot.data() : {};
      const meta = {
        revision: normalizeMasterDataRevision(activeData.revision),
        activeSnapshotId: activeData.activeSnapshotId || null,
        updatedAt: activeData.updatedAt || null,
        updatedBy: activeData.updatedBy || null,
        latestActionType: activeData.latestActionType || null,
        latestActionLabel: activeData.latestActionType
          ? formatSnapshotAction(activeData.latestActionType)
          : null,
        latestNote: activeData.latestNote || null,
        changeSummary: activeData.changeSummary || buildEmptyMeta().changeSummary,
      };

      const snapshots = snapshotsSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      }));

      hasLoadedRemoteRef.current = true;
      setSnapshotsLoading(false);
      return applyLoadedState(normalizedOverrides, meta, snapshots);
    } catch (error) {
      console.error("마스터 데이터 로드 오류:", error);
      setMasterDataError(error);
      setSnapshotsLoading(false);

      if (!hasLoadedRemoteRef.current) {
        applyLoadedState(EMPTY_OVERRIDES, buildEmptyMeta(), []);
      } else {
        setIsMasterDataReady(true);
      }

      throw error;
    }
  };

  useEffect(() => {
    setSnapshotsLoading(true);
    loadMasterData().catch(() => {});
    // 로그인 계정이 바뀌면 최신 전역 데이터를 다시 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const persistOverrides = async ({
    nextOverrides,
    actionType,
    note = "",
    versionLabel = null,
    targetDigimonId = null,
  }) => {
    if (!db) {
      throw new Error("Firebase가 연결되지 않아 전역 저장을 사용할 수 없습니다.");
    }

    if (!currentUser) {
      throw new Error("로그인한 관리자만 마스터 데이터를 저장할 수 있습니다.");
    }

    const beforeOverrides = normalizeMasterDataOverrides(masterDataOverrides);
    const normalizedAfter = normalizeMasterDataOverrides(nextOverrides);
    const changeSummary = getChangedDigimonIdsBetweenOverrides(
      beforeOverrides,
      normalizedAfter
    );

    if (changeSummary.totalCount === 0) {
      return normalizedAfter;
    }

    const result = await saveOperatorMasterData(currentUser, {
      requestId: createMasterDataRequestId(),
      expectedRevision: normalizeMasterDataRevision(masterDataMeta.revision),
      actionType,
      note,
      versionLabel,
      targetDigimonId,
      overrides: normalizedAfter,
    }).catch(async (error) => {
      if (error?.code === "MASTER_DATA_REVISION_CONFLICT") {
        await loadMasterData().catch(() => {});
      }
      throw error;
    });

    try {
      return await loadMasterData();
    } catch (reloadError) {
      const actor = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || null,
      };
      const optimisticMeta = {
        revision: normalizeMasterDataRevision(result?.revisionAfter),
        activeSnapshotId: result?.snapshotId || null,
        updatedAt: result?.updatedAt || new Date().toISOString(),
        updatedBy: actor,
        latestActionType: actionType,
        latestActionLabel: formatSnapshotAction(actionType),
        latestNote: note || null,
        changeSummary,
      };
      const optimisticSnapshot = {
        id: result?.snapshotId,
        actionType,
        note: note || null,
        versionLabel,
        targetDigimonId,
        restoredFromSnapshotId: null,
        createdAt: result?.updatedAt || new Date().toISOString(),
        createdBy: actor,
        changeSummary,
        beforeOverrides,
        afterOverrides: normalizedAfter,
      };

      applyLoadedState(normalizedAfter, optimisticMeta, [
        optimisticSnapshot,
        ...masterDataSnapshots.filter((snapshot) => snapshot.id !== result?.snapshotId),
      ].slice(0, SNAPSHOT_LIMIT));
      setMasterDataError(reloadError);
      return normalizedAfter;
    }
  };

  const saveDigimonOverride = async (
    versionLabel,
    digimonId,
    overrideValue,
    note = ""
  ) => {
    const versionKey = getMasterDataVersionKey(versionLabel);
    const nextVersionOverrides = deepClonePlain(masterDataOverrides[versionKey] || {});

    if (overrideValue && Object.keys(overrideValue).length > 0) {
      nextVersionOverrides[digimonId] = deepClonePlain(overrideValue);
    } else {
      delete nextVersionOverrides[digimonId];
    }

    return persistOverrides({
      nextOverrides: {
        ...masterDataOverrides,
        [versionKey]: nextVersionOverrides,
      },
      actionType: "save_row",
      note,
      versionLabel,
      targetDigimonId: digimonId,
    });
  };

  const importDigimonOverrides = async (versionLabel, importedDrafts = [], note = "") => {
    const versionKey = getMasterDataVersionKey(versionLabel);
    const nextVersionOverrides = deepClonePlain(masterDataOverrides[versionKey] || {});

    importedDrafts.forEach((draft) => {
      const overrideValue = buildMasterRowOverrideFromDraft(draft, versionLabel);
      if (overrideValue && Object.keys(overrideValue).length > 0) {
        nextVersionOverrides[draft.id] = overrideValue;
      } else {
        delete nextVersionOverrides[draft.id];
      }
    });

    return persistOverrides({
      nextOverrides: {
        ...masterDataOverrides,
        [versionKey]: nextVersionOverrides,
      },
      actionType: "import_rows",
      note,
      versionLabel,
      targetDigimonId: null,
    });
  };

  const resetDigimonOverride = async (versionLabel, digimonId, note = "") => {
    const versionKey = getMasterDataVersionKey(versionLabel);
    const nextVersionOverrides = deepClonePlain(masterDataOverrides[versionKey] || {});

    delete nextVersionOverrides[digimonId];

    return persistOverrides({
      nextOverrides: {
        ...masterDataOverrides,
        [versionKey]: nextVersionOverrides,
      },
      actionType: "reset_row",
      note,
      versionLabel,
      targetDigimonId: digimonId,
    });
  };

  const resetAllDigimonOverrides = async (note = "") =>
    persistOverrides({
      nextOverrides: EMPTY_OVERRIDES,
      actionType: "reset_all",
      note,
      versionLabel: null,
      targetDigimonId: null,
    });

  const restoreMasterDataSnapshot = async (snapshotId, note = "") => {
    if (!db) {
      throw new Error("Firebase가 연결되지 않아 스냅샷 복원을 사용할 수 없습니다.");
    }
    if (!currentUser) {
      throw new Error("로그인한 관리자만 마스터 데이터를 복원할 수 있습니다.");
    }

    const sourceSnapshot = masterDataSnapshots.find((entry) => entry.id === snapshotId);
    const result = await restoreOperatorMasterData(currentUser, {
      requestId: createMasterDataRequestId(),
      expectedRevision: normalizeMasterDataRevision(masterDataMeta.revision),
      snapshotId,
      note,
    }).catch(async (error) => {
      if (error?.code === "MASTER_DATA_REVISION_CONFLICT") {
        await loadMasterData().catch(() => {});
      }
      throw error;
    });

    try {
      return await loadMasterData();
    } catch (reloadError) {
      if (sourceSnapshot?.afterOverrides) {
        const restoredOverrides = normalizeMasterDataOverrides(
          sourceSnapshot.afterOverrides
        );
        const actor = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || null,
        };
        const restoredSnapshot = {
          id: result?.snapshotId,
          actionType: "restore_snapshot",
          note: note || `스냅샷 복원: ${snapshotId}`,
          versionLabel: sourceSnapshot.versionLabel || null,
          targetDigimonId: sourceSnapshot.targetDigimonId || null,
          restoredFromSnapshotId: snapshotId,
          createdAt: result?.updatedAt || new Date().toISOString(),
          createdBy: actor,
          changeSummary: result?.changeSummary || buildEmptyMeta().changeSummary,
          afterOverrides: restoredOverrides,
        };
        applyLoadedState(
          restoredOverrides,
          {
            revision: normalizeMasterDataRevision(result?.revisionAfter),
            activeSnapshotId: result?.snapshotId || null,
            updatedAt: result?.updatedAt || new Date().toISOString(),
            updatedBy: actor,
            latestActionType: "restore_snapshot",
            latestActionLabel: formatSnapshotAction("restore_snapshot"),
            latestNote: note || `스냅샷 복원: ${snapshotId}`,
            changeSummary: result?.changeSummary || buildEmptyMeta().changeSummary,
          },
          [
            restoredSnapshot,
            ...masterDataSnapshots.filter(
              (snapshot) => snapshot.id !== result?.snapshotId
            ),
          ].slice(0, SNAPSHOT_LIMIT)
        );
      }
      setMasterDataError(reloadError);
      return sourceSnapshot?.afterOverrides || null;
    }
  };

  const value = {
    canPersistMasterData: Boolean(db && currentUser),
    isMasterDataReady,
    masterDataRevision,
    masterDataOverrides,
    masterDataMeta,
    masterDataSnapshots,
    snapshotsLoading,
    masterDataError,
    lastSyncedAt,
    refreshMasterData: async () => {
      setSnapshotsLoading(true);
      return loadMasterData();
    },
    saveDigimonOverride,
    importDigimonOverrides,
    resetDigimonOverride,
    resetAllDigimonOverrides,
    restoreMasterDataSnapshot,
  };

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);

  if (!context) {
    throw new Error("useMasterData must be used within a MasterDataProvider");
  }

  return context;
}
