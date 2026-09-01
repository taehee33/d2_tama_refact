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
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { applyLazyUpdate } from "../data/stats";
import { initializeStats } from "../data/stats";
import { MAX_ACTIVITY_LOGS, MAX_BATTLE_LOGS } from "../constants/activityLogs";
import { initializeActivityLogs } from "../hooks/useGameLogic";
import { getSleepSchedule } from "../hooks/useGameHandlers";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { DEFAULT_IMMERSIVE_SETTINGS } from "../data/immersiveSettings";
import { filterEntriesForSlotCreation } from "../utils/slotLogUtils";
import {
  GAME_PERSISTENCE_PHASE,
  useDurableGamePersistence,
} from "./game-persistence/useDurableGamePersistence";
import {
  CARE_MISTAKE_LOAD_ACTION,
  resolveCareMistakeLoadPolicy,
  resolveCareMistakeReconciliationRetryDelay,
} from "./game-persistence/careMistakeLoadPolicy";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import { normalizeImmersiveSettings } from "../utils/immersiveSettings";
import { resolveSlotNotificationEligible } from "../utils/notificationEligibility";
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
  applyStatsPopupCommand,
  buildStatsPopupCommandPatch,
  buildStatsPopupNocturnalRequestLog,
  getStatsPopupCommandPrimaryField,
  reconcileLegacySaveWithCommands,
} from "../logic/stats/statsPopupCommands";
import {
  deriveOverallReceipt,
  isStatsPopupRetrySuperseded,
  persistStatsPopupReceiptComponents,
} from "../logic/stats/statsPopupSaveReceipt";
import {
  buildFormTransitionCombatIdentity,
  createNewLifeCombatIdentity,
  hasValidCombatIdentity,
  preserveOrCreateCombatIdentity,
} from "../logic/arena/combatIdentity";
import { hasValidSlotInstanceIdentity } from "../persistence/slotInstanceIdentity";
import { ensureSlotPersistenceIdentity } from "../persistence/slotPersistenceIdentity";
import {
  LOG_IDENTITY_SCHEMA_VERSION,
  selectCurrentLifeLogs,
} from "../persistence/lifeLogIdentity";
import {
  buildNewLifeTransitionEnvelope,
  commitNewLifeTransition,
} from "../persistence/newLifeTransition";
import {
  buildEvolutionStageInstanceId,
  CARE_MISTAKE_RECONCILIATION_STATUS,
  CARE_MISTAKE_TRANSITION_TYPES,
  buildCareMistakeOccurrenceFromActivityLog,
  isCareMistakeActivityLog,
  isCareMistakeResolutionActivityLog,
} from "../logic/stats/careMistakeProjection";
import { buildCareMistakeLedgerFromIncidents } from "../logic/stats/careMistakeLedger";
import {
  buildCareMistakeReconciliationPlan,
  commitCareMistakeReconciliation,
} from "../persistence/careMistakeReconciliation";
import { buildActivityLogEventId } from "../utils/activityLogEventId";
import {
  CARE_MISTAKE_V2_INTEGRITY,
  buildCareMistakeV2Command,
  commitCareMistakeV2ApiCommand,
  fetchCareMistakeV2Integrity,
  isCareMistakeV2Slot,
} from "../persistence/careMistakeV2Api";
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

function createCareV2ClientCommandId(prefix) {
  const randomId = typeof window !== "undefined" &&
    typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomId}`;
}

const CARE_MISTAKE_STATE_FIELDS = Object.freeze([
  "careMistakes",
  "careMistakeLedger",
  "unresolvedCareMistakeCount",
  "latestUnresolvedCareMistakeIncidentId",
  "latestCareMistakeAt",
  "careMistakeSchemaVersion",
  "careMistakeReconciliationVersion",
  "careMistakeReconciliationStatus",
  "evolutionStageInstanceId",
]);

function omitCareMistakeStateFields(stats = {}) {
  const result = { ...stats };
  CARE_MISTAKE_STATE_FIELDS.forEach((field) => delete result[field]);
  return result;
}

function getActivityLogMergeKey(log = {}) {
  const eventId = buildActivityLogEventId(log);
  if (eventId) return `event:${eventId}`;
  return `legacy:${String(log.type || "")}:${toEpochMs(log.timestamp) ?? ""}:${String(log.text || "")}`;
}

function mergeActivityLogs(...sources) {
  const seen = new Set();
  const merged = sources
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .filter((log) => {
      const key = getActivityLogMergeKey(log);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return merged.sort((left, right) =>
    (toEpochMs(left?.timestamp) || 0) - (toEpochMs(right?.timestamp) || 0)
  ).slice(-MAX_ACTIVITY_LOGS);
}

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
    careMistakeReconciliationStatus: null,
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

export function enqueueCareV2Patch({
  saveQueue,
  getAccess,
  currentUser,
  slotId,
  commandType = "STATE_MUTATION",
  commandId,
  payload,
  commitCommand = commitCareMistakeV2ApiCommand,
  updateAccess,
  setRevision,
  getStatsSnapshot = () => null,
}) {
  return saveQueue.enqueue(async () => {
    const access = getAccess();
    const state = access?.careMistakeState;
    if (state?.schemaVersion !== 2) return null;

    const result = await commitCommand(
      currentUser,
      slotId,
      buildCareMistakeV2Command({
        commandId,
        commandType,
        state,
        expectedRevision: access.loadedRevision,
        payload,
      })
    );
    updateAccess({
      loadedRevision: result.revision,
      careMistakeState: result.careMistakeState,
      careMistakeReconciliationStatus: CARE_MISTAKE_V2_INTEGRITY.VERIFIED,
      ...(result.digimonInstanceId
        ? {
            loadedIdentity: {
              ...access.loadedIdentity,
              digimonInstanceId: result.digimonInstanceId,
            },
          }
        : {}),
      ...(payload?.updateData?.arenaIdentitySchemaVersion === 1
        ? {
            combatIdentity: {
              arenaIdentitySchemaVersion: payload.updateData.arenaIdentitySchemaVersion,
              digimonInstanceId:
                result.digimonInstanceId || payload.updateData.digimonInstanceId,
              combatRevision: payload.updateData.combatRevision,
            },
          }
        : {}),
    });
    setRevision(result.revision, getStatsSnapshot());
    return result;
  });
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
  const candidates = [
    slotData.lastSavedAtServer,
    slotData.lastSavedAt,
    persistedStats.lastSavedAtServer,
    persistedStats.lastSavedAt,
    liveStats.lastSavedAt,
  ];
  return candidates.find((candidate) => {
    const timestamp = toEpochMs(candidate);
    return timestamp != null && timestamp >= 0;
  }) ?? null;
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
    careMistakes: _dropCareMistakes,
    careMistakeLedger: _dropCareMistakeLedger,
    unresolvedCareMistakeCount: _dropUnresolvedCareMistakeCount,
    latestUnresolvedCareMistakeIncidentId: _dropLatestCareMistakeIncidentId,
    latestCareMistakeAt: _dropLatestCareMistakeAt,
    careMistakeSchemaVersion: _dropCareMistakeSchemaVersion,
    careMistakeReconciliationVersion: _dropCareMistakeReconciliationVersion,
    careMistakeReconciliationStatus: _dropCareMistakeReconciliationStatus,
    evolutionStageInstanceId: _dropEvolutionStageInstanceId,
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

export function resolveCareMistakeProjectionFromSlot(slotData = {}, stats = {}) {
  const projectionSource = {
    ...stats,
    ...slotData,
    ...(slotData.digimonStats || {}),
  };
  return {
    careMistakes: Math.max(0, Number(projectionSource.careMistakes) || 0),
    unresolvedCareMistakeCount: Math.max(
      0,
      Number(projectionSource.unresolvedCareMistakeCount ?? projectionSource.careMistakes) || 0
    ),
    latestUnresolvedCareMistakeIncidentId:
      projectionSource.latestUnresolvedCareMistakeIncidentId ?? null,
    latestCareMistakeAt: toEpochMs(projectionSource.latestCareMistakeAt),
    careMistakeSchemaVersion: projectionSource.careMistakeSchemaVersion ?? null,
    careMistakeReconciliationVersion:
      projectionSource.careMistakeReconciliationVersion ?? null,
    careMistakeReconciliationStatus:
      projectionSource.careMistakeReconciliationStatus || "not_started",
    evolutionStageInstanceId: projectionSource.evolutionStageInstanceId || null,
  };
}

/**
 * 저장 직전 새 케어미스 로그와 projection 변화를 하나의 전이 의도로 묶습니다.
 * 기존 snapshot의 careMistakes 값은 incident 정본이 아니므로 전이 입력으로
 * 사용하지 않고, 로그 delta 또는 명시적인 해소 의도만 사용합니다.
 */
export function buildCareMistakeTransitionFromStats({
  previousStats = {},
  nextStats = {},
  previousLogs = [],
  nextLogs = [],
  identity = {},
  explicitTransition = null,
  nowMs = Date.now(),
} = {}) {
  const stageInstanceId =
    explicitTransition?.evolutionStageInstanceId ||
    explicitTransition?.identity?.evolutionStageInstanceId ||
    nextStats.evolutionStageInstanceId ||
    previousStats.evolutionStageInstanceId ||
    buildEvolutionStageInstanceId({
      digimonInstanceId: identity.digimonInstanceId,
      evolutionStageStartedAt:
        nextStats.evolutionStageStartedAt || previousStats.evolutionStageStartedAt,
      evolutionStage: nextStats.evolutionStage || previousStats.evolutionStage,
    });
  const transitionIdentity = {
    ...identity,
    evolutionStageInstanceId: stageInstanceId,
  };
  const previousLogIds = new Set(
    (Array.isArray(previousLogs) ? previousLogs : [])
      .map((log) => buildActivityLogEventId(log))
      .filter(Boolean)
  );
  const transitionActivityEvents = (Array.isArray(nextLogs) ? nextLogs : [])
    .filter((log) =>
      !isCareMistakeActivityLog(log) &&
      !isCareMistakeResolutionActivityLog(log)
    )
    .map((log) => ({
      ...log,
      eventId: buildActivityLogEventId(log),
    }))
    .filter((log) => log.eventId && !previousLogIds.has(log.eventId));
  if (explicitTransition?.transitionType) {
    return {
      ...explicitTransition,
      identity: transitionIdentity,
      evolutionStageInstanceId: stageInstanceId,
      ...(transitionActivityEvents.length > 0
        ? {
            activityEvents: [
              ...(explicitTransition.activityEvents || []),
              ...transitionActivityEvents,
            ],
          }
        : {}),
    };
  }

  const previousEventIds = previousLogIds;
  const stageStartedAt = toEpochMs(
    nextStats.evolutionStageStartedAt || previousStats.evolutionStageStartedAt
  );
  const occurrences = (Array.isArray(nextLogs) ? nextLogs : [])
    .filter((log) => isCareMistakeActivityLog(log))
    .filter((log) => {
      const logStageId = log?.evolutionStageInstanceId;
      if (logStageId && stageInstanceId && logStageId !== stageInstanceId) return false;
      const timestamp = toEpochMs(log?.timestamp);
      return !(stageStartedAt != null && timestamp != null && timestamp < stageStartedAt);
    })
    .filter((log) => {
      const eventId = buildActivityLogEventId(log);
      return eventId && !previousEventIds.has(eventId);
    })
    .map((log, index) => {
      const occurrence = buildCareMistakeOccurrenceFromActivityLog(
        log,
        transitionIdentity,
        "care-auto",
        index
      );
      if (!occurrence) return null;
      const { eventId: _eventId, ...operation } = occurrence;
      return operation;
    })
    .filter(Boolean);

  if (occurrences.length > 0) {
    return {
      transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
      createdAt: nowMs,
      identity: transitionIdentity,
      evolutionStageInstanceId: stageInstanceId,
      operations: occurrences,
      ...(transitionActivityEvents.length > 0
        ? { activityEvents: transitionActivityEvents }
        : {}),
    };
  }

  const previousCount = Math.max(
    0,
    Number(previousStats.unresolvedCareMistakeCount ?? previousStats.careMistakes) || 0
  );
  const nextCount = Math.max(
    0,
    Number(nextStats.unresolvedCareMistakeCount ?? nextStats.careMistakes) || 0
  );
  if (
    nextCount < previousCount &&
    (previousStats.latestUnresolvedCareMistakeIncidentId || nextStats.latestUnresolvedCareMistakeIncidentId)
  ) {
    return {
      transitionType: CARE_MISTAKE_TRANSITION_TYPES.RESOLVED,
      createdAt: nowMs,
      identity: transitionIdentity,
      evolutionStageInstanceId: stageInstanceId,
      operations: [{
        incidentId:
          previousStats.latestUnresolvedCareMistakeIncidentId ||
          nextStats.latestUnresolvedCareMistakeIncidentId,
        resolvedAt: nowMs,
        resolvedBy: "play_or_snack",
      }],
    };
  }

  return null;
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
 * @param {number|string|null} [params.currentLifeStartedAt]
 * @param {string|null} [params.slotInstanceId]
 * @param {string|null} [params.digimonInstanceId]
 * @param {number|null} [params.logIdentitySchemaVersion]
 * @param {Array} [params.legacyActivityLogs]
 * @param {Array} [params.legacyBattleLogs]
 * @param {Function} [params.loadActivityEntries]
 * @param {Function} [params.loadBattleEntries]
 * @returns {Promise<{
 *   loadedActivityLogs: Array,
 *   loadedBattleLogs: Array,
 *   legacyActivityEntriesToBackfill: Array,
 *   legacyBattleEntriesToBackfill: Array,
 * }>}
 */
export async function loadSlotCollectionsState({
  slotRef = null,
  slotCreatedAt = null,
  currentLifeStartedAt = null,
  slotInstanceId = null,
  digimonInstanceId = null,
  logIdentitySchemaVersion = null,
  legacyActivityLogs = [],
  legacyBattleLogs = [],
  loadActivityEntries,
  loadBattleEntries,
} = {}) {
  const allowLegacy = logIdentitySchemaVersion !== LOG_IDENTITY_SCHEMA_VERSION;
  const lifeOptions = {
    slotInstanceId,
    digimonInstanceId,
    currentLifeStartedAt,
    slotCreatedAt,
    allowLegacy,
  };
  const fallbackActivitySelection = selectCurrentLifeLogs(
    [...initializeActivityLogs(
      (legacyActivityLogs || []).map(normalizeLogTimestamp)
    )].sort((left, right) =>
      (toEpochMs(right?.timestamp) || 0) - (toEpochMs(left?.timestamp) || 0)
    ),
    { ...lifeOptions, maxCount: MAX_ACTIVITY_LOGS }
  );
  let loadedActivityLogs = fallbackActivitySelection.currentEntries;
  let legacyActivityEntriesToBackfill = fallbackActivitySelection.legacyEntries;

  try {
    const activityEntries = loadActivityEntries
      ? await loadActivityEntries()
      : await (async () => {
          if (!slotRef) return [];
          const logsRef = collection(slotRef, "logs");
          const logsQuery = allowLegacy
            ? query(logsRef, orderBy("timestamp", "desc"), limit(200))
            : query(
                logsRef,
                where("digimonInstanceId", "==", digimonInstanceId),
                orderBy("timestamp", "desc"),
                limit(MAX_ACTIVITY_LOGS)
              );
          const logsSnap = await getDocs(logsQuery);
          if (logsSnap.empty) {
            return [];
          }
          return logsSnap.docs.map((d) => normalizeLogTimestamp({ id: d.id, ...d.data() }));
        })();

    if (Array.isArray(activityEntries) && activityEntries.length > 0) {
      const selection = selectCurrentLifeLogs(
        filterEntriesForSlotCreation(
          activityEntries.map(normalizeLogTimestamp),
          slotCreatedAt
        ),
        { ...lifeOptions, maxCount: MAX_ACTIVITY_LOGS }
      );
      loadedActivityLogs = selection.currentEntries;
      legacyActivityEntriesToBackfill = selection.legacyEntries;
    }
  } catch (_e) {
    loadedActivityLogs = fallbackActivitySelection.currentEntries;
    legacyActivityEntriesToBackfill = fallbackActivitySelection.legacyEntries;
  }

  const fallbackBattleSelection = selectCurrentLifeLogs(
    [...(legacyBattleLogs || []).map(normalizeLogTimestamp)].sort((left, right) =>
      (toEpochMs(right?.timestamp) || 0) - (toEpochMs(left?.timestamp) || 0)
    ),
    { ...lifeOptions, maxCount: MAX_BATTLE_LOGS }
  );
  let loadedBattleLogs = fallbackBattleSelection.currentEntries;
  let legacyBattleEntriesToBackfill = fallbackBattleSelection.legacyEntries;

  try {
    const battleEntries = loadBattleEntries
      ? await loadBattleEntries()
      : await (async () => {
          if (!slotRef) return [];
          const battleLogsRef = collection(slotRef, "battleLogs");
          const battleLogsQuery = allowLegacy
            ? query(battleLogsRef, orderBy("timestamp", "desc"), limit(200))
            : query(
                battleLogsRef,
                where("digimonInstanceId", "==", digimonInstanceId),
                orderBy("timestamp", "desc"),
                limit(MAX_BATTLE_LOGS)
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
      const selection = selectCurrentLifeLogs(
        filterEntriesForSlotCreation(
          battleEntries.map(normalizeLogTimestamp),
          slotCreatedAt
        ),
        { ...lifeOptions, maxCount: MAX_BATTLE_LOGS }
      );
      loadedBattleLogs = selection.currentEntries;
      legacyBattleEntriesToBackfill = selection.legacyEntries;
    }
  } catch (_e) {
    loadedBattleLogs = fallbackBattleSelection.currentEntries;
    legacyBattleEntriesToBackfill = fallbackBattleSelection.legacyEntries;
  }

  return {
    loadedActivityLogs,
    loadedBattleLogs,
    legacyActivityEntriesToBackfill,
    legacyBattleEntriesToBackfill,
  };
}

/**
 * 현재 생애의 케어 incident 원본을 모두 읽습니다. stage 필터와 필수 필드
 * 검증은 손상 문서를 숨기지 않도록 reconciliation plan에서 수행합니다.
 */
export async function loadCareMistakeIncidents({
  slotRef = null,
  digimonInstanceId = null,
  loadIncidents,
} = {}) {
  const incidents = loadIncidents
    ? await loadIncidents()
    : await (async () => {
        if (!slotRef || !digimonInstanceId) return [];
        const incidentsRef = collection(slotRef, "careMistakeIncidents");
        const incidentsQuery = query(
          incidentsRef,
          where("digimonInstanceId", "==", digimonInstanceId)
        );
        const incidentsSnap = await getDocs(incidentsQuery);
        return incidentsSnap.docs.map((snapshot) => ({
          incidentId: snapshot.id,
          ...snapshot.data(),
        }));
      })();

  // stage 필터링은 raw 필수 필드 검증과 함께 plan에서 수행한다. 여기서
  // 누락 stage/timestamp 문서를 버리면 손상을 정상 데이터처럼 숨길 수 있다.
  return Array.isArray(incidents) ? incidents : [];
}

/**
 * reconciliation은 화면용 최근 50건이 아닌 현재 stage의 전체 로그를 감사한다.
 * 일부만 읽고 verified로 표시하면 오래된 케어미스가 다시 유실될 수 있다.
 */
export async function loadCareMistakeReconciliationLogs({
  slotRef = null,
  slotInstanceId = null,
  digimonInstanceId = null,
  evolutionStageStartedAt = null,
  loadLogs,
} = {}) {
  const stageStartedAt = toEpochMs(evolutionStageStartedAt);
  const logs = loadLogs
    ? await loadLogs()
    : await (async () => {
        if (!slotRef) return [];
        const logsSnapshot = await getDocs(collection(slotRef, "logs"));
        return logsSnapshot.docs.map((snapshot) => ({
          id: snapshot.id,
          ...snapshot.data(),
        }));
      })();

  if (!Array.isArray(logs)) {
    throw new TypeError("케어미스 reconciliation 로그 결과가 배열이 아닙니다.");
  }

  return logs
    .map(normalizeLogTimestamp)
    .filter((log) => {
      const timestamp = toEpochMs(log.timestamp);
      if (stageStartedAt != null && timestamp != null && timestamp < stageStartedAt) {
        return false;
      }
      if (log.slotInstanceId && slotInstanceId && log.slotInstanceId !== slotInstanceId) {
        return false;
      }
      if (log.digimonInstanceId && digimonInstanceId && log.digimonInstanceId !== digimonInstanceId) {
        return false;
      }
      return true;
    })
    .sort((left, right) =>
      (toEpochMs(left.timestamp) || 0) - (toEpochMs(right.timestamp) || 0)
    );
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
 * @param {number|null} [params.nowMs]
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

const REQUIRED_GAMEPLAY_TIMING_FIELDS = Object.freeze([
  "lifespanSeconds",
  "timeToEvolveSeconds",
  "hungerTimer",
  "hungerCountdown",
  "strengthTimer",
  "strengthCountdown",
  "poopTimer",
  "poopCountdown",
]);

export class GameSlotLoadInvariantError extends Error {
  constructor({ slotData = null } = {}) {
    super("저장된 게임 상태가 불완전합니다. 슬롯을 삭제한 뒤 다시 생성해 주세요.");
    this.name = "GameSlotLoadInvariantError";
    this.code = "game/slot-load-incomplete";
    this.slotData = slotData;
  }
}

export function hasCompletePersistedGameplayState({
  slotData = {},
  savedStats = {},
} = {}) {
  const hasTimestamp = (value) => toEpochMs(value) != null;
  const hasNonNegativeNumber = (field) =>
    typeof savedStats[field] === "number" &&
    Number.isFinite(savedStats[field]) &&
    savedStats[field] >= 0;

  return (
    savedStats != null &&
    typeof savedStats === "object" &&
    !Array.isArray(savedStats) &&
    hasTimestamp(savedStats.birthTime) &&
    hasTimestamp(savedStats.evolutionStageStartedAt) &&
    hasTimestamp(resolveLastSavedAtSource(slotData, savedStats)) &&
    REQUIRED_GAMEPLAY_TIMING_FIELDS.every(hasNonNegativeNumber)
  );
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
  if (!hasCompletePersistedGameplayState({ slotData, savedStats })) {
    throw new GameSlotLoadInvariantError({ slotData });
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
  nowMs = null,
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
    applyLazyUpdate(baseStats, lastSavedAt, sleepSchedule, maxEnergy, {
      digimonSnapshot,
      ...(nowMs != null && Number.isFinite(Number(nowMs))
        ? { nowMs: Number(nowMs) }
        : {}),
    })
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
  const latestDigimonStatsRef = useRef(digimonStats);
  latestDigimonStatsRef.current = digimonStats;
  const saveOperationSequenceRef = useRef(0);
  const reconstructedLogsRef = useRef([]);
  const statsPopupCommandLedgerRef = useRef(new Map());
  const latestStatsPopupCommandSequenceRef = useRef(new Map());
  useEffect(() => {
    statsPopupCommandLedgerRef.current.clear();
    latestStatsPopupCommandSequenceRef.current.clear();
    saveOperationSequenceRef.current = 0;
    reconstructedLogsRef.current = [];
  }, [currentUser?.uid, slotId]);
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

  const buildUpdateDataForSnapshot = useCallback((
    statsSnapshot,
    nowMs = Date.now(),
    transition = null
  ) => {
    // stats snapshot 안의 selectedDigimon은 다음 형태를 미리 담을 수 있다.
    // top-level 형태 변경은 saveSelectedDigimon transaction에서 combatRevision과 함께만 쓴다.
    const effectiveSelectedDigimon =
      transition?.targetDigimon || selectedDigimon || null;
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
    clearDigimonLifeOutbox,
    clearPendingStateAfterHydration,
    flushOutbox,
    getLatestStateSnapshot,
    getPendingActivityLogs,
    getPendingCareTransitions,
    getPendingState,
    persistStateSnapshotReceipt,
    persistEvolutionTransitionReceipt,
    persistActivityLogReceipt,
    quarantinePendingState,
    quarantineStaleCareEpoch,
    refreshGameRevision,
    resolveSyncConflict,
    setLoadedRevision,
    syncConflict,
    nextRecordSyncAt,
    nextStateSyncAt,
    pendingRecordCount,
    pendingSaveCount,
    oldestPendingAt,
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

  const commitCareV2Patch = useCallback(async ({
    commandType = "STATE_MUTATION",
    commandId,
    payload,
  }) => enqueueCareV2Patch({
    saveQueue: saveQueueRef.current,
    getAccess: () => persistenceAccessRef.current,
    currentUser,
    slotId,
    commandType,
    commandId,
    payload,
    updateAccess: updatePersistenceAccess,
    setRevision: setLoadedRevision,
    getStatsSnapshot: () => latestDigimonStatsRef.current,
  }), [currentUser, setLoadedRevision, slotId, updatePersistenceAccess]);

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
   * @param {Object|null} transition - 케어미스/냉장고/호출 확인 전이 의도 (선택적)
   */
  async function executeSaveStats(
    newStats,
    updatedLogs = null,
    saveContext = null,
    legacyMetadata = null,
    transition = null,
    persistenceOptions = {}
  ) {
    // 예약 이후 슬롯/사용자/세대가 바뀌었으면 React setter를 포함해 아무 작업도 하지 않는다.
    if (!canStartGameplayWrite(saveContext, {
      allowCareTransition: persistenceOptions.allowCareTransition === true,
    })) return false;
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
    if (!canStartGameplayWrite(saveContext, {
      allowCareTransition: persistenceOptions.allowCareTransition === true,
    })) return false;
    const nowMs = Date.now();
    let effectiveNewStats = newStats;
    if (!isNewStart && legacyMetadata) {
      const reconciled = reconcileLegacySaveWithCommands({
        latestStats: baseStats,
        requestedStats: newStats,
        invocationStats: legacyMetadata.invocationStats,
        legacySequence: legacyMetadata.sequence,
        commandEntries: Array.from(statsPopupCommandLedgerRef.current.values()),
      });
      effectiveNewStats = reconciled.stats;
      reconciled.supersededFields.forEach((field) => {
        statsPopupCommandLedgerRef.current.delete(field);
      });
    }
    
    // Activity Logs 처리: 원격 snapshot의 lazy reconstruction 로그와
    // 호출자가 전달한 최신 로그를 합쳐 오래된 배열이 새 사건을 덮지 않게 한다.
    const requestedLogs = updatedLogs !== null
      ? updatedLogs
      : newStats.activityLogs || activityLogs || [];
    const finalLogs = mergeActivityLogs(
      baseStats.activityLogs || [],
      requestedLogs
    );
    setActivityLogs(() => finalLogs);
    
    // preservedStats의 값들을 우선 적용 (undefined가 아닌 경우만)
    const mergedStats = { ...baseStats };
    Object.keys(preservedStats).forEach(key => {
      if (preservedStats[key] !== undefined) {
        mergedStats[key] = preservedStats[key];
      }
    });
    
    // 새로운 시작일 때는 newStats의 사망 관련 필드를 확실히 보존
    const effectiveSelectedDigimon =
      effectiveNewStats.selectedDigimon ||
      digimonStats?.selectedDigimon ||
      selectedDigimon ||
      null;
    const rootSlotFields = resolveRootSlotFields(effectiveNewStats, {
      isLightsOn,
      wakeUntil,
    });

    const statsForMerge = transition?.transitionType || isNewStart
      ? effectiveNewStats
      : omitCareMistakeStateFields(effectiveNewStats);
    const finalStats = {
      ...mergedStats,
      ...statsForMerge, // 큐 실행 시점의 최신 상태에 호출자의 변경 의도를 적용
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
    const repairedFinalStats = normalizeGameTimingFields(finalStats);
    
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

    const careTransition = buildCareMistakeTransitionFromStats({
      previousStats: baseStats,
      nextStats: statsForState,
      previousLogs: baseStats.activityLogs || [],
      nextLogs: finalLogs,
      identity: {
        slotInstanceId: saveContext?.slotInstanceId,
        digimonInstanceId: saveContext?.digimonInstanceId,
      },
      explicitTransition: transition,
      nowMs,
    });

    setDigimonStats(statsForState);

    // Firebase 로그인 필수
    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const persistenceReceipt = await persistStateSnapshotReceipt({
          statsSnapshot: statsForState,
          updatedLogs,
          nowMs,
          saveContext,
          transition: careTransition,
          activityEvents: persistenceOptions.activityEvents || [],
          allowCareTransition: persistenceOptions.allowCareTransition === true,
        });
        if (
          persistenceReceipt.status !== "synced" &&
          persistenceReceipt.status !== "queued"
        ) {
          const conflictError = new Error("다른 기기의 변경사항 확인이 필요합니다.");
          conflictError.code = persistenceReceipt.errorCode || "game/revision-conflict-pending";
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

  function saveStats(
    newStats,
    updatedLogs = null,
    transition = null,
    persistenceOptions = {}
  ) {
    const saveContext = captureSaveContext();
    const sequence = ++saveOperationSequenceRef.current;
    const invocationStats = digimonStats || {};
    return saveQueueRef.current.enqueue(() =>
      executeSaveStats(newStats, updatedLogs, saveContext, {
        sequence,
        invocationStats,
      }, transition, persistenceOptions)
    );
  }
  saveStats.isInFlight = () => saveQueueRef.current.isBusy();

  /**
   * 진화 상태와 슬롯 루트 형태를 단일 outbox/transaction으로 저장합니다.
   */
  function saveEvolutionTransition({
    statsSnapshot,
    updatedLogs,
    transition,
    nowMs = Date.now(),
  } = {}) {
    const saveContext = captureSaveContext();
    return saveQueueRef.current.enqueue(async () => {
      const receipt = await persistEvolutionTransitionReceipt({
        statsSnapshot,
        updatedLogs,
        transition,
        nowMs,
        commandId: transition?.transitionId || null,
        saveContext,
      });
      if (receipt.status === "synced" || receipt.status === "queued") {
        return receipt;
      }
      const error = new Error(
        receipt.status === "conflict"
          ? "슬롯이 다른 기기에서 변경되었습니다. 최신 상태를 확인해 주세요."
          : "진화 상태를 저장하지 못했습니다."
      );
      error.code = receipt.errorCode || `game/evolution-${receipt.status}`;
      error.receipt = receipt;
      throw error;
    });
  }

  /**
   * 새 stats·형태·combat identity·NEW_START 로그를 한 Firestore transaction으로 저장합니다.
   */
  function saveNewLifeTransition({
    statsSnapshot,
    transition,
    nowMs = Date.now(),
  } = {}) {
    const saveContext = captureSaveContext();
    const nextCombatIdentity = createNewLifeCombatIdentity();
    return saveQueueRef.current.enqueue(async () => {
      if (
        !slotId ||
        !currentUser?.uid ||
        !isFirebaseAvailable ||
        !statsSnapshot ||
        !transition ||
        !canStartGameplayWrite(saveContext)
      ) {
        const blockedError = new Error("현재 슬롯에서는 새 생애를 저장할 수 없습니다.");
        blockedError.code = "game/new-life-blocked";
        throw blockedError;
      }

      const envelope = buildNewLifeTransitionEnvelope({
        ...transition,
        previousIdentity: {
          slotInstanceId: saveContext.slotInstanceId,
          digimonInstanceId: saveContext.digimonInstanceId,
        },
        nextCombatIdentity,
        createdAt: transition.createdAt ?? nowMs,
      });
      if (persistenceAccessRef.current?.careMistakeState?.schemaVersion === 2) {
        const nextEvolutionStageInstanceId = buildEvolutionStageInstanceId({
          digimonInstanceId: envelope.nextDigimonInstanceId,
          evolutionStageStartedAt:
            statsSnapshot.evolutionStageStartedAt || statsSnapshot.birthTime || nowMs,
          evolutionStage: statsSnapshot.evolutionStage || envelope.targetDigimon,
        });
        const receipt = await persistStateSnapshotReceipt({
          statsSnapshot: {
            ...statsSnapshot,
            ...nextCombatIdentity,
            evolutionStageInstanceId: nextEvolutionStageInstanceId,
          },
          updatedLogs: statsSnapshot.activityLogs || [],
          nowMs,
          commandId: envelope.transitionId,
          saveContext,
          transition: {
            ...envelope,
            transitionType: "NEW_LIFE",
            newLife: true,
            nextEvolutionStageInstanceId,
          },
          allowCareTransition: true,
        });
        if (receipt.status !== "synced" && receipt.status !== "queued") {
          const error = new Error("새 생애 상태를 저장하지 못했습니다.");
          error.code = receipt.errorCode || "game/new-life-v2-save-failed";
          throw error;
        }
        updatePersistenceAccess({
          loadedIdentity: {
            uid: currentUser.uid,
            slotId,
            slotInstanceId: saveContext.slotInstanceId,
            digimonInstanceId: envelope.nextDigimonInstanceId,
          },
          combatIdentity: {
            arenaIdentitySchemaVersion: envelope.nextArenaIdentitySchemaVersion,
            digimonInstanceId: envelope.nextDigimonInstanceId,
            combatRevision: envelope.nextCombatRevision,
          },
        });
        Promise.resolve(clearDigimonLifeOutbox({
          slotInstanceId: saveContext.slotInstanceId,
          digimonInstanceId: saveContext.digimonInstanceId,
        })).catch((cleanupError) => {
          console.warn("이전 생애 IndexedDB outbox 정리에 실패했습니다.", cleanupError);
        });
        return {
          revision: receipt.revision,
          transitionId: envelope.transitionId,
          previousDigimonInstanceId: saveContext.digimonInstanceId,
          nextDigimonInstanceId: envelope.nextDigimonInstanceId,
          idempotent: receipt.idempotent === true,
        };
      }
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      const result = await commitNewLifeTransition({
        db,
        slotRef,
        logRef: doc(collection(slotRef, "logs"), envelope.eventId),
        baseRevision: saveContext.requestedAtRevision,
        updateData: buildUpdateDataForSnapshot(statsSnapshot, nowMs, {
          targetDigimon: envelope.targetDigimon,
        }),
        transition: envelope,
        runTransaction,
      });

      updatePersistenceAccess({
        loadedIdentity: {
          uid: currentUser.uid,
          slotId,
          slotInstanceId: saveContext.slotInstanceId,
          digimonInstanceId: result.nextDigimonInstanceId,
        },
      });
      setLoadedRevision(result.revision, statsSnapshot);
      Promise.resolve(clearDigimonLifeOutbox({
        slotInstanceId: saveContext.slotInstanceId,
        digimonInstanceId: saveContext.digimonInstanceId,
      })).catch((cleanupError) => {
        console.warn("이전 생애 IndexedDB outbox 정리에 실패했습니다.", cleanupError);
      });
      return {
        ...result,
        transitionId: envelope.transitionId,
        previousDigimonInstanceId: saveContext.digimonInstanceId,
      };
    });
  }

  function saveStatsCommand(intent, retryReceipt = null) {
    const retryData = retryReceipt?._retry || null;
    const saveContext = retryData?.saveContext || captureSaveContext();
    const operationSequence = ++saveOperationSequenceRef.current;
    const occurredAt = Number.isFinite(Number(retryData?.command?.occurredAt ?? intent?.occurredAt))
      ? Number(retryData?.command?.occurredAt ?? intent.occurredAt)
      : Date.now();
    const sequence = retryData?.command?.sequence ?? operationSequence;
    const commandId = retryData?.command?.commandId || `stats-popup:${occurredAt}:${sequence}`;
    const command = retryData?.command || {
      ...intent,
      occurredAt,
      commandId,
      sequence,
      context: {
        uid: saveContext?.uid ?? null,
        slotId: saveContext?.slotId ?? null,
        generation: saveContext?.generation ?? null,
      },
    };
    const primaryField = getStatsPopupCommandPrimaryField(command);
    const isNocturnalCommand = command.type === "setNocturnal";
    const logEntry = isNocturnalCommand
      ? retryData?.logEntry || buildStatsPopupNocturnalRequestLog(command)
      : null;
    if (!retryData && primaryField) {
      latestStatsPopupCommandSequenceRef.current.set(primaryField, sequence);
    }

    return saveQueueRef.current.enqueue(async () => {
      if (
        retryData &&
        primaryField &&
        isStatsPopupRetrySuperseded({
          retrySequence: sequence,
          latestSequence: latestStatsPopupCommandSequenceRef.current.get(primaryField),
        })
      ) {
        const blocked = {
          status: "blocked",
          commandId,
          blockedReason: null,
          localCleanup: "not-needed",
          errorCode: "stats-popup/superseded-command",
        };
        if (!isNocturnalCommand) return blocked;
        return {
          ...deriveOverallReceipt({ state: blocked, log: blocked }),
          commandId,
          eventId: logEntry?.eventId || null,
          errorCode: blocked.errorCode,
        };
      }

      const persistStateComponent = async () => {
        const latestState = await getLatestStateSnapshot(saveContext);
        if (!latestState) {
          return persistStateSnapshotReceipt({
            statsSnapshot: {},
            updatedLogs: null,
            nowMs: Date.now(),
            saveContext,
            commandId,
          });
        } else {
          const executionNow = Date.now();
          const baseStats = normalizeGameTimingFields(latestState.statsSnapshot || {});
          const { sleepSchedule, maxEnergy } = resolveActionLazyUpdateRuntimeContext({
            digimonStats: baseStats,
            slotRuntimeDataMap,
            selectedDigimon,
          });
          const lazyUpdateResult = buildLazyUpdateRuntimeResult({
            baseStats,
            lastSavedAt: toEpochMs(baseStats.lastSavedAt) ?? executionNow,
            sleepSchedule,
            maxEnergy,
            selectedDigimon:
              baseStats.selectedDigimon || selectedDigimon || digimonStats?.selectedDigimon || null,
            evolutionDataForSlot,
            slotRuntimeDataMap,
            runtimeAdaptedDataMaps,
            nowMs: executionNow,
          });
          const projectedStats = lazyUpdateResult.digimonStats;
          const reducedStats = applyStatsPopupCommand(projectedStats, command);
          const activityLogs = isNocturnalCommand
            ? [
                ...(reducedStats.activityLogs || []).filter(
                  (entry) => entry?.eventId !== logEntry.eventId
                ),
                logEntry,
              ]
            : reducedStats.activityLogs;
          const effectiveSelectedDigimon =
            reducedStats.selectedDigimon || selectedDigimon || digimonStats?.selectedDigimon || null;
          const finalStats = normalizeGameTimingFields({
            ...reducedStats,
            ...(activityLogs ? { activityLogs } : {}),
            ...(effectiveSelectedDigimon ? { selectedDigimon: effectiveSelectedDigimon } : {}),
            lastSavedAt: executionNow,
          });
          const careTransition = buildCareMistakeTransitionFromStats({
            previousStats: baseStats,
            nextStats: finalStats,
            previousLogs: reconstructedLogsRef.current.length > 0
              ? []
              : baseStats.activityLogs || [],
            nextLogs: reconstructedLogsRef.current.length > 0
              ? reconstructedLogsRef.current
              : activityLogs || [],
            identity: {
              slotInstanceId: saveContext?.slotInstanceId,
              digimonInstanceId: saveContext?.digimonInstanceId,
            },
            nowMs: executionNow,
          });
          reconstructedLogsRef.current = [];
          const stateReceipt = await persistStateSnapshotReceipt({
            statsSnapshot: finalStats,
            updatedLogs: isNocturnalCommand ? activityLogs : null,
            nowMs: executionNow,
            saveContext,
            commandId,
            transition: careTransition,
          });

          if (stateReceipt.status === "synced" || stateReceipt.status === "queued") {
            if (primaryField) {
              statsPopupCommandLedgerRef.current.set(primaryField, {
                sequence,
                command,
                patch: buildStatsPopupCommandPatch(projectedStats, finalStats, command),
              });
            }
            setDigimonStats(finalStats);
            checkDeathStatus(finalStats);
          }
          return stateReceipt;
        }
      };

      if (!isNocturnalCommand) return persistStateComponent();
      const overallReceipt = await persistStatsPopupReceiptComponents({
        previousReceipt: retryData ? retryReceipt : null,
        persistState: persistStateComponent,
        persistLog: () => persistActivityLogReceipt({ logEntry, saveContext, commandId }),
      });
      return {
        ...overallReceipt,
        commandId,
        eventId: logEntry.eventId,
        commandSequence: sequence,
        errorCode:
          overallReceipt.state?.errorCode || overallReceipt.log?.errorCode || null,
        _retry: { command, saveContext, logEntry },
      };
    });
  }

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
        if (lazyUpdateResult.reconstructedLogsToPersist.length > 0) {
          reconstructedLogsRef.current = [
            ...reconstructedLogsRef.current,
            ...lazyUpdateResult.reconstructedLogsToPersist,
          ];
        }

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

    let reconciliationRetryTimerId = null;

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
          let slotData = slotSnap.data();
          if (
            !hasValidSlotInstanceIdentity(slotData) ||
            !hasValidCombatIdentity(slotData)
          ) {
            const identityResult = await ensureSlotPersistenceIdentity({
              db,
              slotRef,
              runTransaction,
            });
            if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
            slotData = identityResult.slotData;
          }

          const loadedPersistenceIdentity = {
            uid: currentUser.uid,
            slotId,
            slotInstanceId: slotData.slotInstanceId,
            digimonInstanceId: slotData.digimonInstanceId,
          };
          updatePersistenceAccess({ loadedIdentity: loadedPersistenceIdentity });
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

          // 불완전 슬롯은 로그 조회나 케어미스 정합성 transaction보다 먼저 차단한다.
          // 과거 피해 데이터를 현재 시각으로 추정하거나 Firestore에 보정하지 않는다.
          if (!hasCompletePersistedGameplayState({ slotData, savedStats })) {
            throw new GameSlotLoadInvariantError({ slotData });
          }
          
          const slotRefForLogs = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
          const { loadedActivityLogs, loadedBattleLogs } =
            await loadSlotCollectionsState({
              slotRef: slotRefForLogs,
              slotCreatedAt: slotData.createdAt,
              currentLifeStartedAt: savedStats.birthTime,
              slotInstanceId: slotData.slotInstanceId,
              digimonInstanceId: slotData.digimonInstanceId,
              logIdentitySchemaVersion: slotData.logIdentitySchemaVersion,
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

          let pendingState = null;
          let careProjection = null;
          let careIncidentLoadFailed = false;
          let careV2Integrity = null;
          if (isCareMistakeV2Slot(slotData)) {
            const integrity = await fetchCareMistakeV2Integrity(currentUser, slotId);
            careV2Integrity = integrity;
            if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
            const state = integrity.careMistakeState || slotData.careMistakeState;
            const effectiveStatus = integrity.effectiveIntegrityStatus ||
              CARE_MISTAKE_V2_INTEGRITY.UNKNOWN;
            updatePersistenceAccess({
              loadedRevision: integrity.revision ?? slotData.revision ?? 0,
              careMistakeState: state || null,
              combatIdentity: {
                arenaIdentitySchemaVersion: slotData.arenaIdentitySchemaVersion,
                digimonInstanceId: slotData.digimonInstanceId,
                combatRevision: slotData.combatRevision,
              },
              careMistakeReconciliationStatus: effectiveStatus,
            });
            careProjection = {
              careMistakes: state?.unresolvedCareMistakeCount ?? slotData.careMistakes ?? 0,
              unresolvedCareMistakeCount:
                state?.unresolvedCareMistakeCount ?? slotData.unresolvedCareMistakeCount ?? 0,
              latestUnresolvedCareMistakeIncidentId:
                state?.latestUnresolvedIncidentId ?? null,
              latestCareMistakeAt: slotData.latestCareMistakeAt ?? null,
              careMistakeSchemaVersion: 2,
              careMistakeReconciliationVersion:
                slotData.careMistakeReconciliationVersion ?? 2,
              careMistakeReconciliationStatus: effectiveStatus,
              evolutionStageInstanceId:
                state?.evolutionStageInstanceId || slotData.evolutionStageInstanceId,
            };
            if (state?.rootReceiptId && state?.receiptId && state?.evolutionStageInstanceId) {
              await quarantineStaleCareEpoch({
                currentEpoch: {
                  careSchemaVersion: 2,
                  rootReceiptId: state.rootReceiptId,
                  receiptId: state.receiptId,
                  evolutionStageInstanceId: state.evolutionStageInstanceId,
                },
                reason: "STALE_CARE_EPOCH_ON_HYDRATION",
              });
            }
            try {
              pendingState = await getPendingState();
            } catch (pendingStateError) {
              console.warn("V2 미전송 상태 스냅샷 조회 오류:", pendingStateError);
            }
            savedStats = {
              ...savedStats,
              ...careProjection,
              careMistakeState: state,
            };
          } else {

          // 케어 projection은 슬롯의 숫자나 legacy ledger가 아니라 incident와
          // 현재 stage 로그를 재생해 계산한다. 읽기 실패 시 기존 값을 보존하고
          // reconciliation을 ambiguous로 표시해 추측 저장을 막는다.
          const stageInstanceId =
            slotData.evolutionStageInstanceId ||
            savedStats.evolutionStageInstanceId ||
            buildEvolutionStageInstanceId({
              digimonInstanceId: slotData.digimonInstanceId,
              evolutionStageStartedAt:
                slotData.evolutionStageStartedAt || savedStats.evolutionStageStartedAt,
              evolutionStage: slotData.evolutionStage || savedStats.evolutionStage,
            });
          let loadedCareMistakeIncidents = [];
          try {
            loadedCareMistakeIncidents = await loadCareMistakeIncidents({
              slotRef: slotRefForLogs,
              digimonInstanceId: slotData.digimonInstanceId,
            });
          } catch (careIncidentError) {
            careIncidentLoadFailed = true;
            console.warn("케어미스 incident 조회 오류:", careIncidentError);
          }
          let reconciliationActivityLogs = [];
          let reconciliationActivityLogLoadFailed = false;
          try {
            reconciliationActivityLogs = await loadCareMistakeReconciliationLogs({
              slotRef: slotRefForLogs,
              slotInstanceId: slotData.slotInstanceId,
              digimonInstanceId: slotData.digimonInstanceId,
              evolutionStageStartedAt:
                slotData.evolutionStageStartedAt || savedStats.evolutionStageStartedAt,
            });
          } catch (reconciliationLogError) {
            reconciliationActivityLogLoadFailed = true;
            console.warn("케어미스 전체 감사 로그 조회 오류:", reconciliationLogError);
          }
          let pendingActivityLogs = [];
          let pendingActivityLogLoadFailed = false;
          try {
            pendingActivityLogs = await getPendingActivityLogs();
          } catch (pendingActivityError) {
            pendingActivityLogLoadFailed = true;
            console.warn("미전송 케어미스 활동 로그 조회 오류:", pendingActivityError);
          }
          let pendingCareTransitions = [];
          let pendingCareTransitionLoadFailed = false;
          try {
            pendingCareTransitions = await getPendingCareTransitions();
          } catch (pendingCareTransitionError) {
            pendingCareTransitionLoadFailed = true;
            console.warn("미전송 케어미스 전이 조회 오류:", pendingCareTransitionError);
          }
          let pendingStateLoadFailed = false;
          try {
            pendingState = await getPendingState();
          } catch (pendingStateError) {
            pendingStateLoadFailed = true;
            console.warn("미전송 상태 스냅샷 조회 오류:", pendingStateError);
          }
          const pendingStateActivityLogs = Array.isArray(
            pendingState?.state?.stateSnapshot?.activityLogs
          )
            ? pendingState.state.stateSnapshot.activityLogs
            : [];
          const pendingActivityLogsForReconciliation = [
            ...pendingActivityLogs,
            ...pendingStateActivityLogs,
          ];
          const careReconciliationPlan = buildCareMistakeReconciliationPlan({
            slotData,
            savedStats,
            activityLogs: reconciliationActivityLogLoadFailed
              ? null
              : reconciliationActivityLogs,
            incidents: loadedCareMistakeIncidents,
            pendingActivityLogs: pendingActivityLogLoadFailed
              ? null
              : pendingActivityLogsForReconciliation,
          });
          const legacyCareProjection = resolveCareMistakeProjectionFromSlot(
            slotData,
            savedStats
          );
          const hasPendingCareTransitions =
            pendingCareTransitions.length > 0 ||
            Boolean(pendingState?.state?.transition?.transitionType);
          const resolvedStageInstanceId =
            careReconciliationPlan.identity.evolutionStageInstanceId || stageInstanceId;
          const remoteReconciliationStatus =
            slotData.careMistakeReconciliationStatus || null;
          const remoteProjectionMatchesPlan =
            legacyCareProjection.careMistakes === careReconciliationPlan.projection.careMistakes &&
            legacyCareProjection.unresolvedCareMistakeCount ===
              careReconciliationPlan.projection.unresolvedCareMistakeCount &&
            legacyCareProjection.latestUnresolvedCareMistakeIncidentId ===
              careReconciliationPlan.projection.latestUnresolvedCareMistakeIncidentId &&
            legacyCareProjection.latestCareMistakeAt ===
              careReconciliationPlan.projection.latestCareMistakeAt;
          const careLoadPolicy = resolveCareMistakeLoadPolicy({
            hasReadFailure:
              careIncidentLoadFailed ||
              reconciliationActivityLogLoadFailed ||
              pendingActivityLogLoadFailed ||
              pendingCareTransitionLoadFailed ||
              pendingStateLoadFailed,
            plan: careReconciliationPlan,
            hasPendingCareTransitions,
            remoteReconciliationStatus,
            remoteProjectionMatchesPlan,
          });
          if (careLoadPolicy.action === CARE_MISTAKE_LOAD_ACTION.BLOCK) {
            careProjection = {
              ...legacyCareProjection,
              careMistakeReconciliationStatus: careLoadPolicy.status,
              evolutionStageInstanceId: resolvedStageInstanceId,
            };
          } else if (careLoadPolicy.action === CARE_MISTAKE_LOAD_ACTION.WAIT_FOR_LOCAL) {
            // 로컬 전이가 남아 있으면 서버 로그만으로 projection을 확정하지
            // 않는다. 동일한 로컬 체인의 전이를 먼저 원격에 반영한다.
            careProjection = {
              ...legacyCareProjection,
              careMistakeReconciliationStatus:
                CARE_MISTAKE_RECONCILIATION_STATUS.IN_PROGRESS,
              evolutionStageInstanceId: resolvedStageInstanceId,
            };
          } else if (careLoadPolicy.action === CARE_MISTAKE_LOAD_ACTION.ACCEPT_VERIFIED) {
            careProjection = {
              ...careReconciliationPlan.projection,
              careMistakeReconciliationStatus:
                CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
            };
          } else {
            // 로그와 incident를 모두 읽어 검증할 수 있는 경우에만 로드 중
            // reconciliation transaction으로 projection을 활성화한다.
            try {
              const reconciliationResult = await commitCareMistakeReconciliation({
                db,
                slotRef: slotRefForLogs,
                plan: careReconciliationPlan,
                baseRevision: slotData.revision ?? 0,
                runTransaction,
              });
              if (!isCurrentSlotLoadRequest(persistenceAccessRef.current, generation)) return;
              slotData = {
                ...slotData,
                revision: reconciliationResult.revision,
                evolutionStageStartedAt:
                  careReconciliationPlan.recoveredStageStartedAt,
                evolutionStageInstanceId: resolvedStageInstanceId,
                ...reconciliationResult.projection,
                digimonStats: {
                  ...savedStats,
                  evolutionStageStartedAt:
                    careReconciliationPlan.recoveredStageStartedAt,
                  evolutionStageInstanceId: resolvedStageInstanceId,
                  ...reconciliationResult.projection,
                },
              };
              careProjection = reconciliationResult.projection;
            } catch (reconciliationError) {
              console.warn("케어미스 reconciliation 커밋 오류:", reconciliationError);
              if (reconciliationError?.code === "game/reconciliation-in-progress") {
                const retryDelay = resolveCareMistakeReconciliationRetryDelay(
                  reconciliationError.retryAt
                );
                if (retryDelay != null) {
                  reconciliationRetryTimerId = setTimeout(() => {
                    if (!isCurrentSlotLoadRequest(
                      persistenceAccessRef.current,
                      generation
                    )) return;
                    setSlotLoadRetryRevision((revision) => revision + 1);
                  }, retryDelay);
                }
              }
              careProjection = {
                ...legacyCareProjection,
                careMistakeReconciliationStatus:
                  reconciliationError?.code === "game/reconciliation-in-progress"
                    ? CARE_MISTAKE_RECONCILIATION_STATUS.IN_PROGRESS
                    : CARE_MISTAKE_RECONCILIATION_STATUS.FAILED,
                evolutionStageInstanceId: resolvedStageInstanceId,
              };
            }
          }
          savedStats = {
            ...savedStats,
            ...careProjection,
            // incident 정본을 화면용 legacy ledger 형태로만 투영한다.
            // sanitize 단계에서 제거되므로 활동 로그나 슬롯 정본에 재저장되지 않는다.
            ...(!careIncidentLoadFailed && careReconciliationPlan.canActivateProjection
              ? {
                  careMistakeLedger: buildCareMistakeLedgerFromIncidents(
                    careReconciliationPlan.incidents
                  ),
                }
              : {}),
          };
          }

          // lazy reconstruction 결과는 여기서 단독 로그로 저장하지 않는다.
          // 다만 검증 가능한 기존 care evidence의 reconciliation transaction은
          // 위에서 projection·incident와 함께 이미 원자적으로 확정될 수 있다.

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

            const canPersistHydrationReconstruction = ![
              CARE_MISTAKE_RECONCILIATION_STATUS.AMBIGUOUS,
              CARE_MISTAKE_RECONCILIATION_STATUS.FAILED,
            ].includes(careProjection.careMistakeReconciliationStatus);
            if (
              reconstructedLogsToPersist.length > 0 &&
              canPersistHydrationReconstruction
            ) {
              // 재구성 사건이 IndexedDB에 내구성 있게 적재되기 전에는
              // READY phase여도 reconciliation 차단 UI를 유지한다.
              updatePersistenceAccess({
                phase: GAME_PERSISTENCE_PHASE.READY,
                loadedIdentity: loadedPersistenceIdentity,
                careMistakeReconciliationStatus:
                  CARE_MISTAKE_RECONCILIATION_STATUS.IN_PROGRESS,
              });
              const hydrationCareTransition = buildCareMistakeTransitionFromStats({
                previousStats: savedStats,
                nextStats: hydrationResult.digimonStats,
                previousLogs: [],
                nextLogs: reconstructedLogsToPersist,
                identity: loadedPersistenceIdentity,
                nowMs: Date.now(),
              });
              const hydrationActivityEvents = reconstructedLogsToPersist.filter(
                (log) =>
                  !isCareMistakeActivityLog(log) &&
                  !isCareMistakeResolutionActivityLog(log)
              );
              try {
                await saveStats(
                  hydrationResult.digimonStats,
                  mergeActivityLogs(
                    hydrationResult.activityLogs,
                    reconstructedLogsToPersist
                  ),
                  hydrationCareTransition,
                  {
                    activityEvents: hydrationCareTransition
                      ? []
                      : hydrationActivityEvents,
                    allowCareTransition: true,
                  }
                );
                updatePersistenceAccess({
                  careMistakeReconciliationStatus:
                    careProjection.careMistakeReconciliationStatus,
                });
              } catch (hydrationSaveError) {
                console.warn("hydration 재구성 전이 저장이 대기열에 남았습니다.", hydrationSaveError);
              }
            } else {
              updatePersistenceAccess({
                phase: GAME_PERSISTENCE_PHASE.READY,
                loadedIdentity: loadedPersistenceIdentity,
                loadedRevision: slotData.revision ?? 0,
                careMistakeState: isCareMistakeV2Slot(slotData)
                  ? (careV2Integrity?.careMistakeState || slotData.careMistakeState)
                  : null,
                combatIdentity: {
                  arenaIdentitySchemaVersion: slotData.arenaIdentitySchemaVersion,
                  digimonInstanceId: slotData.digimonInstanceId,
                  combatRevision: slotData.combatRevision,
                },
                careMistakeReconciliationStatus:
                  careProjection.careMistakeReconciliationStatus,
              });
            }
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
      if (reconciliationRetryTimerId != null) {
        clearTimeout(reconciliationRetryTimerId);
      }
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
        if (persistenceAccessRef.current?.careMistakeState?.schemaVersion === 2) {
          await commitCareV2Patch({
            commandId: createCareV2ClientCommandId("background-settings"),
            payload: { updateData: { backgroundSettings: newBackgroundSettings } },
          });
        } else {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await updateDoc(slotRef, {
            backgroundSettings: newBackgroundSettings,
            updatedAt: serverTimestamp(),
          });
        }
        console.log('[saveBackgroundSettings] Firebase 저장 완료');
      } catch (error) {
        console.error("배경화면 설정 저장 오류:", error);
        setError(error);
      }
    } else {
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
    }
  }, [canStartGameplayWrite, captureSaveContext, commitCareV2Patch, slotId, currentUser, isFirebaseAvailable]);

  const saveImmersiveSettings = useCallback(async (newImmersiveSettings) => {
    const saveContext = captureSaveContext();
    if (!slotId || !canStartGameplayWrite(saveContext)) return false;

    const normalizedSettings = normalizeImmersiveSettings(newImmersiveSettings);

    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        if (persistenceAccessRef.current?.careMistakeState?.schemaVersion === 2) {
          await commitCareV2Patch({
            commandId: createCareV2ClientCommandId("immersive-settings"),
            payload: { updateData: { immersiveSettings: normalizedSettings } },
          });
        } else {
          const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
          await updateDoc(slotRef, {
            immersiveSettings: normalizedSettings,
            updatedAt: serverTimestamp(),
          });
        }
        console.log("[saveImmersiveSettings] Firebase 저장 완료");
      } catch (saveError) {
        console.error("몰입형 설정 저장 오류:", saveError);
        setError(saveError);
      }
    } else {
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
    }
  }, [canStartGameplayWrite, captureSaveContext, commitCareV2Patch, slotId, currentUser, isFirebaseAvailable]);

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
        if (persistenceAccessRef.current?.careMistakeState?.schemaVersion === 2) {
          const sameForm = selectedDigimon === nextSelectedDigimon;
          const combatIdentity = options.newLife === true
            ? createNewLifeCombatIdentity()
            : sameForm
              ? {}
              : buildFormTransitionCombatIdentity(
                  persistenceAccessRef.current.combatIdentity
                );
          const nextDigimonInstanceId = options.newLife === true
            ? combatIdentity.digimonInstanceId
            : persistenceAccessRef.current.loadedIdentity?.digimonInstanceId;
          const nextEvolutionStageInstanceId = buildEvolutionStageInstanceId({
            digimonInstanceId: nextDigimonInstanceId,
            evolutionStageStartedAt:
              digimonStats?.evolutionStageStartedAt || digimonStats?.lastSavedAt || Date.now(),
            evolutionStage: digimonStats?.evolutionStage || nextSelectedDigimon,
          });
          await commitCareV2Patch({
            commandId: createCareV2ClientCommandId(
              options.newLife === true ? "new-life" : "selected-digimon"
            ),
            commandType: options.newLife === true
              ? "NEW_LIFE"
              : sameForm ? "STATE_MUTATION" : "EVOLUTION",
            payload: {
              updateData: {
                ...combatIdentity,
                selectedDigimon: nextSelectedDigimon,
                digimonDisplayName: buildDigimonDisplayName(
                  nextSelectedDigimon,
                  digimonNickname,
                  evolutionDataForSlot
                ),
                isLightsOn,
                wakeUntil,
              },
              ...(options.newLife === true ? { nextDigimonInstanceId } : {}),
              ...(!sameForm || options.newLife === true
                ? { nextEvolutionStageInstanceId }
                : {}),
            },
          });
          return;
        }
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
      commitCareV2Patch,
      digimonStats,
      selectedDigimon,
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
    saveStatsCommand,
    saveEvolutionTransition,
    saveNewLifeTransition,
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
      pendingSaveCount,
      oldestPendingAt,
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
