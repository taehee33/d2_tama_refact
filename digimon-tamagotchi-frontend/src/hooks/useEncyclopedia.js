// src/hooks/useEncyclopedia.js
// 도감(Encyclopedia) 데이터 저장/로드 로직

import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getRequiredDigimonIds, isVersionComplete } from "../logic/encyclopediaMaster";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import {
  getAchievementsAndMaxSlots,
  updateAchievementsAndMaxSlots,
  ensureUserProfileMirror,
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";
import {
  SUPPORTED_DIGIMON_VERSIONS,
  getDigimonDataMapByVersion,
  getDigimonVersionByDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
import { resolveDigimonSnapshotFromToken } from "../utils/digimonLogSnapshot";
import encyclopediaMigrationCore from "../utils/encyclopediaMigrationCore";
import { toEpochMs } from "../utils/time";

const ENCYCLOPEDIA_VERSIONS = SUPPORTED_DIGIMON_VERSIONS;
const ENCYCLOPEDIA_STRUCTURE = {
  storageMode: "version-docs-with-root-mirror",
  canonicalCollection: "encyclopedia",
  canonicalDocStrategy: "version",
  rootMirrorEnabled: true,
  phase: "compat",
};
const VERSION_MASTER_ACHIEVEMENTS = {
  "Ver.1": ACHIEVEMENT_VER1_MASTER,
  "Ver.2": ACHIEVEMENT_VER2_MASTER,
};
const {
  buildCanonicalEncyclopedia,
  createEmptyEncyclopedia: createEmptyEncyclopediaBase,
  hasVersionEntries: hasVersionEntriesBase,
  normalizeEncyclopedia: normalizeEncyclopediaBase,
  normalizeVersionEntries,
} = encyclopediaMigrationCore;
const reportedLegacyFallbackKeys = new Set();
const syncedEncyclopediaStructureKeys = new Set();

function createEmptyEncyclopedia() {
  return createEmptyEncyclopediaBase(ENCYCLOPEDIA_VERSIONS);
}

function normalizeEncyclopedia(encyclopedia) {
  return normalizeEncyclopediaBase(encyclopedia, ENCYCLOPEDIA_VERSIONS);
}

function hasVersionEntries(versionEntries) {
  return hasVersionEntriesBase(versionEntries);
}

function getUserRootRef(uid) {
  return doc(db, "users", uid);
}

function getUserEncyclopediaRef(uid, version) {
  return doc(db, "users", uid, "encyclopedia", version);
}

function buildRootEncyclopediaMirrorPayload(encyclopedia) {
  return {
    encyclopedia,
    encyclopediaStructure: ENCYCLOPEDIA_STRUCTURE,
  };
}

function hasAnyEncyclopediaEntries(encyclopedia = {}) {
  return ENCYCLOPEDIA_VERSIONS.some((version) => hasVersionEntries(encyclopedia?.[version]));
}

function shouldSyncCompatibilityStructure(encyclopedia, sourceSummary = {}, rootData = {}) {
  if (!hasAnyEncyclopediaEntries(encyclopedia)) {
    return false;
  }

  if (sourceSummary?.fallbackUsed) {
    return true;
  }

  return rootData?.encyclopediaStructure?.storageMode !== ENCYCLOPEDIA_STRUCTURE.storageMode;
}

async function syncEncyclopediaCompatibilityStructure(currentUser, encyclopedia) {
  if (!currentUser?.uid || !hasAnyEncyclopediaEntries(encyclopedia)) {
    return;
  }

  await saveEncyclopedia(encyclopedia, currentUser);
  await ensureUserProfileMirror(currentUser.uid);
}

function reportLegacyFallbackUsage(uid, sourceSummary = {}) {
  if (!uid || !sourceSummary?.fallbackUsed) {
    return;
  }

  const reportKey = `${uid}:${JSON.stringify({
    fallbackSources: sourceSummary.fallbackSources || [],
    recoveredFromLogs: sourceSummary.recoveredFromLogs || 0,
  })}`;
  if (reportedLegacyFallbackKeys.has(reportKey)) {
    return;
  }

  reportedLegacyFallbackKeys.add(reportKey);
  console.warn("[도감] legacy fallback 사용 중", {
    uid,
    fallbackSources: sourceSummary.fallbackSources || [],
    recoveredFromLogs: sourceSummary.recoveredFromLogs || 0,
    sourceSummary,
  });
}

function getRecoveryDataMaps(preferredVersion = "Ver.1") {
  const normalizedVersion = normalizeDigimonVersionLabel(preferredVersion);

  return [
    getDigimonDataMapByVersion(normalizedVersion),
    ...ENCYCLOPEDIA_VERSIONS.filter((version) => version !== normalizedVersion).map((version) =>
      getDigimonDataMapByVersion(version)
    ),
  ].filter(Boolean);
}

function parseRecoveredDigimonToken(text = "") {
  const patterns = [
    /Reborn as\s+([^\n]+)/i,
    /Transformed to\s+(.+?)\s+\(death form\)/i,
    /Evolved to\s+(.+?)!/i,
    /조그레스 진화(?:\([^)]*\))?:\s*(.+?)!/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function resolveRecoveredDigimonId(entry, preferredVersion = "Ver.1") {
  const directDigimonId =
    typeof entry?.digimonId === "string" ? entry.digimonId.trim() : "";
  if (directDigimonId) {
    return directDigimonId;
  }

  const directToken =
    typeof entry?.digimonName === "string" && entry.digimonName.trim()
      ? entry.digimonName.trim()
      : parseRecoveredDigimonToken(entry?.text || "");

  if (!directToken) {
    return null;
  }

  return (
    resolveDigimonSnapshotFromToken(directToken, ...getRecoveryDataMaps(preferredVersion))
      ?.digimonId || null
  );
}

function buildRecoveredEncyclopediaEntry(existingEntry = {}, observedAt = Date.now(), resultText) {
  const observedAtMs = toEpochMs(observedAt) ?? Date.now();
  const existingFirstDiscoveredAt = toEpochMs(existingEntry?.firstDiscoveredAt);
  const existingLastRaisedAt = toEpochMs(existingEntry?.lastRaisedAt);
  const existingHistory = Array.isArray(existingEntry?.history) ? existingEntry.history : [];

  return {
    ...existingEntry,
    isDiscovered: true,
    firstDiscoveredAt:
      existingFirstDiscoveredAt != null
        ? Math.min(existingFirstDiscoveredAt, observedAtMs)
        : observedAtMs,
    raisedCount: Math.max(existingEntry?.raisedCount || 0, 1),
    lastRaisedAt:
      existingLastRaisedAt != null
        ? Math.max(existingLastRaisedAt, observedAtMs)
        : observedAtMs,
    bestStats:
      existingEntry?.bestStats && typeof existingEntry.bestStats === "object"
        ? existingEntry.bestStats
        : {},
    history:
      existingHistory.length > 0
        ? existingHistory
        : [
            {
              date: observedAtMs,
              result: resultText || "복구: 슬롯 기록에서 발견 이력 복원",
              finalStats: {},
            },
          ],
  };
}

function markRecoveredDigimon(encyclopedia, digimonId, observedAt, resultText) {
  const normalizedDigimonId =
    typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedDigimonId) {
    return;
  }

  const version = normalizeDigimonVersionLabel(
    getDigimonVersionByDigimonId(normalizedDigimonId)
  );

  if (!encyclopedia[version]) {
    encyclopedia[version] = {};
  }

  encyclopedia[version][normalizedDigimonId] = buildRecoveredEncyclopediaEntry(
    encyclopedia[version][normalizedDigimonId],
    observedAt,
    resultText
  );
}

function collectRecoveredDigimonsFromEntries(
  encyclopedia,
  entries = [],
  preferredVersion = "Ver.1",
  resultText = "복구: 활동 로그에서 발견 이력 복원"
) {
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const digimonId = resolveRecoveredDigimonId(entry, preferredVersion);
    if (!digimonId) {
      return;
    }

    markRecoveredDigimon(
      encyclopedia,
      digimonId,
      entry?.timestamp,
      resultText
    );
  });
}

async function loadLegacySlotSources(uid) {
  const slotSnapshots = [];
  const slotLegacySources = [];
  const slotsSnapshot = await getDocs(collection(db, "users", uid, "slots"));

  slotsSnapshot.forEach((slotSnapshot) => {
    slotSnapshots.push(slotSnapshot);
    const slotEncyclopedia = slotSnapshot.data()?.encyclopedia;

    if (!slotEncyclopedia) {
      return;
    }
    slotLegacySources.push({
      key: `slot-${slotSnapshot.id || slotSnapshots.length}`,
      encyclopedia: slotEncyclopedia,
    });
  });

  const { encyclopedia: legacyEncyclopedia } = buildCanonicalEncyclopedia({
    versions: ENCYCLOPEDIA_VERSIONS,
    sources: slotLegacySources,
  });

  return {
    legacyEncyclopedia,
    slotSnapshots,
  };
}

async function recoverEncyclopediaFromSlotSnapshots(uid, slotSnapshots = []) {
  const recovered = createEmptyEncyclopedia();

  for (const slotSnapshot of slotSnapshots) {
    const slotData = slotSnapshot.data?.() || {};
    const slotVersion = normalizeDigimonVersionLabel(slotData.version || "Ver.1");
    const slotObservedAt =
      toEpochMs(slotData.updatedAt) ??
      toEpochMs(slotData.createdAt) ??
      Date.now();

    markRecoveredDigimon(
      recovered,
      slotData.selectedDigimon,
      slotObservedAt,
      "복구: 현재 슬롯 디지몬 반영"
    );
    markRecoveredDigimon(
      recovered,
      slotData.digimonStats?.selectedDigimon,
      slotObservedAt,
      "복구: 저장된 슬롯 스탯 반영"
    );

    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.digimonStats?.activityLogs,
      slotVersion
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.activityLogs,
      slotVersion
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.digimonStats?.battleLogs,
      slotVersion,
      "복구: 배틀 로그에서 발견 이력 복원"
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.battleLogs,
      slotVersion,
      "복구: 배틀 로그에서 발견 이력 복원"
    );

    if (!slotSnapshot.id) {
      continue;
    }

    try {
      const slotRef = doc(db, "users", uid, "slots", slotSnapshot.id);
      const [activityLogSnapshots, battleLogSnapshots] = await Promise.all([
        getDocs(collection(slotRef, "logs")),
        getDocs(collection(slotRef, "battleLogs")),
      ]);

      const activityLogEntries = [];
      activityLogSnapshots.forEach((logSnapshot) => {
        activityLogEntries.push(logSnapshot.data?.() || {});
      });
      collectRecoveredDigimonsFromEntries(
        recovered,
        activityLogEntries,
        slotVersion
      );

      const battleLogEntries = [];
      battleLogSnapshots.forEach((logSnapshot) => {
        battleLogEntries.push(logSnapshot.data?.() || {});
      });
      collectRecoveredDigimonsFromEntries(
        recovered,
        battleLogEntries,
        slotVersion,
        "복구: 배틀 로그에서 발견 이력 복원"
      );
    } catch (error) {
      console.warn("[recoverEncyclopediaFromSlotSnapshots] 슬롯 로그 복구 스킵:", error);
    }
  }

  return recovered;
}

/**
 * 도감 데이터 로드 (계정별 통합)
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @returns {Promise<Object>} 도감 데이터
 */
export async function loadEncyclopedia(currentUser) {
  // Firebase 로그인 필수
  if (!currentUser || !db) {
    console.warn("Firebase 로그인이 필요합니다.");
    return createEmptyEncyclopedia();
  }

  try {
    const versionEncyclopedia = createEmptyEncyclopedia();
    const versionSnapshotResults = await Promise.allSettled(
      ENCYCLOPEDIA_VERSIONS.map((version) =>
        getDoc(getUserEncyclopediaRef(currentUser.uid, version))
      )
    );

    versionSnapshotResults.forEach((result, index) => {
      const version = ENCYCLOPEDIA_VERSIONS[index];
      if (result.status !== "fulfilled") {
        console.warn(`[loadEncyclopedia] 버전 문서(${version}) 로드 실패, legacy fallback 계속 진행:`, result.reason);
        return;
      }

      if (result.value.exists()) {
        versionEncyclopedia[version] = normalizeVersionEntries(result.value.data());
      }
    });

    // 도감 분리 저장 마이그레이션 동안에는 루트 users/{uid}.encyclopedia도 함께 읽어
    // 부분 이전 상태에서 과거 발견 이력이 가려지지 않도록 병합한다.
    const userRef = getUserRootRef(currentUser.uid);
    const [userSnapResult, legacySlotSourcesResult] = await Promise.allSettled([
      getDoc(userRef),
      loadLegacySlotSources(currentUser.uid),
    ]);

    const rootData =
      userSnapResult.status === "fulfilled" && userSnapResult.value.exists()
        ? userSnapResult.value.data()
        : undefined;
    const rootEncyclopedia = rootData?.encyclopedia;
    if (userSnapResult.status !== "fulfilled") {
      console.warn("[loadEncyclopedia] 루트 users 문서 로드 실패:", userSnapResult.reason);
    }

    const { legacyEncyclopedia, slotSnapshots } =
      legacySlotSourcesResult.status === "fulfilled"
        ? legacySlotSourcesResult.value
        : {
            legacyEncyclopedia: createEmptyEncyclopedia(),
            slotSnapshots: [],
          };
    if (legacySlotSourcesResult.status !== "fulfilled") {
      console.warn("[loadEncyclopedia] 슬롯 legacy 도감 로드 실패:", legacySlotSourcesResult.reason);
    }

    let recoveredEncyclopedia = createEmptyEncyclopedia();
    if (slotSnapshots.length > 0) {
      try {
        recoveredEncyclopedia = await recoverEncyclopediaFromSlotSnapshots(
          currentUser.uid,
          slotSnapshots
        );
      } catch (recoveryError) {
        console.warn("[loadEncyclopedia] 슬롯 로그 기반 도감 복구 실패:", recoveryError);
      }
    }

    const { encyclopedia, sourceSummary } = buildCanonicalEncyclopedia({
      versions: ENCYCLOPEDIA_VERSIONS,
      sources: [
        {
          key: "versionDocs",
          encyclopedia: versionEncyclopedia,
        },
        {
          key: "rootLegacy",
          encyclopedia: rootEncyclopedia,
          isFallback: true,
        },
        {
          key: "slotLegacy",
          encyclopedia: legacyEncyclopedia,
          isFallback: true,
        },
        {
          key: "logsRecovery",
          encyclopedia: recoveredEncyclopedia,
          isFallback: true,
          onlyFillMissing: true,
        },
      ],
    });

    reportLegacyFallbackUsage(currentUser.uid, sourceSummary);
    const shouldSync = shouldSyncCompatibilityStructure(
      encyclopedia,
      sourceSummary,
      rootData
    );
    const syncKey = `${currentUser.uid}:${JSON.stringify({
      fallbackSources: sourceSummary?.fallbackSources || [],
      recoveredFromLogs: sourceSummary?.recoveredFromLogs || 0,
      rootStructureMode: rootData?.encyclopediaStructure?.storageMode || "none",
    })}`;

    if (shouldSync && !syncedEncyclopediaStructureKeys.has(syncKey)) {
      syncedEncyclopediaStructureKeys.add(syncKey);
      try {
        await syncEncyclopediaCompatibilityStructure(currentUser, encyclopedia);
      } catch (syncError) {
        syncedEncyclopediaStructureKeys.delete(syncKey);
        console.warn("[loadEncyclopedia] 호환 구조 동기화 실패:", syncError);
      }
    }

    return encyclopedia;
  } catch (error) {
    console.error("도감 로드 오류 (Firebase):", error);
  }

  return createEmptyEncyclopedia();
}

/**
 * 도감 완성 시 마스터 칭호·maxSlots 부여 (저장 후 호출)
 * @param {Object|null} currentUser - Firebase Auth 사용자
 * @param {Object} mergedEncyclopedia - 병합된 도감 { "Ver.1": {...}, "Ver.2": {...} }
 */
export async function checkAndGrantEncyclopediaMasters(currentUser, mergedEncyclopedia) {
  if (!currentUser?.uid || !db || !mergedEncyclopedia) return;
  try {
    const { achievements } = await getAchievementsAndMaxSlots(currentUser.uid);
    const next = [...achievements];

    ENCYCLOPEDIA_VERSIONS.forEach((version) => {
      const achievement = VERSION_MASTER_ACHIEVEMENTS[version];
      if (!achievement) {
        return;
      }

      const requiredIds =
        version === "Ver.1" || version === "Ver.2"
          ? getRequiredDigimonIds(digimonDataVer1, digimonDataVer2, version)
          : getRequiredDigimonIds(version);
      const isComplete = isVersionComplete(mergedEncyclopedia[version] || {}, requiredIds);

      if (isComplete && !next.includes(achievement)) {
        next.push(achievement);
      }
    });

    if (next.length > achievements.length) {
      await updateAchievementsAndMaxSlots(currentUser.uid, next);
    }
  } catch (err) {
    console.error("도감 마스터 칭호 부여 오류:", err);
  }
}

/**
 * 도감 데이터 저장 (계정별 통합)
 * @param {Object} encyclopedia - 도감 데이터
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 */
export async function saveEncyclopedia(encyclopedia, currentUser) {
  // Firebase 로그인 필수
  if (!currentUser || !db) {
    console.warn("Firebase 로그인이 필요합니다.");
    return;
  }

  try {
    const normalizedEncyclopedia = normalizeEncyclopedia(encyclopedia);
    const saveTasks = [];
    let hasCanonicalEntries = false;

    for (const version of ENCYCLOPEDIA_VERSIONS) {
      if (!hasVersionEntries(normalizedEncyclopedia[version])) {
        continue;
      }

      hasCanonicalEntries = true;

      saveTasks.push(
        setDoc(
          getUserEncyclopediaRef(currentUser.uid, version),
          normalizedEncyclopedia[version]
        )
      );
    }

    if (hasCanonicalEntries) {
      saveTasks.push(
        setDoc(
          getUserRootRef(currentUser.uid),
          buildRootEncyclopediaMirrorPayload(normalizedEncyclopedia),
          { merge: true }
        )
      );
    }

    if (saveTasks.length > 0) {
      await Promise.all(saveTasks);
    }

    await checkAndGrantEncyclopediaMasters(currentUser, normalizedEncyclopedia);
  } catch (error) {
    console.error("도감 저장 오류 (Firebase):", error);
  }
}

/**
 * 도감 업데이트 (진화/사망/발견 시 호출) - 계정별 통합
 * @param {string} digimonName - 디지몬 이름
 * @param {Object} finalStats - 최종 스탯
 * @param {string} eventType - 이벤트 타입 ('evolution' | 'death' | 'discovery')
 * @param {Object|null} currentUser - 현재 사용자
 * @param {string} version - 버전 ("Ver.1" | "Ver.2" 등, 기본값: "Ver.1")
 */
export async function updateEncyclopedia(
  digimonName,
  finalStats,
  eventType, // 'evolution' | 'death' | 'discovery'
  currentUser,
  version = "Ver.1" // 버전 파라미터 추가 (Ver.2 별도 관리)
) {
  if (!digimonName) return;
  const normalizedVersion = normalizeDigimonVersionLabel(version);
  
  // 도감 데이터 로드 (계정별)
  const encyclopedia = await loadEncyclopedia(currentUser);
  
  // 해당 디지몬 데이터 가져오기 또는 초기화
  if (!encyclopedia[normalizedVersion]) {
    encyclopedia[normalizedVersion] = {};
  }
  
  const digimonData = encyclopedia[normalizedVersion][digimonName] || {
    isDiscovered: false,
    raisedCount: 0,
    bestStats: {},
    history: []
  };
  
  // 발견 처리
  if (!digimonData.isDiscovered) {
    digimonData.isDiscovered = true;
    digimonData.firstDiscoveredAt = Date.now();
  }
  
  // 육성 횟수 증가
  digimonData.raisedCount = (digimonData.raisedCount || 0) + 1;
  digimonData.lastRaisedAt = Date.now();
  
  // 최고 기록 업데이트
  const currentStats = {
    maxAge: finalStats.age || 0,
    maxWinRate: finalStats.winRate || 0,
    maxWeight: finalStats.weight || 0,
    maxLifespan: finalStats.lifespanSeconds || 0,
    totalBattles: finalStats.totalBattles || 0,
    totalBattlesWon: finalStats.totalBattlesWon || 0
  };
  
  // bestStats 업데이트 (더 좋은 기록이면 갱신)
  if (!digimonData.bestStats.maxAge || currentStats.maxAge > (digimonData.bestStats.maxAge || 0)) {
    digimonData.bestStats.maxAge = currentStats.maxAge;
  }
  if (!digimonData.bestStats.maxWinRate || currentStats.maxWinRate > (digimonData.bestStats.maxWinRate || 0)) {
    digimonData.bestStats.maxWinRate = currentStats.maxWinRate;
  }
  if (!digimonData.bestStats.maxWeight || currentStats.maxWeight > (digimonData.bestStats.maxWeight || 0)) {
    digimonData.bestStats.maxWeight = currentStats.maxWeight;
  }
  if (!digimonData.bestStats.maxLifespan || currentStats.maxLifespan > (digimonData.bestStats.maxLifespan || 0)) {
    digimonData.bestStats.maxLifespan = currentStats.maxLifespan;
  }
  if (!digimonData.bestStats.totalBattles || currentStats.totalBattles > (digimonData.bestStats.totalBattles || 0)) {
    digimonData.bestStats.totalBattles = currentStats.totalBattles;
  }
  if (!digimonData.bestStats.totalBattlesWon || currentStats.totalBattlesWon > (digimonData.bestStats.totalBattlesWon || 0)) {
    digimonData.bestStats.totalBattlesWon = currentStats.totalBattlesWon;
  }
  
  // 이력 추가 (최대 5개만 유지)
  const historyEntry = {
    date: Date.now(),
    result: eventType === "evolution"
      ? `진화: ${finalStats.evolutionStage || digimonName}`
      : eventType === "death"
        ? `사망: ${finalStats.deathReason || "원인 미상"}`
        : "발견",
    finalStats: {
      age: finalStats.age || 0,
      winRate: finalStats.winRate || 0,
      weight: finalStats.weight || 0,
      lifespanSeconds: finalStats.lifespanSeconds || 0
    }
  };
  
  digimonData.history = [historyEntry, ...(digimonData.history || [])].slice(0, 5);
  
  // 저장 (계정별)
  encyclopedia[normalizedVersion][digimonName] = digimonData;
  await saveEncyclopedia(encyclopedia, currentUser);
}

/**
 * 도감 개발 이전에 진화한 디지몬을 도감에 안전하게 추가 (누락 보정)
 * - 기존 도감 데이터는 건드리지 않고, 누락된 ID만 최소 구조로 추가합니다.
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @param {string[]} digimonIds - 추가할 디지몬 ID (예: ["BlitzGreymon", "ShinMonzaemon"])
 * @returns {Promise<{ added: string[], skipped: string[] }>} 추가된 ID 목록, 이미 있어서 스킵된 ID 목록
 */
export async function addMissingEncyclopediaEntries(currentUser, digimonIds = [], version = null) {
  const added = [];
  const skipped = [];

  if (!currentUser || !db || !Array.isArray(digimonIds) || digimonIds.length === 0) {
    return { added, skipped };
  }

  const encyclopedia = await loadEncyclopedia(currentUser);

  const now = Date.now();
  const minimalEntry = {
    isDiscovered: true,
    firstDiscoveredAt: now,
    raisedCount: 1,
    lastRaisedAt: now,
    bestStats: {},
    history: [{ date: now, result: "도감 보정으로 등록 (진화 이력 반영)", finalStats: {} }]
  };

  for (const id of digimonIds) {
    if (!id || typeof id !== "string") continue;
    const targetVersion = normalizeDigimonVersionLabel(
      version || getDigimonVersionByDigimonId(id)
    );

    if (!encyclopedia[targetVersion]) {
      encyclopedia[targetVersion] = {};
    }

    const existing = encyclopedia[targetVersion][id];
    if (existing?.isDiscovered) {
      skipped.push(id);
      continue;
    }
    encyclopedia[targetVersion][id] = { ...minimalEntry };
    added.push(id);
  }

  if (added.length > 0) {
    await saveEncyclopedia(encyclopedia, currentUser);
  }

  return { added, skipped };
}
