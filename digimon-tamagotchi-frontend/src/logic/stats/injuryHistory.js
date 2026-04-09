import { toEpochMs } from "../../utils/time";
import {
  getLifeStartDigimonId,
  resolveDigimonLogName,
  resolveDigimonSnapshotFromToken,
  sanitizeDigimonLogSnapshot,
} from "../../utils/digimonLogSnapshot";
import { buildActivityLogEventId } from "../../utils/activityLogEventId";

function hasInjuryText(text = "") {
  return text.includes("Injury") || text.includes("부상");
}

function normalizeInjuryReason(text = "", fallback = "general") {
  if (text.includes("poop") || text.includes("똥")) return "poop";
  if (text.includes("battle") || text.includes("Battle") || text.includes("배틀")) return "battle";
  return fallback;
}

function isInjuryActivityLog(log) {
  if (!log?.text) return false;
  if (log.type === "POOP" && hasInjuryText(log.text)) return true;
  if (log.type === "BATTLE" && hasInjuryText(log.text)) return true;
  if (log.type === "INJURY") return true;
  return false;
}

function isInjuryBattleLog(log) {
  if (log?.injury === true) return true;
  if (!log?.text) return false;
  return hasInjuryText(log.text);
}

function hasDigimonSnapshot(entry) {
  return Boolean(entry?.digimonId || entry?.digimonName);
}

function getLogSnapshot(log, digimonDataMap = null) {
  const snapshot = sanitizeDigimonLogSnapshot(log);
  if (snapshot.digimonName || !snapshot.digimonId) return snapshot;

  return sanitizeDigimonLogSnapshot({
    digimonId: snapshot.digimonId,
    digimonName: resolveDigimonLogName(snapshot.digimonId, digimonDataMap),
  });
}

function toInjuryEntry(log, inputSource, digimonDataMap = null) {
  const timestamp = toEpochMs(log?.timestamp);
  const text = typeof log?.text === "string" ? log.text : "";
  const source = normalizeInjuryReason(text, inputSource === "battleLog" ? "battle" : "general");

  if (timestamp == null || !text) return null;

  return {
    timestamp,
    text,
    eventId: buildActivityLogEventId(log),
    source,
    inputSource,
    normalizedReason: normalizeInjuryReason(text, source),
    resolvedFromFallback: false,
    ...getLogSnapshot(log, digimonDataMap),
  };
}

function byEntryPriority(a, b) {
  if ((b?.timestamp || 0) !== (a?.timestamp || 0)) {
    return (b?.timestamp || 0) - (a?.timestamp || 0);
  }

  if (a?.inputSource === b?.inputSource) return 0;
  return a?.inputSource === "battleLog" ? -1 : 1;
}

function mergeDuplicateEntry(existing, candidate) {
  return {
    ...existing,
    ...(existing?.digimonId ? {} : candidate?.digimonId ? { digimonId: candidate.digimonId } : {}),
    ...(existing?.digimonName ? {} : candidate?.digimonName ? { digimonName: candidate.digimonName } : {}),
  };
}

function isDigimonTransitionLog(log) {
  return log?.type === "EVOLUTION" || log?.type === "NEW_START" || log?.type === "REINCARNATION";
}

function parseTransitionToken(text = "") {
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

function extractTransitionSnapshot(log, digimonDataMap = null) {
  if (!isDigimonTransitionLog(log)) return null;

  const timestamp = toEpochMs(log?.timestamp);
  if (timestamp == null) return null;

  const directSnapshot = getLogSnapshot(log, digimonDataMap);
  if (hasDigimonSnapshot(directSnapshot)) {
    return {
      timestamp,
      ...directSnapshot,
    };
  }

  const parsedToken = parseTransitionToken(log?.text || "");
  const parsedSnapshot = resolveDigimonSnapshotFromToken(parsedToken, digimonDataMap);
  if (!hasDigimonSnapshot(parsedSnapshot)) return null;

  return {
    timestamp,
    ...parsedSnapshot,
  };
}

function resolveFallbackSnapshots(
  entries = [],
  activityLogs = [],
  { currentLifeStartedAt = null, slotVersion = "Ver.1", currentDigimonId = null, digimonDataMap = null } = {}
) {
  const lifeStartedAt = toEpochMs(currentLifeStartedAt);
  const transitionLogs = (activityLogs || [])
    .map((log) => ({
      log,
      timestamp: toEpochMs(log?.timestamp),
    }))
    .filter(({ timestamp }) => {
      if (timestamp == null) return false;
      if (lifeStartedAt == null) return true;
      return timestamp >= lifeStartedAt;
    })
    .map(({ log }) => extractTransitionSnapshot(log, digimonDataMap))
    .filter(Boolean)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let transitionIndex = 0;
  let currentSnapshot = sanitizeDigimonLogSnapshot({
    digimonId: getLifeStartDigimonId(slotVersion, currentDigimonId),
    digimonName: resolveDigimonLogName(
      getLifeStartDigimonId(slotVersion, currentDigimonId),
      digimonDataMap
    ),
  });

  return [...entries]
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .map((entry) => {
      while (
        transitionIndex < transitionLogs.length &&
        (transitionLogs[transitionIndex]?.timestamp || 0) <= (entry?.timestamp || 0)
      ) {
        currentSnapshot = sanitizeDigimonLogSnapshot({
          digimonId: transitionLogs[transitionIndex]?.digimonId || currentSnapshot.digimonId,
          digimonName: transitionLogs[transitionIndex]?.digimonName || currentSnapshot.digimonName,
        });
        transitionIndex += 1;
      }

      if (hasDigimonSnapshot(entry)) {
        return {
          ...entry,
          resolvedFromFallback: false,
        };
      }

      if (!hasDigimonSnapshot(currentSnapshot)) {
        return {
          ...entry,
          digimonId: null,
          digimonName: null,
          resolvedFromFallback: true,
        };
      }

      return {
        ...entry,
        ...currentSnapshot,
        resolvedFromFallback: true,
      };
    })
    .sort(byEntryPriority);
}

export function getDisplayInjuryEntries({
  activityLogs = [],
  battleLogs = [],
  currentLifeStartedAt = null,
  slotVersion = "Ver.1",
  currentDigimonId = null,
  digimonDataMap = null,
} = {}) {
  const lifeStartedAt = toEpochMs(currentLifeStartedAt);

  const candidates = [
    ...(battleLogs || [])
      .filter(isInjuryBattleLog)
      .map((log) => toInjuryEntry(log, "battleLog", digimonDataMap)),
    ...(activityLogs || [])
      .filter(isInjuryActivityLog)
      .map((log) => toInjuryEntry(log, "activityLog", digimonDataMap)),
  ]
    .filter(Boolean)
    .filter((entry) => lifeStartedAt == null || entry.timestamp >= lifeStartedAt)
    .sort(byEntryPriority);

  const dedupeOrder = [];
  const dedupedByKey = new Map();

  candidates.forEach((entry) => {
    const dedupeKey =
      entry.eventId ||
      `${entry.timestamp}:${entry.source}:${entry.normalizedReason}`;
    if (!dedupedByKey.has(dedupeKey)) {
      dedupedByKey.set(dedupeKey, entry);
      dedupeOrder.push(dedupeKey);
      return;
    }

    dedupedByKey.set(dedupeKey, mergeDuplicateEntry(dedupedByKey.get(dedupeKey), entry));
  });

  return resolveFallbackSnapshots(
    dedupeOrder.map((key) => dedupedByKey.get(key)),
    activityLogs,
    {
      currentLifeStartedAt,
      slotVersion,
      currentDigimonId,
      digimonDataMap,
    }
  );
}

export function buildTickPoopInjuryLogs(prevStats = {}, nextStats = {}, digimonSnapshot = {}) {
  const prevInjuries = Number(prevStats?.injuries) || 0;
  const nextInjuries = Number(nextStats?.injuries) || 0;
  const injuryDelta = Math.max(0, nextInjuries - prevInjuries);

  if (injuryDelta <= 0) return [];
  if (nextStats?.injuryReason !== "poop") return [];

  const prevPoopCount = Number(prevStats?.poopCount) || 0;
  const nextPoopCount = Number(nextStats?.poopCount) || 0;

  // 7→8 즉시 부상은 기존 poopCount 증가 로그 경로가 이미 담당한다.
  if (nextPoopCount > prevPoopCount) return [];

  const baseTimestamp =
    toEpochMs(nextStats?.lastPoopPenaltyAt) ??
    toEpochMs(nextStats?.injuredAt) ??
    Date.now();
  const sanitizedSnapshot = sanitizeDigimonLogSnapshot(digimonSnapshot);

  return Array.from({ length: injuryDelta }, (_, index) => ({
    type: "POOP",
    text:
      injuryDelta > 1
        ? `똥 8개 방치 8시간 경과 - 추가 부상 (${index + 1}/${injuryDelta})`
        : "똥 8개 방치 8시간 경과 - 추가 부상",
    timestamp: baseTimestamp + index,
    ...sanitizedSnapshot,
  }));
}
