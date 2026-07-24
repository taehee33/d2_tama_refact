// src/hooks/useGameData.js
// Game.jsx의 데이터 저장/로딩 로직을 분리한 Custom Hook

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { applyLazyUpdate } from "../data/stats";
import { initializeStats } from "../data/stats";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import { initializeActivityLogs } from "../hooks/useGameLogic";
import { getSleepSchedule } from "../hooks/useGameHandlers";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";
import { filterEntriesForSlotCreation } from "../utils/slotLogUtils";
import {
  GAME_PERSISTENCE_PHASE,
  useDurableGamePersistence,
} from "./game-persistence/useDurableGamePersistence";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import { normalizeImmersiveSettings } from "../utils/immersiveSettings";
import { resolveSlotNotificationEligible } from "../utils/notificationEligibility";
import { repairCareMistakeLedger } from "../logic/stats/careMistakeLedger";
import { evaluateDeathConditions } from "../logic/stats/death";
import {
  getStarterDigimonId,
  getStarterDigimonIdFromDataMap,
  isStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
import { toEpochMs } from "../utils/time";
import { evaluateSlotUrgentNotification } from "../utils/notificationApi";
import {
  PENDING_HYDRATION_STATUS,
  resolvePendingHydration,
} from "./game-persistence/pendingHydration";
import {
  buildFormTransitionCombatIdentity,
  createNewLifeCombatIdentity,
  hasValidCombatIdentity,
  preserveOrCreateCombatIdentity,
} from "../logic/arena/combatIdentity";

const GAME_TIMESTAMP_KEYS = new Set([
  "birthTime",
  "frozenAt",
  "takeOutAt",
  "injuredAt",
  "diedAt",
  "lastHungerZeroAt",
  "lastStrengthZeroAt",
  "hungerMistakeDeadline",
  "strengthMistakeDeadline",
  "poopReachedMaxAt",
  "lastPoopPenaltyAt",
  "lastAgeUpdateDate",
  "evolutionStageStartedAt",
  "fastSleepStart",
  "napUntil",
  "wakeUntil",
  "sleepLightOnStart",
  "timestamp",
  "occurredAt",
  "resolvedAt",
  "startedAt",
  "sleepStartAt",
  "lastSavedAt",
]);

export function raiseGameSaveError(error, setError) {
  if (typeof setError === "function") {
    setError(error);
  }
  throw error;
}

export function createNextSlotLoadAccess(currentAccess = {}) {
  return {
    ...currentAccess,
    phase: GAME_PERSISTENCE_PHASE.LOADING,
    generation: (Number(currentAccess.generation) || 0) + 1,
    loadedIdentity: null,
  };
}

export function isCurrentSlotLoadRequest(access, generation) {
  return access?.generation === generation;
}

export function createGameSaveQueue() {
  let tail = Promise.resolve();
  let pendingCount = 0;

  return {
    enqueue(task) {
      pendingCount += 1;
      const result = tail.catch(() => undefined).then(task);
      const trackedResult = result.finally(() => {
        pendingCount = Math.max(0, pendingCount - 1);
      });
      tail = trackedResult.catch(() => undefined);
      return trackedResult;
    },
    isBusy() {
      return pendingCount > 0;
    },
  };
}

/**
 * 저장 직전 null/undefined 필드 제거 (문서 용량 절감, spriteBasePath: null 등 불필요 저장 방지)
 * @param {Object} obj - 1depth 객체 (중첩 객체/배열은 그대로 유지)
 * @returns {Object} null/undefined가 제거된 새 객체
 */
function cleanObject(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  const result = { ...obj };
  Object.keys(result).forEach((key) => {
    if (result[key] === null || result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

function isGameTimestampKey(key) {
  return GAME_TIMESTAMP_KEYS.has(key);
}

function normalizeLogTimestamp(entry) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  const timestamp = toEpochMs(entry.timestamp);
  return timestamp == null ? entry : { ...entry, timestamp };
}

export function normalizeGameTimingFields(value, currentKey = null) {
  if (isGameTimestampKey(currentKey)) {
    return toEpochMs(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeGameTimingFields(entry));
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  const result = { ...value };
  Object.keys(result).forEach((key) => {
    result[key] = normalizeGameTimingFields(result[key], key);
  });
  return result;
}

export function resolveLastSavedAtSource(
  slotData = {},
  persistedStats = {},
  liveStats = {}
) {
  return (
    slotData.lastSavedAtServer ||
    slotData.lastSavedAt ||
    persistedStats.lastSavedAtServer ||
    persistedStats.lastSavedAt ||
    liveStats.lastSavedAt ||
    null
  );
}

/**
 * 슬롯 루트 전용 상태 필드 해석
 * newStats에 최신 값이 들어오면 그 값을 우선 사용하고, 없으면 현재 훅 상태를 fallback으로 사용합니다.
 *
 * @param {Object} newStats
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} currentRootState
 * @returns {{ isLightsOn: boolean, wakeUntil: number|null }}
 */
export function resolveRootSlotFields(newStats = {}, currentRootState = {}) {
  const resolvedWakeUntil =
    newStats.wakeUntil !== undefined
      ? newStats.wakeUntil
      : (currentRootState.wakeUntil ?? null);

  return {
    isLightsOn:
      newStats.isLightsOn !== undefined ? newStats.isLightsOn : currentRootState.isLightsOn,
    wakeUntil: toEpochMs(resolvedWakeUntil),
  };
}

/**
 * 슬롯 문서에 저장할 디지몬 표시명을 계산합니다.
 *
 * @param {string|null} digimonId
 * @param {string|null} digimonNickname
 * @param {Object|null} evolutionDataForSlot
 * @returns {string|null}
 */
export function buildDigimonDisplayName(
  digimonId,
  digimonNickname = null,
  evolutionDataForSlot = null
) {
  if (!digimonId) {
    return null;
  }

  const displayNameFromData = evolutionDataForSlot?.[digimonId]?.name;
  const baseDisplayName = displayNameFromData || digimonId;
  const nickname = typeof digimonNickname === "string" ? digimonNickname.trim() : "";

  return nickname ? `${nickname}(${baseDisplayName})` : baseDisplayName;
}

/**
 * 슬롯 루트 문서용 digimonStats payload를 정리합니다.
 *
 * @param {Object} stats
 * @returns {Object}
 */
export function sanitizeDigimonStatsForSlotDocument(stats = {}) {
  const {
    isLightsOn: _dropLights,
    wakeUntil: _dropWakeUntil,
    dailySleepMistake: _dropDailySleepMistake,
    lastSavedAt: _dropLastSavedAt,
    activityLogs: _dropActivityLogs,
    battleLogs: _dropBattleLogs,
    selectedDigimon: _dropSelectedDigimon,
    ...digimonStatsOnly
  } = stats || {};

  return cleanObject(normalizeGameTimingFields(digimonStatsOnly));
}

/**
 * pending과 서버 슬롯을 비교할 때 실제 슬롯 저장 직렬화 계약을 그대로 사용합니다.
 * 로그와 서버 커밋 timestamp/UI 필드는 sanitize 단계에서 제외됩니다.
 */
export function buildComparableSlotSnapshot({
  stats = {},
  selectedDigimon = null,
  rootSlotFields = { isLightsOn: true, wakeUntil: null },
} = {}) {
  const comparableRootFields = resolveRootSlotFields(stats, rootSlotFields);
  return {
    selectedDigimon: selectedDigimon || stats.selectedDigimon || null,
    digimonStats: sanitizeDigimonStatsForSlotDocument(stats),
    ...comparableRootFields,
  };
}

/**
 * 슬롯 루트 문서 update payload를 조립합니다.
 * saveStats / 사망 스냅샷 저장이 같은 저장 계약을 공유하도록 묶습니다.
 *
 * @param {Object} params
 * @param {Object} params.stats
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} params.rootSlotFields
 * @param {string|null} [params.selectedDigimon]
 * @param {string|null} [params.digimonNickname]
 * @param {Object|null} [params.evolutionDataForSlot]
 * @param {boolean} [params.isLoadingSlot]
 * @param {Object|undefined} [params.backgroundSettings]
 * @param {number} [params.nowMs]
 * @returns {Object}
 */
export function buildSlotDocumentUpdatePayload({
  stats = {},
  rootSlotFields = { isLightsOn: true, wakeUntil: null },
  selectedDigimon = null,
  digimonNickname = null,
  evolutionDataForSlot = null,
  isLoadingSlot = true,
  backgroundSettings,
  nowMs = Date.now(),
} = {}) {
  const updateData = {
    digimonStats: sanitizeDigimonStatsForSlotDocument(stats),
    ...rootSlotFields,
    dailySleepMistake: deleteField(),
    notificationEligible: resolveSlotNotificationEligible({
      selectedDigimon,
      stats,
      slotData: rootSlotFields,
      isLoadingSlot,
    }),
    lastSavedAt: toEpochMs(stats.lastSavedAt) ?? nowMs,
    lastSavedAtServer: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!isLoadingSlot && selectedDigimon) {
    updateData.selectedDigimon = selectedDigimon;
    updateData.digimonDisplayName = buildDigimonDisplayName(
      selectedDigimon,
      digimonNickname,
      evolutionDataForSlot
    );
  }

  if (backgroundSettings !== undefined) {
    updateData.backgroundSettings = backgroundSettings;
  }

  return updateData;
}

/**
 * 슬롯 로드 결과를 setter 입력용 hydration object로 조립합니다.
 * 이 단계에서는 setState를 하지 않고, 로드된 문서/로그를 어떤 상태로 반영할지만 계산합니다.
 *
 * @param {Object} params
 * @param {Object} params.slotData
 * @param {string|number} params.slotId
 * @param {string} params.slotVersionLabel
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} params.rootSlotFields
 * @param {Array} [params.activityLogs]
 * @param {string|null} [params.selectedDigimon]
 * @param {Object} [params.digimonStats]
 * @returns {Object}
 */
export function buildLoadedSlotHydrationResult({
  slotData = {},
  slotId,
  slotVersionLabel = "Ver.1",
  rootSlotFields = { isLightsOn: true, wakeUntil: null },
  activityLogs = [],
  selectedDigimon = null,
  digimonStats = {},
} = {}) {
  const resolvedSelectedDigimon =
    selectedDigimon || digimonStats?.selectedDigimon || null;

  return {
    slotName: slotData.slotName || `슬롯${slotId}`,
    slotCreatedAt: slotData.createdAt || "",
    slotDevice: slotData.device || "",
    slotVersion: slotVersionLabel,
    digimonNickname: slotData.digimonNickname || null,
    rootSlotFields: { ...rootSlotFields },
    backgroundSettings: slotData.backgroundSettings || { ...DEFAULT_BACKGROUND_SETTINGS },
    immersiveSettings: normalizeImmersiveSettings(slotData.immersiveSettings),
    activityLogs,
    selectedDigimon: resolvedSelectedDigimon,
    digimonStats: resolvedSelectedDigimon
      ? { ...digimonStats, selectedDigimon: resolvedSelectedDigimon }
      : digimonStats,
    deathReason: digimonStats?.deathReason || null,
  };
}

/**
 * 슬롯 문서가 없거나 로드에 실패했을 때 사용할 fallback 초기 상태를 조립합니다.
 *
 * @param {Object} params
 * @param {string|number} params.slotId
 * @param {Object} [params.dataMap]
 * @param {string} [params.slotVersionLabel]
 * @returns {Object}
 */
export function buildFallbackSlotHydrationResult({
  slotId,
  dataMap = {},
  slotVersionLabel = "Ver.1",
} = {}) {
  const selectedDigimon = getStarterDigimonIdFromDataMap(dataMap);
  const digimonStats = initializeStats(selectedDigimon, {}, dataMap);

  return {
    slotName: `슬롯${slotId}`,
    slotVersion: slotVersionLabel,
    selectedDigimon,
    digimonStats,
    backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
    immersiveSettings: { ...DEFAULT_IMMERSIVE_SETTINGS },
  };
}

/**
 * 슬롯의 activity/battle logs를 서브컬렉션 우선으로 읽고, 없으면 legacy 필드로 fallback 합니다.
 * 테스트에서는 loader 콜백을 주입해 I/O 없이 계약만 검증할 수 있습니다.
 *
 * @param {Object} params
 * @param {Object|null} [params.slotRef]
 * @param {number|string|null} [params.slotCreatedAt]
 * @param {Array} [params.legacyActivityLogs]
 * @param {Array} [params.legacyBattleLogs]
 * @param {Function} [params.loadActivityEntries]
 * @param {Function} [params.loadBattleEntries]
 * @returns {Promise<{ loadedActivityLogs: Array, loadedBattleLogs: Array }>}
 */
export async function loadSlotCollectionsState({
  slotRef = null,
  slotCreatedAt = null,
  legacyActivityLogs = [],
  legacyBattleLogs = [],
  loadActivityEntries,
  loadBattleEntries,
} = {}) {
  const fallbackActivityLogs = initializeActivityLogs(
    (legacyActivityLogs || []).map(normalizeLogTimestamp)
  );
  let loadedActivityLogs = fallbackActivityLogs;

  try {
    const activityEntries = loadActivityEntries
      ? await loadActivityEntries()
      : await (async () => {
          if (!slotRef) return [];
          const logsRef = collection(slotRef, "logs");
          const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(MAX_ACTIVITY_LOGS));
          const logsSnap = await getDocs(logsQuery);
          if (logsSnap.empty) {
            return [];
          }
          return logsSnap.docs.map((d) => normalizeLogTimestamp({ id: d.id, ...d.data() }));
        })();

    if (Array.isArray(activityEntries) && activityEntries.length > 0) {
      loadedActivityLogs = filterEntriesForSlotCreation(
        activityEntries.map(normalizeLogTimestamp),
        slotCreatedAt
      );
    }
  } catch (_e) {
    loadedActivityLogs = fallbackActivityLogs;
  }

  const fallbackBattleLogs = (legacyBattleLogs || []).map(normalizeLogTimestamp);
  let loadedBattleLogs = fallbackBattleLogs;

  try {
    const battleEntries = loadBattleEntries
      ? await loadBattleEntries()
      : await (async () => {
          if (!slotRef) return [];
          const battleLogsRef = collection(slotRef, "battleLogs");
          const battleLogsQuery = query(
            battleLogsRef,
            orderBy("timestamp", "desc"),
            limit(100)
          );
          const battleLogsSnap = await getDocs(battleLogsQuery);
          if (battleLogsSnap.empty) {
            return [];
          }
          return battleLogsSnap.docs.map((d) =>
            normalizeLogTimestamp({ id: d.id, ...d.data() })
          );
        })();

    if (Array.isArray(battleEntries) && battleEntries.length > 0) {
      loadedBattleLogs = filterEntriesForSlotCreation(
        battleEntries.map(normalizeLogTimestamp),
        slotCreatedAt
      );
    }
  } catch (_e) {
    loadedBattleLogs = fallbackBattleLogs;
  }

  return {
    loadedActivityLogs,
    loadedBattleLogs,
  };
}

/**
 * 로드한 activity/battle logs를 저장된 슬롯 스탯에 합칩니다.
 * 이 단계에서는 로그 컬렉션 병합과 legacy proteinCount cleanup 힌트만 반환합니다.
 *
 * @param {Object} params
 * @param {Object} [params.savedStats]
 * @param {Array} [params.loadedActivityLogs]
 * @param {Array} [params.loadedBattleLogs]
 * @returns {{ savedStats: Object, needsProteinCountCleanup: boolean }}
 */
export function buildLoadedSlotCollectionsState({
  savedStats = {},
  loadedActivityLogs = [],
  loadedBattleLogs = [],
} = {}) {
  const nextSavedStats = {
    ...savedStats,
    activityLogs: [...loadedActivityLogs].reverse(),
    battleLogs: loadedBattleLogs.map(normalizeLogTimestamp),
  };
  const needsProteinCountCleanup = nextSavedStats.proteinCount !== undefined;

  if (needsProteinCountCleanup) {
    delete nextSavedStats.proteinCount;
  }

  return {
    savedStats: nextSavedStats,
    needsProteinCountCleanup,
  };
}

/**
 * 저장된 슬롯 스탯을 runtime 상태로 재구성합니다.
 * Firestore read/write나 setter 호출 없이, 기존 저장본을 메모리 상태로 복원하는 계산만 담당합니다.
 *
 * @param {Object} params
 * @param {Object} params.slotData
 * @param {string} params.savedName
 * @param {Object} params.savedStats
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} params.rootSlotFields
 * @param {Object} [params.dataMap]
 * @param {Object} [params.slotRuntimeDataMap]
 * @param {Object} [params.runtimeAdaptedDataMaps]
 * @param {Object|null} [params.evolutionDataForSlot]
 * @returns {{ digimonStats: Object, reconstructedLogsToPersist: Array }}
 */
export function buildLoadedSlotRuntimeState({
  slotData = {},
  savedName,
  savedStats = {},
  rootSlotFields = { isLightsOn: true, wakeUntil: null },
  dataMap = null,
  slotRuntimeDataMap = null,
  runtimeAdaptedDataMaps = {},
  evolutionDataForSlot = null,
} = {}) {
  const lazyUpdateBaseStats = resolveLazyUpdateBaseStats(
    savedStats,
    {},
    rootSlotFields
  );
  const lastSavedAt =
    resolveLastSavedAtSource(slotData, lazyUpdateBaseStats) ?? Date.now();

  let sleepSchedule = null;
  let maxEnergy = null;

  if (dataMap && savedName) {
    sleepSchedule = getSleepSchedule(savedName, dataMap, lazyUpdateBaseStats);
    const digimonData = dataMap[savedName];

    if (digimonData) {
      maxEnergy =
        digimonData.stats?.maxEnergy ??
        lazyUpdateBaseStats.maxEnergy ??
        lazyUpdateBaseStats.maxStamina ??
        0;
    }

    if (isStarterDigimonId(savedName) && digimonData?.timeToEvolveSeconds != null) {
      const tte = lazyUpdateBaseStats.timeToEvolveSeconds;
      if (tte === undefined || tte === null || tte === 0 || Number.isNaN(tte)) {
        lazyUpdateBaseStats.timeToEvolveSeconds =
          digimonData.timeToEvolveSeconds;
      }
    }
  }

  const lazyUpdateResult = buildLazyUpdateRuntimeResult({
    baseStats: lazyUpdateBaseStats,
    lastSavedAt,
    sleepSchedule,
    maxEnergy,
    selectedDigimon: savedName,
    evolutionDataForSlot,
    dataMap,
    slotRuntimeDataMap,
    runtimeAdaptedDataMaps,
  });
  const digimonStats = lazyUpdateResult.digimonStats;
  const reconstructedLogsToPersist = lazyUpdateResult.reconstructedLogsToPersist;

  if (dataMap && savedName && dataMap[savedName]) {
    const expectedSprite = dataMap[savedName].sprite;
    if (expectedSprite !== undefined && digimonStats.sprite !== expectedSprite) {
      console.warn("[buildLoadedSlotRuntimeState] 스프라이트 불일치 감지 및 수정:", {
        selectedDigimon: savedName,
        savedSprite: digimonStats.sprite,
        expectedSprite,
      });
      digimonStats.sprite = expectedSprite;
    }
  }

  return {
    digimonStats,
    reconstructedLogsToPersist,
  };
}

/**
 * 로드한 슬롯의 starter-init / saved-runtime 분기를 한 번에 계산합니다.
 * Firestore write나 setter 호출 없이 hydration 결과와 재구성 로그만 반환합니다.
 *
 * @param {Object} params
 * @param {Object} params.slotData
 * @param {string|number} params.slotId
 * @param {string} params.slotVersionLabel
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} params.rootSlotFields
 * @param {Array} [params.loadedActivityLogs]
 * @param {string} params.savedName
 * @param {Object} [params.savedStats]
 * @param {Object|null} [params.dataMap]
 * @param {Object|null} [params.slotRuntimeDataMap]
 * @param {Object} [params.runtimeAdaptedDataMaps]
 * @param {Object|null} [params.evolutionDataForSlot]
 * @returns {{ hydrationResult: Object, reconstructedLogsToPersist: Array }}
 */
export function buildLoadedSlotHydrationPlan({
  slotData = {},
  slotId,
  slotVersionLabel = "Ver.1",
  rootSlotFields = { isLightsOn: true, wakeUntil: null },
  loadedActivityLogs = [],
  savedName,
  savedStats = {},
  dataMap = null,
  slotRuntimeDataMap = null,
  runtimeAdaptedDataMaps = {},
  evolutionDataForSlot = null,
} = {}) {
  if (Object.keys(savedStats).length === 0) {
    const nowMs = Date.now();
    const digimonStats = initializeStats(savedName, {}, dataMap);
    digimonStats.birthTime = nowMs;
    digimonStats.lastSavedAt = nowMs;

    return {
      hydrationResult: buildLoadedSlotHydrationResult({
        slotData,
        slotId,
        slotVersionLabel,
        rootSlotFields,
        activityLogs: loadedActivityLogs,
        selectedDigimon: savedName,
        digimonStats,
      }),
      reconstructedLogsToPersist: [],
    };
  }

  const runtimeState = buildLoadedSlotRuntimeState({
    slotData,
    savedName,
    savedStats,
    rootSlotFields,
    dataMap,
    slotRuntimeDataMap,
    runtimeAdaptedDataMaps,
    evolutionDataForSlot,
  });

  return {
    hydrationResult: buildLoadedSlotHydrationResult({
      slotData,
      slotId,
      slotVersionLabel,
      rootSlotFields,
      activityLogs: loadedActivityLogs,
      selectedDigimon: savedName,
      digimonStats: runtimeState.digimonStats,
    }),
    reconstructedLogsToPersist: runtimeState.reconstructedLogsToPersist,
  };
}

/**
 * lazy update 적용 후 care mistake ledger를 복구하고, 새로 생긴 로그만 분리해 반환합니다.
 * loadSlot과 action 직전 lazy update가 같은 계산 코어를 공유하도록 묶습니다.
 *
 * @param {Object} params
 * @param {Object} params.baseStats
 * @param {number} params.lastSavedAt
 * @param {Object|null} [params.sleepSchedule]
 * @param {number|null} [params.maxEnergy]
 * @param {string|null} [params.selectedDigimon]
 * @param {Object|null} [params.evolutionDataForSlot]
 * @param {Object|null} [params.dataMap]
 * @param {Object|null} [params.slotRuntimeDataMap]
 * @param {Object} [params.runtimeAdaptedDataMaps]
 * @returns {{ digimonStats: Object, reconstructedLogsToPersist: Array }}
 */
export function buildLazyUpdateRuntimeResult({
  baseStats = {},
  lastSavedAt,
  sleepSchedule = null,
  maxEnergy = null,
  selectedDigimon = null,
  evolutionDataForSlot = null,
  dataMap = null,
  slotRuntimeDataMap = null,
  runtimeAdaptedDataMaps = {},
} = {}) {
  const prevLogCount = Array.isArray(baseStats.activityLogs)
    ? baseStats.activityLogs.length
    : 0;
  const digimonSnapshot = buildDigimonLogSnapshot(
    selectedDigimon || baseStats.selectedDigimon || null,
    evolutionDataForSlot,
    dataMap,
    slotRuntimeDataMap,
    ...Object.values(runtimeAdaptedDataMaps)
  );
  const digimonStats = normalizeGameTimingFields(
    repairCareMistakeLedger(
      applyLazyUpdate(baseStats, lastSavedAt, sleepSchedule, maxEnergy, {
        digimonSnapshot,
      }),
      baseStats.activityLogs || []
    ).nextStats
  );

  return {
    digimonStats,
    reconstructedLogsToPersist: (digimonStats.activityLogs || []).slice(prevLogCount),
  };
}

function resolveDefaultSleepScheduleByStage(stage = "Digitama") {
  if (stage === "Digitama" || stage === "Baby I" || stage === "Baby II") {
    return { start: 20, end: 8 };
  }

  if (stage === "Child") {
    return { start: 21, end: 7 };
  }

  if (stage === "Adult" || stage === "Perfect") {
    return { start: 22, end: 6 };
  }

  return { start: 23, end: 7 };
}

/**
 * 액션 직전 lazy update에 필요한 현재 디지몬 runtime context를 계산합니다.
 * 기존 applyLazyUpdateForAction의 evolutionStage 기반 탐색 규칙을 그대로 유지합니다.
 *
 * @param {Object} params
 * @param {Object} [params.digimonStats]
 * @param {Object|null} [params.slotRuntimeDataMap]
 * @returns {{ currentDigimonName: string, sleepSchedule: Object|null, maxEnergy: number|null }}
 */
export function resolveActionLazyUpdateRuntimeContext({
  digimonStats = {},
  slotRuntimeDataMap = null,
  selectedDigimon = null,
} = {}) {
  const preferredDigimonId = selectedDigimon || digimonStats.selectedDigimon || null;
  const currentDigimonName = slotRuntimeDataMap
    ? (preferredDigimonId && slotRuntimeDataMap[preferredDigimonId]
        ? preferredDigimonId
        : digimonStats.evolutionStage
        ? Object.keys(slotRuntimeDataMap).find(
            (key) => slotRuntimeDataMap[key]?.evolutionStage === digimonStats.evolutionStage
          ) || "Digitama"
        : "Digitama")
    : "Digitama";

  const digimonData = slotRuntimeDataMap?.[currentDigimonName];
  if (!digimonData) {
    return {
      currentDigimonName,
      sleepSchedule: null,
      maxEnergy: null,
    };
  }

  const sleepSchedule =
    digimonData.stats?.sleepSchedule ||
    digimonData.sleepSchedule ||
    resolveDefaultSleepScheduleByStage(
      digimonData.stage || digimonStats.evolutionStage || "Digitama"
    );

  return {
    currentDigimonName,
    sleepSchedule,
    maxEnergy:
      digimonData.stats?.maxEnergy ??
      digimonStats.maxEnergy ??
      digimonStats.maxStamina ??
      0,
  };
}

/**
 * 액션 직전 lazy update 계산용 기준 스탯을 조합합니다.
 * 저장 시각은 Firestore 문서를 기준으로 삼고, 최신 로그/루트 상태는 메모리 값을 우선합니다.
 *
 * @param {Object} persistedStats
 * @param {Object} liveStats
 * @param {{ isLightsOn: boolean, wakeUntil: number|null }} currentRootState
 * @returns {Object}
 */
export function resolveLazyUpdateBaseStats(
  persistedStats = {},
  liveStats = {},
  currentRootState = {}
) {
  const rootSlotFields = resolveRootSlotFields(liveStats, currentRootState);
  const liveActivityLogs = Array.isArray(liveStats.activityLogs) ? liveStats.activityLogs : null;
  const liveBattleLogs = Array.isArray(liveStats.battleLogs) ? liveStats.battleLogs : null;

  return normalizeGameTimingFields({
    ...persistedStats,
    ...rootSlotFields,
    activityLogs:
      liveActivityLogs ||
      (Array.isArray(persistedStats.activityLogs) ? persistedStats.activityLogs : []),
    battleLogs:
      liveBattleLogs ||
      (Array.isArray(persistedStats.battleLogs) ? persistedStats.battleLogs : []),
    selectedDigimon:
      liveStats.selectedDigimon || persistedStats.selectedDigimon || null,
  });
}

/**
 * useGameData Hook
 * 데이터 저장/로딩 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {string} params.slotId - 슬롯 ID
 * @param {Object} params.currentUser - 현재 사용자 (Firebase Auth)
 * @param {Object|null} params.currentUser - 현재 사용자 (Firebase Auth, 필수)
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Function} params.setSelectedDigimon - 선택된 디지몬 설정 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Function} params.setSlotName - 슬롯 이름 설정 함수
 * @param {Function} params.setSlotCreatedAt - 슬롯 생성일 설정 함수
 * @param {Function} params.setSlotDevice - 슬롯 기종 설정 함수
 * @param {Function} params.setSlotVersion - 슬롯 버전 설정 함수
 * @param {Function} params.setIsLightsOn - 불 켜짐 상태 설정 함수
 * @param {Function} params.setWakeUntil - 깨울 때까지 시간 설정 함수
 * @param {Function} params.setIsLoadingSlot - 로딩 상태 설정 함수
 * @param {Function} params.setDeathReason - 사망 사유 설정 함수
 * @param {Function} params.toggleModal - 모달 토글 함수
 * @param {Object} params.digimonDataVer1 - 현재 슬롯의 런타임 데이터 맵 (adapted 호환)
 * @param {Object} [params.adaptedDataMapsByVersion] - 버전별 adapted 데이터 맵
 * @param {boolean} params.isFirebaseAvailable - Firebase 사용 가능 여부
 * @param {Function} params.navigate - 네비게이션 함수
 * @param {string} [params.selectedDigimon] - 현재 선택된 디지몬 ID (digimonDisplayName 계산용)
 * @param {string|null} [params.digimonNickname] - 현재 슬롯의 디지몬 별명 (있으면 "별명(한글명)" 형태로 저장)
 * @param {string} [params.slotVersion] - 슬롯 버전 (Ver.1 | Ver.2, 데이터 맵 선택용)
 * @param {boolean} [params.isLoadingSlot] - 슬롯 로딩 중 여부 (로드 완료 전 digimonDisplayName 저장 방지용)
 * @param {Object} [params.evolutionDataForSlot] - 진화용 원본 데이터 맵 (한글명 .name 포함, adapted가 아님). 없으면 selectedDigimon+버전으로 fallback
 * @returns {Object} saveStats, applyLazyUpdate, isLoading, error
 */
export function useGameData({
  slotId,
  currentUser,
  digimonStats,
  setDigimonStats,
  setSelectedDigimon,
  setActivityLogs,
  setSlotName,
  setSlotCreatedAt,
  setSlotDevice,
  setSlotVersion,
  setDigimonNickname,
  setIsLightsOn,
  setWakeUntil,
  setIsLoadingSlot,
  setDeathReason,
  toggleModal,
  digimonDataVer1,
  adaptedDataMapsByVersion,
  isFirebaseAvailable,
  navigate,
  // 추가 상태들 (applyLazyUpdateBeforeAction에서 사용)
  isLightsOn,
  wakeUntil,
  activityLogs,
  // 배경화면 설정
  backgroundSettings,
  setBackgroundSettings,
  setImmersiveSettings,
  // 디지몬 표시명 (구글 스크립트/Discord 알림용 - 슬롯 문서 digimonDisplayName)
  selectedDigimon = null,
  digimonNickname = null,
  slotVersion = "Ver.1",
  isLoadingSlot = true, // 기본 true: 로드 완료 전에는 digimonDisplayName 쓰지 않음
  evolutionDataForSlot = null, // 한글명 .name 포함된 원본 맵 (adapted 맵에는 name 없음)
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slotLoadError, setSlotLoadError] = useState(null);
  const [slotLoadRetryRevision, setSlotLoadRetryRevision] = useState(0);
  const [persistencePhase, setPersistencePhase] = useState(GAME_PERSISTENCE_PHASE.IDLE);
  const persistenceAccessRef = useRef({
    phase: GAME_PERSISTENCE_PHASE.IDLE,
    generation: 0,
    loadedIdentity: null,
  });
  const updatePersistenceAccess = useCallback((patch) => {
    persistenceAccessRef.current = { ...persistenceAccessRef.current, ...patch };
    if (patch.phase) setPersistencePhase(patch.phase);
  }, []);
  const saveQueueRef = useRef(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = createGameSaveQueue();
  }
  const slotRuntimeDataMap = digimonDataVer1;
  const runtimeAdaptedDataMaps = useMemo(
    () => adaptedDataMapsByVersion || {},
    [adaptedDataMapsByVersion]
  );
  const getAdaptedDataMap = useCallback(
    (versionLabel = "Ver.1") =>
      runtimeAdaptedDataMaps[normalizeDigimonVersionLabel(versionLabel)] ||
      slotRuntimeDataMap,
    [runtimeAdaptedDataMaps, slotRuntimeDataMap]
  );

  const buildUpdateDataForSnapshot = useCallback((statsSnapshot, nowMs = Date.now()) => {
    // stats snapshot 안의 selectedDigimon은 다음 형태를 미리 담을 수 있다.
    // top-level 형태 변경은 saveSelectedDigimon transaction에서 combatRevision과 함께만 쓴다.
    const effectiveSelectedDigimon = selectedDigimon || null;
    const rootSlotFields = resolveRootSlotFields(statsSnapshot, {
      isLightsOn,
      wakeUntil,
    });

    return buildSlotDocumentUpdatePayload({
      stats: statsSnapshot,
      rootSlotFields,
      selectedDigimon: effectiveSelectedDigimon,
      digimonNickname,
      evolutionDataForSlot,
      isLoadingSlot,
      nowMs,
    });
  }, [
    digimonNickname,
    evolutionDataForSlot,
    isLightsOn,
    isLoadingSlot,
    selectedDigimon,
    wakeUntil,
  ]);

  const {
    appendBattleLog: appendBattleLogToSubcollection,
    appendLog: appendLogToSubcollection,
    canStartGameplayWrite,
    captureSaveContext,
    clearPendingStateAfterHydration,
    flushOutbox,
    getPendingState,
    persistStateSnapshot,
    quarantinePendingState,
    refreshGameRevision,
    resolveSyncConflict,
    setLoadedRevision,
    syncConflict,
    nextRecordSyncAt,
    nextStateSyncAt,
    pendingRecordCount,
    recordSyncStatus,
    retryAt,
    lastStateSyncedAt,
    lastRecordSyncedAt,
    stateSyncError,
    recordSyncError,
    stateSyncStatus,
    localPersistenceStatus,
  } = useDurableGamePersistence({
    slotId,
    currentUser,
    isFirebaseAvailable,
    isLoadingSlot,
    digimonStats,
    activityLogs,
    selectedDigimon,
    isLightsOn,
    wakeUntil,
    setDigimonStats,
    buildUpdateDataForSnapshot,
    normalizeStats: normalizeGameTimingFields,
    saveQueue: saveQueueRef.current,
    persistenceAccessRef,
    onPersistenceAccessChange: updatePersistenceAccess,
  });

  const retrySlotLoad = useCallback(() => {
    // 현재 요청을 즉시 stale 처리해 effect 재실행 전의 늦은 응답도 반영되지 않게 한다.
    updatePersistenceAccess(createNextSlotLoadAccess(persistenceAccessRef.current));
    setLoadedRevision(null, null);
    setSlotLoadError(null);
    setError(null);
    setIsLoadingSlot(true);
    setIsLoading(true);
    setSlotLoadRetryRevision((revision) => revision + 1);
  }, [setIsLoadingSlot, setLoadedRevision, updatePersistenceAccess]);

  /**
   * 스탯을 저장하는 함수 (Firestore 또는 localStorage)
   * @param {Object} newStats - 새로운 스탯
   * @param {Array} updatedLogs - 업데이트된 로그 (선택적)
   */
  async function executeSaveStats(newStats, updatedLogs = null, saveContext = null) {
    // 예약 이후 슬롯/사용자/세대가 바뀌었으면 React setter를 포함해 아무 작업도 하지 않는다.
    if (!canStartGameplayWrite(saveContext)) return false;
    // 새로운 시작인지 확인 (isDead가 false로 명시적으로 설정되고, evolutionStage가 Digitama인 경우)
    const isNewStart = newStats.isDead === false && 
                       newStats.evolutionStage === "Digitama" && 
                       newStats.totalReincarnations !== undefined;
    
    console.log("[saveStats] 호출:", {
      isNewStart,
      isDead: newStats.isDead,
      evolutionStage: newStats.evolutionStage,
      totalReincarnations: newStats.totalReincarnations,
    });
    
    // newStats에서 중요한 필드들을 먼저 보존 (applyLazyUpdate가 덮어쓸 수 있음)
    const preservedStats = {
      strength: newStats.strength !== undefined ? newStats.strength : undefined,
      weight: newStats.weight !== undefined ? newStats.weight : undefined,
      fullness: newStats.fullness !== undefined ? newStats.fullness : undefined,
      energy: newStats.energy !== undefined ? newStats.energy : undefined,
      // proteinCount 제거됨 - strength로 통합
      proteinOverdose: newStats.proteinOverdose !== undefined ? newStats.proteinOverdose : undefined,
      consecutiveMeatFed: newStats.consecutiveMeatFed !== undefined ? newStats.consecutiveMeatFed : undefined,
      overfeeds: newStats.overfeeds !== undefined ? newStats.overfeeds : undefined,
      hungerCountdown: newStats.hungerCountdown !== undefined ? newStats.hungerCountdown : undefined,
      // 새로운 시작일 때 사망 관련 필드 보존
      isDead: isNewStart ? false : undefined,
      diedAt: isNewStart ? null : undefined,
      lastHungerZeroAt: isNewStart ? null : undefined,
      hungerZeroFrozenDurationMs: isNewStart ? 0 : undefined,
      lastStrengthZeroAt: isNewStart ? null : undefined,
      strengthZeroFrozenDurationMs: isNewStart ? 0 : undefined,
      injuredAt: isNewStart ? null : undefined,
      injuryFrozenDurationMs: isNewStart ? 0 : undefined,
      isInjured: isNewStart ? false : undefined,
      // 새로운 시작일 때 똥 초기화
      poopCount: isNewStart ? 0 : undefined,
      poopReachedMaxAt: isNewStart ? null : undefined,
      lastPoopPenaltyAt: isNewStart ? null : undefined,
      poopPenaltyFrozenDurationMs: isNewStart ? 0 : undefined,
    };
    
    // 새로운 시작이면 applyLazyUpdate를 건너뛰고 newStats를 직접 사용
    let baseStats;
    if (isNewStart) {
      console.log("[saveStats] 새로운 시작 감지 - applyLazyUpdate 건너뜀");
      baseStats = { ...digimonStats, ...newStats };
    } else {
      baseStats = await applyLazyUpdateForAction();
    }
    if (!canStartGameplayWrite(saveContext)) return false;
    const nowMs = Date.now();
    
    // Activity Logs 처리: 함수형 업데이트로 확실히 누적
    let finalLogs;
    if (updatedLogs !== null) {
      // updatedLogs는 이미 addActivityLog로 생성된 배열 (이전 로그 포함)
      finalLogs = updatedLogs;
      // setActivityLogs를 함수형 업데이트로 호출하여 이전 로그 보존 보장
      setActivityLogs((prevLogs) => {
        // updatedLogs가 이미 이전 로그를 포함하고 있어야 하지만,
        // 혹시 모를 상황을 대비해 최신 상태 확인 후 반환
        // updatedLogs는 addActivityLog로 생성되었으므로 이전 로그를 포함하고 있음
        return updatedLogs;
      });
    } else {
      // updatedLogs가 null이면 이전 로그 유지
      finalLogs = baseStats.activityLogs || activityLogs || [];
      setActivityLogs((prevLogs) => {
        // 이전 로그가 없으면 빈 배열로 초기화
        return prevLogs || [];
      });
    }
    
    // preservedStats의 값들을 우선 적용 (undefined가 아닌 경우만)
    const mergedStats = { ...baseStats };
    Object.keys(preservedStats).forEach(key => {
      if (preservedStats[key] !== undefined) {
        mergedStats[key] = preservedStats[key];
      }
    });
    
    // 새로운 시작일 때는 newStats의 사망 관련 필드를 확실히 보존
    const effectiveSelectedDigimon =
      newStats.selectedDigimon ||
      digimonStats?.selectedDigimon ||
      selectedDigimon ||
      null;
    const rootSlotFields = resolveRootSlotFields(newStats, {
      isLightsOn,
      wakeUntil,
    });

    const finalStats = {
      ...mergedStats,
      ...newStats, // newStats의 모든 필드를 최종적으로 덮어씀
      // 새로운 시작일 때 사망 관련 필드 강제 보존
      ...(isNewStart ? {
        isDead: false,
        diedAt: null,
        lastHungerZeroAt: null,
        hungerZeroFrozenDurationMs: 0,
        lastStrengthZeroAt: null,
        strengthZeroFrozenDurationMs: 0,
        injuredAt: null,
        injuryFrozenDurationMs: 0,
        isInjured: false,
        injuries: 0,
        poopCount: 0,
        poopReachedMaxAt: null,
        lastPoopPenaltyAt: null,
        poopPenaltyFrozenDurationMs: 0,
      } : {}),
      activityLogs: finalLogs, // activityLogs를 finalStats에 포함
      ...rootSlotFields,
      lastSavedAt: nowMs,
    };
    const repairedFinalStats = normalizeGameTimingFields(
      repairCareMistakeLedger(finalStats, finalLogs).nextStats
    );
    
    console.log("[saveStats] finalStats:", {
      isNewStart,
      isDead: finalStats.isDead,
      lastHungerZeroAt: finalStats.lastHungerZeroAt,
      lastStrengthZeroAt: finalStats.lastStrengthZeroAt,
      evolutionStage: finalStats.evolutionStage,
    });

    // proteinCount 필드 제거 (strength로 통합됨)
    const { proteinCount, lastMaxPoopTime, ...statsWithoutProteinCount } = repairedFinalStats;
    if (proteinCount !== undefined) {
      console.log("[saveStats] proteinCount 필드 제거됨:", proteinCount);
    }
    void lastMaxPoopTime;

    const statsForState = effectiveSelectedDigimon
      ? { ...statsWithoutProteinCount, selectedDigimon: effectiveSelectedDigimon }
      : statsWithoutProteinCount;

    setDigimonStats(statsForState);

    // Firebase 로그인 필수
    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const didPersist = await persistStateSnapshot({
          statsSnapshot: statsForState,
          updatedLogs,
          nowMs,
          saveContext,
        });
        if (!didPersist) {
          const conflictError = new Error("다른 기기의 변경사항 확인이 필요합니다.");
          conflictError.code = "game/revision-conflict-pending";
          throw conflictError;
        }
        evaluateSlotUrgentNotification(currentUser, slotId).catch((error) => {
          console.warn("[saveStats] 즉시 긴급 알림 평가 실패:", error);
        });
      } catch (error) {
        console.error("스탯 저장 오류:", error);
        raiseGameSaveError(error, setError);
      }
    } else if (slotId) {
      // Firebase 로그인 필수: 로그인하지 않은 경우 에러
      const authError = new Error("Firebase 로그인이 필요합니다.");
      console.error("Firebase 로그인이 필요합니다.");
      setError(authError);
    }
    return true;
  }

  function saveStats(newStats, updatedLogs = null) {
    const saveContext = captureSaveContext();
    return saveQueueRef.current.enqueue(() =>
      executeSaveStats(newStats, updatedLogs, saveContext)
    );
  }
  saveStats.isInFlight = () => saveQueueRef.current.isBusy();

  /**
   * 액션 전에 Lazy Update 적용하는 헬퍼 함수
   * @returns {Promise<Object>} 업데이트된 스탯
   */
  async function applyLazyUpdateForAction() {
    if (!slotId) {
      return digimonStats;
    }

    const { sleepSchedule, maxEnergy } = resolveActionLazyUpdateRuntimeContext({
      digimonStats,
      slotRuntimeDataMap,
      selectedDigimon,
    });

    // Firebase 로그인 필수
    if (!currentUser || !isFirebaseAvailable) {
      return digimonStats;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if (slotSnap.exists()) {
        const slotData = slotSnap.data();
        const persistedStats = normalizeGameTimingFields(slotData.digimonStats || {});
        const lastSavedAt =
          resolveLastSavedAtSource(slotData, persistedStats, digimonStats) ??
          Date.now();
        const baseStats = resolveLazyUpdateBaseStats(persistedStats, digimonStats, {
          isLightsOn,
          wakeUntil,
        });
        const lazyUpdateResult = buildLazyUpdateRuntimeResult({
          baseStats,
          lastSavedAt,
          sleepSchedule,
          maxEnergy,
          selectedDigimon:
            baseStats.selectedDigimon || selectedDigimon || digimonStats?.selectedDigimon || null,
          evolutionDataForSlot,
          slotRuntimeDataMap,
          runtimeAdaptedDataMaps,
        });
        const updated = lazyUpdateResult.digimonStats;

        // 과거 재구성 시 추가된 로그(부상/케어미스)를 서브컬렉션에 반영
        lazyUpdateResult.reconstructedLogsToPersist.forEach((log) => {
          if (log?.type) appendLogToSubcollection(log).catch(() => {});
        });

        // 사망 상태 변경 감지
        checkDeathStatus(updated);

        return updated;
      }
    } catch (error) {
      console.error("Lazy Update 적용 오류:", error);
      setError(error);
    }

    return digimonStats;
  }

  /**
   * 사망 상태 변경 감지 및 처리
   * @param {Object} updated - 업데이트된 스탯
   */
  function checkDeathStatus(updated) {
    if (!digimonStats.isDead && updated.isDead) {
      const deathEvaluation = evaluateDeathConditions(updated, Date.now());
      const reason = updated.deathReason ?? deathEvaluation.reason;
      
      if (reason) {
        updated.deathReason = reason; // digimonStats에 저장
        setDeathReason(reason);
      }
      if (deathEvaluation.diedAt != null) {
        updated.diedAt = deathEvaluation.diedAt;
      }
      // 사망 팝업 표시 (hasSeenDeathPopup은 useGameState에서 관리)
      toggleModal('deathModal', true);
    }
  }

  /**
   * 슬롯 데이터 로드 (useEffect 내부에서 호출)
   */
  useEffect(() => {
    if (!slotId) return;

    const nextLoadAccess = createNextSlotLoadAccess(persistenceAccessRef.current);
    const generation = nextLoadAccess.generation;
    updatePersistenceAccess(nextLoadAccess);
    setLoadedRevision(null, null);

    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      setIsLoadingSlot(false);
      navigate("/");
      return;
    }

    // Firestore에서 슬롯 로드
    const loadSlot = async () => {
      setIsLoadingSlot(true);
      setIsLoading(true);
      setError(null);
      setSlotLoadError(null);
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const slotSnap = await getDoc(slotRef);
        if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
        
        if (slotSnap.exists()) {
          const slotData = slotSnap.data();
          const rootSlotFields = resolveRootSlotFields(slotData, {
            isLightsOn: true,
            wakeUntil: null,
          });
          const slotVersionLabel = normalizeDigimonVersionLabel(slotData.version || "Ver.1");
          let hydrationResult = null;
          
          // 버전별 데이터 맵 (로드 시점에 slotData.version 기준으로 선택 — slotVersion 상태는 아직 반영 전)
          const dataMap = getAdaptedDataMap(slotVersionLabel);
          const savedName =
            slotData.selectedDigimon || getStarterDigimonId(slotVersionLabel);
          let savedStats = normalizeGameTimingFields(slotData.digimonStats || {});
          
          const slotRefForLogs = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
          const { loadedActivityLogs, loadedBattleLogs } =
            await loadSlotCollectionsState({
              slotRef: slotRefForLogs,
              slotCreatedAt: slotData.createdAt,
              legacyActivityLogs: savedStats.activityLogs || slotData.activityLogs || [],
              legacyBattleLogs: savedStats.battleLogs || [],
            });
          if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;

          const loadedCollectionsState = buildLoadedSlotCollectionsState({
            savedStats,
            loadedActivityLogs,
            loadedBattleLogs,
          });
          savedStats = loadedCollectionsState.savedStats;

          // hydration 중에는 정리 쓰기를 하지 않는다. 다음 정상 저장 payload에서 제거된다.

          const hydrationPlan = buildLoadedSlotHydrationPlan({
            slotData,
            slotId,
            slotVersionLabel,
            rootSlotFields,
            loadedActivityLogs,
            savedName,
            savedStats,
            dataMap,
            slotRuntimeDataMap,
            runtimeAdaptedDataMaps,
            evolutionDataForSlot,
          });
          hydrationResult = hydrationPlan.hydrationResult;
          setLoadedRevision(
            slotData.revision ?? 0,
            hydrationResult?.digimonStats || savedStats
          );

          const reconstructedLogsToPersist = [
            ...(hydrationPlan.reconstructedLogsToPersist || []),
          ];
          {
            let pendingState = null;
            try {
              pendingState = await getPendingState();
            } catch (localPersistenceError) {
              console.warn("로컬 pending 조회 오류:", localPersistenceError);
            }
            if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
            const pendingHydration = resolvePendingHydration({
              pendingState,
              serverRevision: slotData.revision,
              serverHydrationResult: hydrationResult,
              localComparableSnapshot: pendingState?.state?.stateSnapshot
                ? buildComparableSlotSnapshot({
                    stats: pendingState.state.stateSnapshot,
                    selectedDigimon: pendingState.state.stateSnapshot.selectedDigimon,
                    rootSlotFields: hydrationResult.rootSlotFields,
                  })
                : null,
              serverComparableSnapshot: buildComparableSlotSnapshot({
                // canonical 비교는 lazy update 이후 runtime이 아니라 Firestore 저장본을 사용한다.
                stats: savedStats,
                selectedDigimon: savedName,
                rootSlotFields,
              }),
            });
            if (pendingHydration.status === PENDING_HYDRATION_STATUS.CONFLICT) {
              quarantinePendingState(pendingState, {
                expectedRevision: pendingHydration.expectedRevision,
                actualRevision: pendingHydration.actualRevision,
                remoteData: slotData,
                reason: pendingHydration.reason,
                classification: pendingHydration.classification,
                localSavedAt: pendingHydration.localSavedAt,
              });
            } else if (pendingHydration.status === PENDING_HYDRATION_STATUS.CLEANUP) {
              try {
                await clearPendingStateAfterHydration(pendingState, { generation });
              } catch (cleanupError) {
                console.warn("동일한 로컬 pending 정리 오류:", cleanupError);
              }
            } else if (pendingHydration.status === PENDING_HYDRATION_STATUS.APPLY) {
              const { sleepSchedule, maxEnergy } = resolveActionLazyUpdateRuntimeContext({
                digimonStats: pendingHydration.digimonStats,
                slotRuntimeDataMap,
                selectedDigimon: pendingHydration.selectedDigimon,
              });
              const pendingRuntime = buildLazyUpdateRuntimeResult({
                baseStats: pendingHydration.digimonStats,
                lastSavedAt: pendingHydration.lastSavedAt ?? Date.now(),
                sleepSchedule,
                maxEnergy,
                selectedDigimon: pendingHydration.selectedDigimon,
                evolutionDataForSlot,
                dataMap,
                slotRuntimeDataMap,
                runtimeAdaptedDataMaps,
              });
              hydrationResult = {
                ...hydrationResult,
                selectedDigimon: pendingHydration.selectedDigimon,
                rootSlotFields: resolveRootSlotFields(
                  pendingRuntime.digimonStats,
                  hydrationResult.rootSlotFields
                ),
                activityLogs: pendingHydration.activityLogs,
                digimonStats: pendingRuntime.digimonStats,
                deathReason:
                  pendingRuntime.digimonStats.deathReason || hydrationResult.deathReason,
              };
              reconstructedLogsToPersist.push(
                ...(pendingRuntime.reconstructedLogsToPersist || [])
              );
            }
          }

          // 로드 직후에는 Firestore 쓰기 하지 않음 (Lazy Update는 메모리만 반영, 다음 액션 시 saveStats에서 저장)
          // updatedAt이 불필요하게 자주 바뀌는 것과 비용 절감을 위해 제거

          if (hydrationResult) {
            if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
            setSlotName(hydrationResult.slotName);
            setSlotCreatedAt(hydrationResult.slotCreatedAt);
            setSlotDevice(hydrationResult.slotDevice);
            setSlotVersion(hydrationResult.slotVersion);
            setDigimonNickname(hydrationResult.digimonNickname);
            setIsLightsOn(hydrationResult.rootSlotFields.isLightsOn);
            setWakeUntil(hydrationResult.rootSlotFields.wakeUntil);
            setActivityLogs(hydrationResult.activityLogs);
            setSelectedDigimon(hydrationResult.selectedDigimon);
            setDigimonStats(hydrationResult.digimonStats);

            if (setBackgroundSettings) {
              setBackgroundSettings(hydrationResult.backgroundSettings);
            }

            if (setImmersiveSettings) {
              setImmersiveSettings(hydrationResult.immersiveSettings);
            }

            if (hydrationResult.deathReason) {
              setDeathReason(hydrationResult.deathReason);
            }

            updatePersistenceAccess({
              phase: GAME_PERSISTENCE_PHASE.READY,
              loadedIdentity: { uid: currentUser.uid, slotId },
            });
            reconstructedLogsToPersist.forEach((log) => {
              if (log?.type) appendLogToSubcollection(log).catch(() => {});
            });
          }
        } else {
          const notFoundError = new Error("슬롯 문서를 찾을 수 없습니다.");
          notFoundError.code = "SLOT_NOT_FOUND";
          throw notFoundError;
        }
      } catch (error) {
        if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
        console.error("슬롯 로드 오류:", error);
        setError(error);
        setSlotLoadError(error);
        updatePersistenceAccess({
          phase: GAME_PERSISTENCE_PHASE.FAILED,
          loadedIdentity: null,
        });
      } finally {
        if (isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) {
          setIsLoadingSlot(false);
          setIsLoading(false);
        }
      }
    };

    loadSlot();
    return () => {
      if (isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) {
        persistenceAccessRef.current = {
          ...persistenceAccessRef.current,
          phase: GAME_PERSISTENCE_PHASE.LOADING,
          generation: generation + 1,
          loadedIdentity: null,
        };
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, currentUser, isFirebaseAvailable, navigate, slotLoadRetryRevision]);

  /**
   * 배경화면 설정 저장 함수 (참조 안정화: useCallback으로 1초마다 리렌더 시 불필요한 저장 방지)
   * @param {Object} newBackgroundSettings - 새로운 배경화면 설정
   */
  const saveBackgroundSettings = useCallback(async (newBackgroundSettings) => {
    const saveContext = captureSaveContext();
    if (!slotId || !canStartGameplayWrite(saveContext)) return false;

    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          backgroundSettings: newBackgroundSettings,
          updatedAt: serverTimestamp(),
        });
        console.log('[saveBackgroundSettings] Firebase 저장 완료');
      } catch (error) {
        console.error("배경화면 설정 저장 오류:", error);
        setError(error);
      }
    } else {
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
    }
  }, [canStartGameplayWrite, captureSaveContext, slotId, currentUser, isFirebaseAvailable]);

  const saveImmersiveSettings = useCallback(async (newImmersiveSettings) => {
    const saveContext = captureSaveContext();
    if (!slotId || !canStartGameplayWrite(saveContext)) return false;

    const normalizedSettings = normalizeImmersiveSettings(newImmersiveSettings);

    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        await updateDoc(slotRef, {
          immersiveSettings: normalizedSettings,
          updatedAt: serverTimestamp(),
        });
        console.log("[saveImmersiveSettings] Firebase 저장 완료");
      } catch (saveError) {
        console.error("몰입형 설정 저장 오류:", saveError);
        setError(saveError);
      }
    } else {
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
    }
  }, [canStartGameplayWrite, captureSaveContext, slotId, currentUser, isFirebaseAvailable]);

  /**
   * 선택된 디지몬 이름과 표시명을 슬롯 루트 문서에 저장합니다.
   * UI 상태 반영은 호출 측에서 담당하고, 여기서는 영속화만 처리합니다.
   *
   * @param {string} nextSelectedDigimon
   * @param {{ newLife?: boolean }} options
   */
  const saveSelectedDigimon = useCallback(
    async (nextSelectedDigimon, options = {}) => {
      const saveContext = captureSaveContext();
      if (
        !slotId ||
        !currentUser ||
        !isFirebaseAvailable ||
        !nextSelectedDigimon ||
        !canStartGameplayWrite(saveContext)
      ) {
        return;
      }

      try {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        await runTransaction(db, async (transaction) => {
          const slotSnapshot = await transaction.get(slotRef);
          if (!slotSnapshot.exists()) {
            throw new Error("형태를 저장할 슬롯 문서를 찾을 수 없습니다.");
          }

          const slotData = slotSnapshot.data() || {};
          const sameForm = slotData.selectedDigimon === nextSelectedDigimon;
          let combatIdentity;
          if (options.newLife === true) {
            combatIdentity = createNewLifeCombatIdentity();
          } else if (sameForm) {
            combatIdentity = preserveOrCreateCombatIdentity(slotData);
          } else if (hasValidCombatIdentity(slotData)) {
            combatIdentity = buildFormTransitionCombatIdentity(slotData);
          } else {
            // bridge 기간의 legacy slot은 첫 형태 전환 write에서 identity를 함께 채운다.
            combatIdentity = createNewLifeCombatIdentity();
          }

          transaction.update(slotRef, {
            ...combatIdentity,
            selectedDigimon: nextSelectedDigimon,
            digimonDisplayName: buildDigimonDisplayName(
              nextSelectedDigimon,
              digimonNickname,
              evolutionDataForSlot
            ),
            isLightsOn,
            wakeUntil,
            dailySleepMistake: deleteField(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch (saveError) {
        console.error("디지몬 이름 저장 오류:", saveError);
        setError(saveError);
      }
    },
    [
      slotId,
      currentUser,
      isFirebaseAvailable,
      digimonNickname,
      evolutionDataForSlot,
      isLightsOn,
      wakeUntil,
      canStartGameplayWrite,
      captureSaveContext,
    ]
  );

  /**
   * 사망 직후 현재 스냅샷을 슬롯 문서에 1회 반영합니다.
   *
   * @param {Object} statsSnapshot
   */
  const persistDeathSnapshot = async (statsSnapshot) => {
    if (!slotId || !currentUser || !isFirebaseAvailable || !statsSnapshot) {
      return;
    }
    return saveStats(statsSnapshot);
  };

  return {
    saveStats,
    applyLazyUpdate: applyLazyUpdateForAction,
    saveBackgroundSettings,
    saveImmersiveSettings,
    saveSelectedDigimon,
    persistDeathSnapshot,
    appendLogToSubcollection,
    appendBattleLogToSubcollection,
    flushOutbox,
    syncInfo: {
      mode: isFirebaseAvailable && currentUser ? "firebase" : "local",
      stateSyncStatus,
      recordSyncStatus,
      nextStateSyncAt,
      nextRecordSyncAt,
      retryAt,
      pendingRecordCount,
      lastStateSyncedAt,
      lastRecordSyncedAt,
      stateSyncError,
      recordSyncError,
      localPersistenceStatus,
      persistencePhase,
    },
    syncConflict,
    resolveSyncConflict,
    refreshGameRevision,
    persistencePhase,
    retrySlotLoad,
    slotLoadError,
    isLoading,
    error,
  };
}
