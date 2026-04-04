import { toTimestamp } from "../../utils/fridgeTime";

export const CARE_MISTAKE_SYNC_TEXT = "[기록 동기화] 과거 케어미스 기록이 없어 카운터 기준으로 보정됨";

function ensureTimestamp(value) {
  return toTimestamp(value);
}

function isSleepDisturbanceLike(log) {
  if (!log) return false;
  if (log.type === "SLEEP_DISTURBANCE") return true;
  const text = (log.text || "").trim();
  if (!text.includes("수면 방해")) return false;
  return log.type === "CARE_MISTAKE" || log.type === "CAREMISTAKE";
}

export function isCareMistakeLog(log) {
  if (!log || isSleepDisturbanceLike(log)) return false;
  if (log.type === "CAREMISTAKE") return true;
  if (log.type === "CARE_MISTAKE") {
    const text = (log.text || "").trim();
    return text.includes("케어미스") || text.includes("Care Mistake");
  }
  return false;
}

export function getCareMistakeReasonKeyFromText(text = "") {
  if (text.includes("배고픔 콜")) return "hunger_call";
  if (text.includes("힘 콜")) return "strength_call";
  if (text.includes("괴롭히기")) return "tease";
  if (text.includes("[기록 동기화]")) return "sync_repair";
  return "other";
}

function inferCareMistakeSource(text = "") {
  if (text.includes("[과거 재구성]")) return "backfill";
  if (text.includes("괴롭히기")) return "interaction";
  if (text.includes("[기록 동기화]")) return "sync";
  return "realtime";
}

export function buildCareMistakeEventId(reasonKey, occurredAt) {
  const timestamp = ensureTimestamp(occurredAt);
  return timestamp == null ? null : `${reasonKey}:${timestamp}`;
}

export function getCareMistakeEventIdFromLog(log) {
  if (!isCareMistakeLog(log)) return null;
  const occurredAt = ensureTimestamp(log.timestamp);
  if (occurredAt == null) return null;
  return buildCareMistakeEventId(getCareMistakeReasonKeyFromText(log.text || ""), occurredAt);
}

function normalizeLedgerEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const occurredAt = ensureTimestamp(entry.occurredAt);
  if (occurredAt == null) return null;
  const reasonKey = entry.reasonKey || "other";
  return {
    id: entry.id || buildCareMistakeEventId(reasonKey, occurredAt),
    occurredAt,
    reasonKey,
    text: entry.text || "케어미스 발생",
    source: entry.source || inferCareMistakeSource(entry.text || ""),
    resolvedAt: ensureTimestamp(entry.resolvedAt) ?? null,
    resolvedBy: entry.resolvedBy || null,
  };
}

export function initializeCareMistakeLedger(existingLedger = []) {
  if (!Array.isArray(existingLedger)) return [];
  return existingLedger
    .map(normalizeLedgerEntry)
    .filter(Boolean)
    .sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));
}

export function getActiveCareMistakeEntries(ledger = []) {
  return initializeCareMistakeLedger(ledger).filter((entry) => entry.resolvedAt == null);
}

export function countActiveCareMistakeEntries(ledger = []) {
  return getActiveCareMistakeEntries(ledger).length;
}

export function appendCareMistakeEntry(stats = {}, { occurredAt = Date.now(), reasonKey = "other", text = "케어미스 발생", source = "realtime", id = null } = {}) {
  const repairedStats = repairCareMistakeLedger(stats, stats.activityLogs || []).nextStats;
  const ledger = initializeCareMistakeLedger(repairedStats.careMistakeLedger);
  const timestamp = ensureTimestamp(occurredAt) ?? Date.now();
  const eventId = id || buildCareMistakeEventId(reasonKey, timestamp);
  if (eventId && ledger.some((entry) => entry.id === eventId)) {
    return {
      added: false,
      entry: ledger.find((entry) => entry.id === eventId) || null,
      nextStats: {
        ...repairedStats,
        careMistakeLedger: ledger,
      },
    };
  }

  const entry = normalizeLedgerEntry({
    id: eventId,
    occurredAt: timestamp,
    reasonKey,
    text,
    source,
    resolvedAt: null,
    resolvedBy: null,
  });
  const nextLedger = [...ledger, entry].sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));

  return {
    added: true,
    entry,
    nextStats: {
      ...repairedStats,
      careMistakes: (repairedStats.careMistakes || 0) + 1,
      careMistakeLedger: nextLedger,
    },
  };
}

export function resolveLatestCareMistakeEntry(stats = {}, { resolvedAt = Date.now(), resolvedBy = "play_or_snack" } = {}) {
  const repairedStats = repairCareMistakeLedger(stats, stats.activityLogs || []).nextStats;
  const ledger = initializeCareMistakeLedger(repairedStats.careMistakeLedger);
  const unresolved = getActiveCareMistakeEntries(ledger);
  const target = unresolved[unresolved.length - 1];

  if (!target) {
    return {
      resolved: false,
      resolvedEntry: null,
      nextStats: {
        ...repairedStats,
        careMistakeLedger: ledger,
        careMistakes: Math.max(0, repairedStats.careMistakes || 0),
      },
    };
  }

  const resolvedTimestamp = ensureTimestamp(resolvedAt) ?? Date.now();
  const nextLedger = ledger.map((entry) => {
    if (entry.id !== target.id) return entry;
    return {
      ...entry,
      resolvedAt: resolvedTimestamp,
      resolvedBy,
    };
  });

  return {
    resolved: true,
    resolvedEntry: nextLedger.find((entry) => entry.id === target.id) || null,
    nextStats: {
      ...repairedStats,
      careMistakes: Math.max(0, (repairedStats.careMistakes || 0) - 1),
      careMistakeLedger: nextLedger,
    },
  };
}

export function buildCareMistakeLedgerFromActivityLogs(activityLogs = [], currentStageStartedAt = null) {
  const stageStartedAt = ensureTimestamp(currentStageStartedAt);
  const seen = new Set();
  return (Array.isArray(activityLogs) ? activityLogs : [])
    .filter((log) => isCareMistakeLog(log))
    .filter((log) => {
      const timestamp = ensureTimestamp(log.timestamp);
      if (timestamp == null) return false;
      if (stageStartedAt == null) return true;
      return timestamp >= stageStartedAt;
    })
    .sort((a, b) => (ensureTimestamp(a.timestamp) || 0) - (ensureTimestamp(b.timestamp) || 0))
    .reduce((entries, log) => {
      const occurredAt = ensureTimestamp(log.timestamp);
      const reasonKey = getCareMistakeReasonKeyFromText(log.text || "");
      const id = buildCareMistakeEventId(reasonKey, occurredAt);
      if (id == null || seen.has(id)) return entries;
      seen.add(id);
      entries.push({
        id,
        occurredAt,
        reasonKey,
        text: log.text || "케어미스 발생",
        source: inferCareMistakeSource(log.text || ""),
        resolvedAt: null,
        resolvedBy: null,
      });
      return entries;
    }, []);
}

export function repairCareMistakeLedger(stats = {}, activityLogs = [], options = {}) {
  const currentStageStartedAt = options.currentStageStartedAt ?? stats.evolutionStageStartedAt ?? null;
  const targetCount = Math.max(0, Number(stats.careMistakes) || 0);
  let changed = false;
  let ledger = initializeCareMistakeLedger(stats.careMistakeLedger);

  const fallbackEntries = buildCareMistakeLedgerFromActivityLogs(activityLogs, currentStageStartedAt);
  const existingIds = new Set(ledger.map((entry) => entry.id));

  fallbackEntries.forEach((entry) => {
    if (existingIds.has(entry.id)) return;
    ledger.push(entry);
    existingIds.add(entry.id);
    changed = true;
  });

  ledger = ledger.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));

  let activeEntries = getActiveCareMistakeEntries(ledger);
  if (activeEntries.length > targetCount) {
    let remaining = activeEntries.length - targetCount;
    ledger = [...ledger];
    for (let index = ledger.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const entry = ledger[index];
      if (entry.resolvedAt != null) continue;
      ledger[index] = {
        ...entry,
        resolvedAt: entry.occurredAt,
        resolvedBy: null,
      };
      remaining -= 1;
      changed = true;
    }
  }

  activeEntries = getActiveCareMistakeEntries(ledger);
  const activeCount = activeEntries.length;
  if (activeCount < targetCount) {
    const baseTime = ensureTimestamp(currentStageStartedAt) ?? Date.now();
    const placeholdersNeeded = targetCount - activeCount;
    for (let index = 0; index < placeholdersNeeded; index += 1) {
      let occurredAt = baseTime + activeCount + index;
      let id = buildCareMistakeEventId("sync_repair", occurredAt);
      while (id && existingIds.has(id)) {
        occurredAt += 1;
        id = buildCareMistakeEventId("sync_repair", occurredAt);
      }
      if (!id) continue;
      ledger.push({
        id,
        occurredAt,
        reasonKey: "sync_repair",
        text: CARE_MISTAKE_SYNC_TEXT,
        source: "sync",
        resolvedAt: null,
        resolvedBy: null,
      });
      existingIds.add(id);
      changed = true;
    }
  }

  const nextStats = changed
    ? { ...stats, careMistakeLedger: ledger.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0)) }
    : { ...stats, careMistakeLedger: ledger };

  return {
    repaired: changed,
    nextStats,
    activeEntries: getActiveCareMistakeEntries(nextStats.careMistakeLedger),
  };
}

export function getDisplayCareMistakeEntries(stats = {}, activityLogs = [], options = {}) {
  const { nextStats, repaired, activeEntries } = repairCareMistakeLedger(stats, activityLogs, options);
  const targetCount = Math.max(0, Number(stats.careMistakes) || 0);
  if (activeEntries.length <= targetCount) {
    return {
      repaired,
      ledger: nextStats.careMistakeLedger,
      entries: activeEntries,
    };
  }
  return {
    repaired,
    ledger: nextStats.careMistakeLedger,
    entries: activeEntries.slice(activeEntries.length - targetCount),
  };
}
