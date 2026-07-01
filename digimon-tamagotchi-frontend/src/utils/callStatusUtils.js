import { formatTimestamp } from "./dateUtils";
import { toEpochMs } from "./time";
import {
  buildCareMistakeEventId,
  getCareMistakeReasonKeyFromText,
  initializeCareMistakeLedger,
} from "../logic/stats/careMistakeLedger";

const HUNGER_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const STRENGTH_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const SLEEP_LIGHT_WARNING_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ACKNOWLEDGED_RECENT_CALL_IDS = 50;

const CALL_META = {
  hunger: {
    title: "배고픔 호출",
    reason: "포만감이 0이 되어 바로 먹이를 줘야 합니다.",
    actionKey: "open-feed",
    actionLabel: "먹이 메뉴 열기",
    riskText: "10분을 넘기면 케어미스가 1 증가합니다.",
  },
  strength: {
    title: "힘 호출",
    reason: "힘이 0이 되어 회복이 필요합니다.",
    actionKey: "open-feed",
    actionLabel: "먹이 메뉴 열기",
    riskText: "10분을 넘기면 케어미스가 1 증가합니다.",
  },
  sleep: {
    title: "수면 조명 경고",
    reason: "잠들어 있는데 조명이 켜져 있어요. 불을 꺼 주세요.",
    actionKey: "open-lights",
    actionLabel: "조명 설정 열기",
    riskText: "30분을 넘기면 케어미스가 1 증가합니다.",
  },
};

const CARE_MISTAKE_REASON_TO_CALL_TYPE = {
  hunger_call: "hunger",
  strength_call: "strength",
  sleep_light_warning: "sleep",
};

export function normalizeSleepStatusForDisplay(sleepStatus) {
  if (sleepStatus === "TIRED" || sleepStatus === "SLEEPY") {
    return "SLEEPING_LIGHT_ON";
  }

  return sleepStatus;
}

function isSleepingLikeStatus(sleepStatus) {
  const normalized = normalizeSleepStatusForDisplay(sleepStatus);

  return (
    normalized === "NAPPING" ||
    normalized === "SLEEPING" ||
    normalized === "SLEEPING_LIGHT_ON"
  );
}

function ensureTimestamp(value) {
  return toEpochMs(value);
}

function formatDurationMs(diffMs) {
  const safeDiff = Math.max(0, diffMs || 0);
  const totalSeconds = Math.floor(safeDiff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}분 ${seconds}초`;
}

function replaceLegacyCallTerms(text) {
  return text
    .replace(/배고픔 콜/g, "배고픔 호출")
    .replace(/힘 콜/g, "힘 호출")
    .replace(/수면 호출/g, "수면 조명 경고")
    .replace(/\s*\[과거 재구성\]\s*/g, "")
    .trim();
}

function hashStableText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeCallLogText(value) {
  const rawText =
    typeof value === "string" ? value : typeof value?.text === "string" ? value.text : "";
  const trimmedText = rawText.trim();

  if (!trimmedText) return "";
  if (trimmedText === "Call: Hungry!") return "배고픔 호출이 시작되었습니다.";
  if (trimmedText === "Call: No Energy!") return "힘 호출이 시작되었습니다.";
  if (trimmedText === "Call: Sleepy!") return "수면 조명 경고가 시작되었습니다.";

  return replaceLegacyCallTerms(trimmedText);
}

function normalizeCallHistoryTitle(log) {
  const normalizedText = normalizeCallLogText(log);

  if (normalizedText.includes("배고픔 호출")) return "배고픔 호출";
  if (normalizedText.includes("힘 호출")) return "힘 호출";
  if (normalizedText.includes("수면 조명 경고")) return "수면 조명 경고";
  if (normalizedText.includes("케어미스")) return "케어미스";

  return log?.type === "CALL" ? "호출" : "최근 기록";
}

function inferCallTypeFromText(text = "") {
  const normalizedText = normalizeCallLogText(text);
  if (normalizedText.includes("배고픔 호출")) return "hunger";
  if (normalizedText.includes("힘 호출")) return "strength";
  if (normalizedText.includes("수면 조명 경고")) return "sleep";
  return null;
}

function buildMissedCallText(type) {
  const title = CALL_META[type]?.title || "호출";
  return type === "sleep"
    ? "수면 조명 경고가 케어미스로 처리되었습니다."
    : `${title}이 케어미스로 처리되었습니다.`;
}

function buildCanonicalRecentCallId({
  type = "unknown",
  status = "logged",
  timestamp = null,
  sourceId = null,
  text = "",
}) {
  if (typeof sourceId === "string" && sourceId.trim()) {
    return sourceId.trim();
  }

  const safeTimestamp = timestamp ?? "na";
  if (type !== "unknown") {
    return `call:${type}:${status}:${safeTimestamp}`;
  }

  return `call:unknown:${status}:${safeTimestamp}:${hashStableText(text)}`;
}

function buildLegacyRecentCallIds({ log, type, status, timestamp, text }) {
  const ids = [];
  if (log?.type && timestamp != null) {
    // 이전 구현은 정렬 index를 붙였기 때문에, 과거 확인값을 최대한 흡수한다.
    for (let index = 0; index < 5; index += 1) {
      ids.push(`${log.type}-${timestamp}- ${index}`.replace("- ", "-"));
    }
  }
  if (timestamp != null && type) {
    ids.push(`logged-${type}-${timestamp}`);
    ids.push(`${log?.type || "LOG"}-${timestamp}-0`);
    ids.push(buildCanonicalRecentCallId({ type, status, timestamp, text }));
  }
  return [...new Set(ids.filter(Boolean))];
}

function isCallRelatedHistory(log) {
  if (!log) return false;
  if (log.type === "CALL") return true;

  const normalizedText = normalizeCallLogText(log);
  if (!normalizedText.includes("케어미스")) return false;

  return (
    normalizedText.includes("배고픔 호출") ||
    normalizedText.includes("힘 호출") ||
    normalizedText.includes("수면 조명 경고")
  );
}

function buildRecentCallHistory(activityLogs) {
  return [...activityLogs]
    .filter(isCallRelatedHistory)
    .sort((a, b) => (ensureTimestamp(b.timestamp) || 0) - (ensureTimestamp(a.timestamp) || 0))
    .map((log) => {
      const timestamp = ensureTimestamp(log.timestamp);
      const normalizedText = normalizeCallLogText(log);
      const isCareMistake = normalizedText.includes("케어미스");
      const type = inferCallTypeFromText(normalizedText) || "unknown";
      const status = isCareMistake ? "missed" : "logged";
      const reasonKey = isCareMistake
        ? getCareMistakeReasonKeyFromText(log.text || normalizedText)
        : null;
      const sourceId = isCareMistake
        ? buildCareMistakeEventId(reasonKey, timestamp)
        : log.eventId;
      const text = isCareMistake
        ? buildMissedCallText(type)
        : normalizedText || log.type || "기록";

      return {
        id: buildCanonicalRecentCallId({ type, status, timestamp, sourceId, text }),
        legacyIds: buildLegacyRecentCallIds({ log, type, status, timestamp, text }),
        dedupeKey: `${type}:${status}:${timestamp || "na"}`,
        callType: type,
        status,
        source: "activityLog",
        isReconstructed: typeof log.text === "string" && log.text.includes("[과거 재구성]"),
        type: log.type || "LOG",
        title: normalizeCallHistoryTitle(log),
        text,
        timestamp,
        timestampLabel: timestamp ? formatTimestamp(timestamp) : "시간 정보 없음",
      };
    });
}

function buildRecentLedgerHistory(careMistakeLedger) {
  return initializeCareMistakeLedger(careMistakeLedger)
    .map((entry) => {
      const type = CARE_MISTAKE_REASON_TO_CALL_TYPE[entry.reasonKey];
      if (!type) return null;

      const timestamp = ensureTimestamp(entry.occurredAt);
      const text = buildMissedCallText(type);
      return {
        id: buildCanonicalRecentCallId({
          type,
          status: "missed",
          timestamp,
          sourceId: entry.id,
          text,
        }),
        legacyIds: buildLegacyRecentCallIds({
          log: { type: "CAREMISTAKE" },
          type,
          status: "missed",
          timestamp,
          text,
        }),
        dedupeKey: `${type}:missed:${timestamp || "na"}`,
        callType: type,
        status: "missed",
        source: "ledger",
        isReconstructed: entry.source === "backfill",
        type: "CAREMISTAKE",
        title: CALL_META[type]?.title || "호출",
        text,
        timestamp,
        timestampLabel: timestamp ? formatTimestamp(timestamp) : "시간 정보 없음",
      };
    })
    .filter(Boolean);
}

function buildRecentLoggedCallEntry({ type, callEntry, currentTimeMs }) {
  if (!callEntry?.isLogged) return null;

  const startedAt = ensureTimestamp(callEntry.startedAt);
  if (startedAt == null) return null;

  const timeoutMs =
    type === "sleep"
      ? SLEEP_LIGHT_WARNING_TIMEOUT_MS
      : type === "strength"
        ? STRENGTH_CALL_TIMEOUT_MS
        : HUNGER_CALL_TIMEOUT_MS;
  const timestamp = startedAt + timeoutMs;
  const title = CALL_META[type]?.title || "호출";
  const text =
    type === "sleep"
      ? "수면 조명 경고가 케어미스로 처리되었습니다."
      : `${title}이 케어미스로 처리되었습니다.`;

  return {
    id: buildCanonicalRecentCallId({ type, status: "missed", timestamp, text }),
    legacyIds: [`logged-${type}-${timestamp || "na"}`],
    dedupeKey: `${type}:missed:${timestamp || "na"}`,
    callType: type,
    status: "missed",
    source: "callStatus",
    isReconstructed: false,
    type: "CAREMISTAKE",
    title,
    text,
    timestamp,
    timestampLabel: timestamp ? formatTimestamp(timestamp) : "시간 정보 없음",
  };
}

function mergeRecentCallHistory(activityLogs, callStatus, careMistakeLedger, currentTimeMs) {
  const loggedEntries = ["hunger", "strength", "sleep"]
    .map((type) => buildRecentLoggedCallEntry({
      type,
      callEntry: callStatus?.[type],
      currentTimeMs,
    }))
    .filter(Boolean);

  const priority = {
    ledger: 0,
    activityLog: 1,
    callStatus: 2,
  };
  const mergedByKey = new Map();

  [...buildRecentLedgerHistory(careMistakeLedger), ...buildRecentCallHistory(activityLogs), ...loggedEntries]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .forEach((entry) => {
      const key = entry.dedupeKey || entry.id;
      const existing = mergedByKey.get(key);
      if (!existing || (priority[entry.source] ?? 99) < (priority[existing.source] ?? 99)) {
        mergedByKey.set(key, {
          ...entry,
          legacyIds: [...new Set([...(existing?.legacyIds || []), ...(entry.legacyIds || [])])],
        });
        return;
      }

      mergedByKey.set(key, {
        ...existing,
        legacyIds: [...new Set([...(existing.legacyIds || []), ...(entry.legacyIds || [])])],
      });
    });

  return [...mergedByKey.values()]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 5);
}

function normalizeAcknowledgedRecentCallIds(value) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.trim()).slice(-MAX_ACKNOWLEDGED_RECENT_CALL_IDS)
    : [];
}

export function mergeAcknowledgedRecentCallIds(existingIds, nextIds) {
  const merged = [
    ...normalizeAcknowledgedRecentCallIds(existingIds),
    ...normalizeAcknowledgedRecentCallIds(nextIds),
  ];

  return [...new Set(merged)].slice(-MAX_ACKNOWLEDGED_RECENT_CALL_IDS);
}

function buildDeadlineText(deadlineMs, prefix = "데드라인") {
  return deadlineMs ? `${prefix}: ${formatTimestamp(deadlineMs)}` : "";
}

function buildHungerOrStrengthCall({
  type,
  title,
  reason,
  actionKey,
  actionLabel,
  riskText,
  currentTimeMs,
  statValue,
  isFrozen,
  sleepStatus,
  callEntry,
  deadlineMs,
  lastZeroAtMs,
  timeoutMs,
}) {
  const startedAt =
    ensureTimestamp(callEntry?.startedAt) ?? ensureTimestamp(lastZeroAtMs);
  const sleepStartAt = ensureTimestamp(callEntry?.sleepStartAt);
  const shouldShowFrozenState = isFrozen && statValue === 0;
  const hasRealtimeCall = Boolean(
    callEntry?.isActive &&
      callEntry?.isLogged !== true &&
      (startedAt || deadlineMs || statValue === 0)
  );

  if (!shouldShowFrozenState && !hasRealtimeCall) {
    return null;
  }

  const effectiveDeadlineMs =
    ensureTimestamp(deadlineMs) ?? (startedAt != null ? startedAt + timeoutMs : currentTimeMs + timeoutMs);
  const isPausedByFrozen = shouldShowFrozenState;
  const isPausedBySleep = !isPausedByFrozen && isSleepingLikeStatus(sleepStatus);
  const referenceTimeMs = isPausedBySleep ? sleepStartAt ?? currentTimeMs : currentTimeMs;
  const remainingMs = Math.max(0, effectiveDeadlineMs - referenceTimeMs);
  const isPaused = isPausedByFrozen || isPausedBySleep;

  let statusLabel = `남은 시간 ${formatDurationMs(remainingMs)}`;
  let pauseReason = "";
  let deadlineText = buildDeadlineText(effectiveDeadlineMs);

  if (isPausedByFrozen) {
    statusLabel = "냉장고 보관 중으로 호출이 정지되었습니다.";
    pauseReason = "냉장고에서 꺼내면 호출 타이머가 다시 이어집니다.";
    deadlineText = buildDeadlineText(effectiveDeadlineMs, "직전 데드라인");
  } else if (isPausedBySleep) {
    statusLabel = `수면 중 일시정지 - ${formatDurationMs(remainingMs)} 남음`;
    pauseReason = "잠든 동안에는 호출 타이머가 멈춰 있습니다.";
  }

  return {
    type,
    title,
    reason,
    statusLabel,
    remainingMs,
    deadlineText,
    riskText,
    isPaused,
    pauseReason,
    actionKey,
    actionLabel,
  };
}

function buildSleepCall({
  currentTimeMs,
  sleepStatus,
  isLightsOn,
  isFrozen,
  callEntry,
  sleepLightOnStart,
}) {
  if (isFrozen) return null;

  const startedAt =
    ensureTimestamp(callEntry?.startedAt) ?? ensureTimestamp(sleepLightOnStart);
  const normalizedSleepStatus = normalizeSleepStatusForDisplay(sleepStatus);
  const hasSleepWarning = Boolean(
    callEntry?.isLogged !== true &&
      (callEntry?.isActive || normalizedSleepStatus === "SLEEPING_LIGHT_ON")
  );

  if (!hasSleepWarning) {
    return null;
  }

  if (startedAt == null) {
    return {
      type: "sleep",
      title: CALL_META.sleep.title,
      reason: CALL_META.sleep.reason,
      statusLabel: "수면 중(불 켜짐 경고!) - 카운트 시작 대기 중",
      remainingMs: 0,
      deadlineText: "",
      riskText: CALL_META.sleep.riskText,
      isPaused: false,
      pauseReason: "경고 시작 시각을 확인하는 중입니다.",
      actionKey: CALL_META.sleep.actionKey,
      actionLabel: CALL_META.sleep.actionLabel,
    };
  }

  const effectiveStartedAt = startedAt;
  const remainingMs = Math.max(
    0,
    effectiveStartedAt + SLEEP_LIGHT_WARNING_TIMEOUT_MS - currentTimeMs
  );
  const statusLabel =
    remainingMs > 0
      ? `수면 중(불 켜짐 경고!) - ${formatDurationMs(remainingMs)} 남음`
      : "수면 중(불 켜짐 경고!) - 케어미스 발생 구간";

  return {
    type: "sleep",
    title: CALL_META.sleep.title,
    reason: CALL_META.sleep.reason,
    statusLabel,
    remainingMs,
    deadlineText: buildDeadlineText(
      effectiveStartedAt + SLEEP_LIGHT_WARNING_TIMEOUT_MS,
      "경고 데드라인"
    ),
    riskText: CALL_META.sleep.riskText,
    isPaused: false,
    pauseReason: "",
    actionKey: CALL_META.sleep.actionKey,
    actionLabel: CALL_META.sleep.actionLabel,
  };
}

export function buildCallStatusViewModel({
  digimonStats = {},
  sleepStatus = "AWAKE",
  isLightsOn = false,
  currentTime = Date.now(),
}) {
  const currentTimeMs = ensureTimestamp(currentTime) ?? Date.now();
  const activityLogs = Array.isArray(digimonStats?.activityLogs) ? digimonStats.activityLogs : [];
  const callStatus = digimonStats?.callStatus || {};
  const acknowledgedRecentCallIds = new Set(
    normalizeAcknowledgedRecentCallIds(digimonStats?.acknowledgedRecentCallIds)
  );

  const activeCalls = [
    buildHungerOrStrengthCall({
      type: "hunger",
      title: CALL_META.hunger.title,
      reason: CALL_META.hunger.reason,
      actionKey: CALL_META.hunger.actionKey,
      actionLabel: CALL_META.hunger.actionLabel,
      riskText: CALL_META.hunger.riskText,
      currentTimeMs,
      statValue: digimonStats?.fullness,
      isFrozen: Boolean(digimonStats?.isFrozen),
      sleepStatus,
      callEntry: callStatus.hunger,
      deadlineMs: digimonStats?.hungerMistakeDeadline,
      lastZeroAtMs: digimonStats?.lastHungerZeroAt,
      timeoutMs: HUNGER_CALL_TIMEOUT_MS,
    }),
    buildHungerOrStrengthCall({
      type: "strength",
      title: CALL_META.strength.title,
      reason: CALL_META.strength.reason,
      actionKey: CALL_META.strength.actionKey,
      actionLabel: CALL_META.strength.actionLabel,
      riskText: CALL_META.strength.riskText,
      currentTimeMs,
      statValue: digimonStats?.strength,
      isFrozen: Boolean(digimonStats?.isFrozen),
      sleepStatus,
      callEntry: callStatus.strength,
      deadlineMs: digimonStats?.strengthMistakeDeadline,
      lastZeroAtMs: digimonStats?.lastStrengthZeroAt,
      timeoutMs: STRENGTH_CALL_TIMEOUT_MS,
    }),
    buildSleepCall({
      currentTimeMs,
      sleepStatus,
      isLightsOn,
      isFrozen: Boolean(digimonStats?.isFrozen),
      callEntry: callStatus.sleep,
      sleepLightOnStart: digimonStats?.sleepLightOnStart,
    }),
  ].filter(Boolean);

  const recentCallHistory = mergeRecentCallHistory(
    activityLogs,
    callStatus,
    digimonStats?.careMistakeLedger,
    currentTimeMs
  )
    .map((entry) => ({
      ...entry,
      isAcknowledged: [entry.id, ...(entry.legacyIds || [])].some((id) =>
        acknowledgedRecentCallIds.has(id)
      ),
    }));
  const hasUnreadRecentCalls = recentCallHistory.some((entry) => !entry.isAcknowledged);
  const summaryLabel = activeCalls.length
    ? `${activeCalls.map((call) => call.title).join(" · ")} 확인 필요`
    : recentCallHistory.length > 0
      ? hasUnreadRecentCalls
        ? "최근 호출 기록 확인"
        : "최근 호출 기록 모두 확인됨"
      : "현재 활성 호출이 없습니다.";
  const defaultTab = activeCalls.length > 0
    ? "active"
    : recentCallHistory.length > 0
      ? "recent"
      : "active";

  return {
    activeCalls,
    recentCallHistory,
    hasActiveCalls: activeCalls.length > 0,
    hasRecentCalls: recentCallHistory.length > 0,
    hasUnreadRecentCalls,
    summaryLabel,
    defaultTab,
  };
}
