import { toTimestamp } from "../../utils/fridgeTime";

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

function toInjuryEntry(log, inputSource) {
  const timestamp = toTimestamp(log?.timestamp);
  const text = typeof log?.text === "string" ? log.text : "";
  const source = normalizeInjuryReason(text, inputSource === "battleLog" ? "battle" : "general");

  if (timestamp == null || !text) return null;

  return {
    timestamp,
    text,
    source,
    inputSource,
    normalizedReason: normalizeInjuryReason(text, source),
  };
}

function byEntryPriority(a, b) {
  if ((b?.timestamp || 0) !== (a?.timestamp || 0)) {
    return (b?.timestamp || 0) - (a?.timestamp || 0);
  }

  if (a?.inputSource === b?.inputSource) return 0;
  return a?.inputSource === "battleLog" ? -1 : 1;
}

export function getDisplayInjuryEntries({
  activityLogs = [],
  battleLogs = [],
  currentStageStartedAt = null,
} = {}) {
  const stageStartedAt = toTimestamp(currentStageStartedAt);

  const candidates = [
    ...(battleLogs || [])
      .filter(isInjuryBattleLog)
      .map((log) => toInjuryEntry(log, "battleLog")),
    ...(activityLogs || [])
      .filter(isInjuryActivityLog)
      .map((log) => toInjuryEntry(log, "activityLog")),
  ]
    .filter(Boolean)
    .filter((entry) => stageStartedAt == null || entry.timestamp >= stageStartedAt)
    .sort(byEntryPriority);

  const seen = new Set();
  const deduped = [];

  candidates.forEach((entry) => {
    const dedupeKey = `${entry.timestamp}:${entry.source}:${entry.normalizedReason}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    deduped.push(entry);
  });

  return deduped.sort(byEntryPriority);
}

export function buildTickPoopInjuryLogs(prevStats = {}, nextStats = {}) {
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
    toTimestamp(nextStats?.lastPoopPenaltyAt) ??
    toTimestamp(nextStats?.injuredAt) ??
    Date.now();

  return Array.from({ length: injuryDelta }, (_, index) => ({
    type: "POOP",
    text:
      injuryDelta > 1
        ? `똥 8개 방치 8시간 경과 - 추가 부상 (${index + 1}/${injuryDelta})`
        : "똥 8개 방치 8시간 경과 - 추가 부상",
    timestamp: baseTimestamp + index,
  }));
}
