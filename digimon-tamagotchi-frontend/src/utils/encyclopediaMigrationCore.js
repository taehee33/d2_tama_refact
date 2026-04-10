const DEFAULT_HISTORY_LIMIT = 5;

function createEmptyEncyclopedia(versions = []) {
  return Object.fromEntries((Array.isArray(versions) ? versions : []).map((version) => [version, {}]));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toEpochMs(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }

  if (typeof value?.seconds === "number") {
    const milliseconds =
      value.seconds * 1000 +
      Math.floor((typeof value.nanoseconds === "number" ? value.nanoseconds : 0) / 1_000_000);
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }

  return null;
}

function normalizeBestStats(bestStats = {}) {
  if (!isPlainObject(bestStats)) {
    return {};
  }

  return { ...bestStats };
}

function normalizeHistoryEntry(historyEntry = {}) {
  if (!isPlainObject(historyEntry)) {
    return null;
  }

  const normalizedDate = toEpochMs(historyEntry.date);
  const normalizedResult =
    typeof historyEntry.result === "string" && historyEntry.result.trim()
      ? historyEntry.result.trim()
      : "";

  return {
    ...(normalizedDate !== null ? { date: normalizedDate } : {}),
    ...(normalizedResult ? { result: normalizedResult } : {}),
    finalStats: isPlainObject(historyEntry.finalStats) ? { ...historyEntry.finalStats } : {},
  };
}

function normalizeHistoryEntries(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(normalizeHistoryEntry)
    .filter(Boolean);
}

function historySignature(entry = {}) {
  return `${toEpochMs(entry.date) ?? "no-date"}::${entry.result || ""}`;
}

function mergeHistoryEntries(baseHistory = [], incomingHistory = []) {
  const mergedEntries = [...normalizeHistoryEntries(baseHistory), ...normalizeHistoryEntries(incomingHistory)];
  const deduped = [];
  const seen = new Set();

  mergedEntries.forEach((entry) => {
    const signature = historySignature(entry);
    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);
    deduped.push(entry);
  });

  deduped.sort((left, right) => {
    const leftDate = toEpochMs(left.date) ?? 0;
    const rightDate = toEpochMs(right.date) ?? 0;

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (left.result || "").localeCompare(right.result || "");
  });

  return deduped.slice(0, DEFAULT_HISTORY_LIMIT);
}

function mergeBestStats(baseStats = {}, incomingStats = {}) {
  const normalizedBase = normalizeBestStats(baseStats);
  const normalizedIncoming = normalizeBestStats(incomingStats);
  const merged = {};

  [...new Set([...Object.keys(normalizedBase), ...Object.keys(normalizedIncoming)])].forEach((key) => {
    const baseValue = normalizedBase[key];
    const incomingValue = normalizedIncoming[key];
    const baseIsNumber = typeof baseValue === "number" && Number.isFinite(baseValue);
    const incomingIsNumber = typeof incomingValue === "number" && Number.isFinite(incomingValue);

    if (baseIsNumber && incomingIsNumber) {
      merged[key] = Math.max(baseValue, incomingValue);
      return;
    }

    if (incomingValue !== undefined) {
      merged[key] = incomingValue;
      return;
    }

    if (baseValue !== undefined) {
      merged[key] = baseValue;
    }
  });

  return merged;
}

function sanitizeEntry(entry = {}) {
  return isPlainObject(entry) ? { ...entry } : {};
}

function inferEntryDiscovered(entry = {}) {
  if (!isPlainObject(entry)) {
    return false;
  }

  if (entry.isDiscovered === true) {
    return true;
  }

  if (typeof entry.raisedCount === "number" && entry.raisedCount > 0) {
    return true;
  }

  if (toEpochMs(entry.firstDiscoveredAt) !== null || toEpochMs(entry.lastRaisedAt) !== null) {
    return true;
  }

  if (isPlainObject(entry.bestStats) && Object.keys(entry.bestStats).length > 0) {
    return true;
  }

  if (Array.isArray(entry.history) && entry.history.length > 0) {
    return true;
  }

  return false;
}

function mergeEncyclopediaEntry(baseEntry = {}, incomingEntry = {}) {
  const base = sanitizeEntry(baseEntry);
  const incoming = sanitizeEntry(incomingEntry);
  const merged = {};
  const passthrough = { ...base, ...incoming };

  delete passthrough.isDiscovered;
  delete passthrough.firstDiscoveredAt;
  delete passthrough.lastRaisedAt;
  delete passthrough.raisedCount;
  delete passthrough.bestStats;
  delete passthrough.history;

  Object.entries(passthrough).forEach(([key, value]) => {
    if (value !== undefined) {
      merged[key] = value;
    }
  });

  merged.isDiscovered = inferEntryDiscovered(base) || inferEntryDiscovered(incoming);

  const firstDiscoveredAt = [toEpochMs(base.firstDiscoveredAt), toEpochMs(incoming.firstDiscoveredAt)]
    .filter((value) => value !== null)
    .sort((left, right) => left - right)[0];
  if (firstDiscoveredAt !== undefined) {
    merged.firstDiscoveredAt = firstDiscoveredAt;
  }

  const lastRaisedAt = [toEpochMs(base.lastRaisedAt), toEpochMs(incoming.lastRaisedAt)]
    .filter((value) => value !== null)
    .sort((left, right) => right - left)[0];
  if (lastRaisedAt !== undefined) {
    merged.lastRaisedAt = lastRaisedAt;
  }

  const raisedCounts = [base.raisedCount, incoming.raisedCount].filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  if (raisedCounts.length > 0) {
    merged.raisedCount = Math.max(...raisedCounts);
  }

  const mergedBestStats = mergeBestStats(base.bestStats, incoming.bestStats);
  if (
    Object.keys(mergedBestStats).length > 0 ||
    Object.prototype.hasOwnProperty.call(base, "bestStats") ||
    Object.prototype.hasOwnProperty.call(incoming, "bestStats")
  ) {
    merged.bestStats = mergedBestStats;
  }

  const mergedHistory = mergeHistoryEntries(base.history, incoming.history);
  if (
    mergedHistory.length > 0 ||
    Array.isArray(base.history) ||
    Array.isArray(incoming.history)
  ) {
    merged.history = mergedHistory;
  }

  return merged;
}

function normalizeVersionEntries(versionEntries = {}) {
  if (!isPlainObject(versionEntries)) {
    return {};
  }

  return Object.entries(versionEntries).reduce((accumulator, [digimonId, entry]) => {
    accumulator[digimonId] = sanitizeEntry(entry);
    return accumulator;
  }, {});
}

function normalizeEncyclopedia(encyclopedia = {}, versions = []) {
  const normalized = createEmptyEncyclopedia(versions);

  (Array.isArray(versions) ? versions : []).forEach((version) => {
    normalized[version] = normalizeVersionEntries(encyclopedia?.[version]);
  });

  return normalized;
}

function hasVersionEntries(versionEntries = {}) {
  return Object.keys(normalizeVersionEntries(versionEntries)).length > 0;
}

function hasAnyEncyclopediaEntries(encyclopedia = {}, versions = []) {
  return (Array.isArray(versions) ? versions : []).some((version) =>
    hasVersionEntries(encyclopedia?.[version])
  );
}

function countEntriesByVersion(encyclopedia = {}, versions = []) {
  return (Array.isArray(versions) ? versions : []).reduce((accumulator, version) => {
    accumulator[version] = Object.keys(normalizeVersionEntries(encyclopedia?.[version])).length;
    return accumulator;
  }, {});
}

function countEncyclopediaEntries(encyclopedia = {}, versions = []) {
  return Object.values(countEntriesByVersion(encyclopedia, versions)).reduce(
    (sum, count) => sum + count,
    0
  );
}

function areEntriesEquivalent(left = {}, right = {}) {
  return JSON.stringify(mergeEncyclopediaEntry({}, left)) === JSON.stringify(mergeEncyclopediaEntry({}, right));
}

function createSourceSummaryRecord(versions = [], normalizedSource = {}) {
  const availableByVersion = countEntriesByVersion(normalizedSource, versions);

  return {
    used: false,
    availableEntries: Object.values(availableByVersion).reduce((sum, count) => sum + count, 0),
    contributedEntries: 0,
    availableByVersion,
    contributedByVersion: Object.fromEntries((versions || []).map((version) => [version, 0])),
  };
}

function buildCanonicalEncyclopedia(userSources = {}) {
  const versions = Array.isArray(userSources?.versions) ? userSources.versions : [];
  const sources = Array.isArray(userSources?.sources) ? userSources.sources : [];
  const canonical = createEmptyEncyclopedia(versions);
  const sourceSummary = {};
  const fallbackSources = [];

  sources.forEach((source, index) => {
    const key =
      typeof source?.key === "string" && source.key.trim()
        ? source.key.trim()
        : `source${index + 1}`;
    const normalizedSource = normalizeEncyclopedia(source?.encyclopedia, versions);
    const summaryRecord = createSourceSummaryRecord(versions, normalizedSource);

    versions.forEach((version) => {
      Object.entries(normalizedSource[version] || {}).forEach(([digimonId, incomingEntry]) => {
        const existingEntry = canonical[version]?.[digimonId];
        if (source?.onlyFillMissing && existingEntry) {
          return;
        }

        const mergedEntry = mergeEncyclopediaEntry(existingEntry || {}, incomingEntry);
        if (!existingEntry || !areEntriesEquivalent(existingEntry, mergedEntry)) {
          canonical[version][digimonId] = mergedEntry;
          summaryRecord.used = true;
          summaryRecord.contributedEntries += 1;
          summaryRecord.contributedByVersion[version] += 1;
        }
      });
    });

    if (summaryRecord.used && source?.isFallback) {
      fallbackSources.push(key);
    }

    sourceSummary[key] = summaryRecord;
  });

  sourceSummary.canonical = {
    totalEntries: countEncyclopediaEntries(canonical, versions),
    byVersion: countEntriesByVersion(canonical, versions),
  };

  return {
    encyclopedia: canonical,
    sourceSummary: {
      ...sourceSummary,
      fallbackUsed: fallbackSources.length > 0,
      fallbackSources,
      recoveredFromLogs: sourceSummary.logsRecovery?.contributedEntries || 0,
    },
  };
}

module.exports = {
  areEntriesEquivalent,
  buildCanonicalEncyclopedia,
  countEncyclopediaEntries,
  countEntriesByVersion,
  createEmptyEncyclopedia,
  hasAnyEncyclopediaEntries,
  hasVersionEntries,
  inferEntryDiscovered,
  mergeEncyclopediaEntry,
  normalizeEncyclopedia,
  normalizeVersionEntries,
  toEpochMs,
};
