import { toTimestamp } from "./fridgeTime";
import { getCareMistakeReasonKeyFromText } from "../logic/stats/careMistakeLedger";

const CARE_MISTAKE_TYPES = new Set(["CAREMISTAKE", "CARE_MISTAKE"]);

function normalizeLogType(type = "") {
  if (typeof type !== "string") return "";
  return type.trim().toUpperCase();
}

function normalizeLogText(text = "") {
  return typeof text === "string" ? text.trim() : "";
}

export function ensureActivityLogTimestampMs(value) {
  return toTimestamp(value);
}

export function isCareMistakeActivityType(type = "") {
  return CARE_MISTAKE_TYPES.has(normalizeLogType(type));
}

export function getPoopInjuryEventKindFromText(text = "") {
  const normalizedText = normalizeLogText(text);
  if (!normalizedText) return null;

  if (
    normalizedText.includes("Too much poop") ||
    normalizedText.includes("똥 8개로 인한 부상")
  ) {
    return "max_poop";
  }

  if (
    normalizedText.includes("8시간 경과") ||
    normalizedText.includes("추가 부상")
  ) {
    return "poop_penalty";
  }

  return null;
}

export function buildCareMistakeActivityEventId(reasonKey = "other", occurredAt) {
  const timestampMs = ensureActivityLogTimestampMs(occurredAt);
  if (timestampMs == null) return null;
  return `caremistake:${reasonKey || "other"}:${timestampMs}`;
}

export function buildPoopInjuryActivityEventId(kind = "general", occurredAt) {
  const timestampMs = ensureActivityLogTimestampMs(occurredAt);
  if (timestampMs == null) return null;
  return `poop:${kind || "general"}:${timestampMs}`;
}

export function buildActivityLogEventId(log = {}) {
  if (typeof log?.eventId === "string" && log.eventId.trim()) {
    return log.eventId.trim();
  }

  const type = normalizeLogType(log?.type);
  const timestampMs = ensureActivityLogTimestampMs(log?.timestamp);
  if (!type || timestampMs == null) return null;

  const text = normalizeLogText(log?.text);

  if (isCareMistakeActivityType(type)) {
    return buildCareMistakeActivityEventId(
      getCareMistakeReasonKeyFromText(text),
      timestampMs
    );
  }

  if (type === "POOP") {
    const poopKind = getPoopInjuryEventKindFromText(text);
    if (!poopKind) return null;
    return buildPoopInjuryActivityEventId(poopKind, timestampMs);
  }

  return null;
}
