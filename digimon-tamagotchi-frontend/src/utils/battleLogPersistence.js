import { toEpochMs } from "./time";

function hashEventIdentity(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildBattleLogEventId(entry = {}) {
  if (typeof entry?.eventId === "string" && entry.eventId.trim()) {
    return entry.eventId.trim();
  }

  const timestamp = toEpochMs(entry?.timestamp);
  const mode = typeof entry?.mode === "string" ? entry.mode.trim() : "";
  if (timestamp == null || !mode) return null;

  const identity = [
    mode,
    timestamp,
    entry?.text || "",
    entry?.enemyName || "",
    typeof entry?.win === "boolean" ? String(entry.win) : "",
    typeof entry?.injury === "boolean" ? String(entry.injury) : "",
    entry?.digimonId || "",
  ].join("|");

  return `battle:${mode.toLowerCase()}:${timestamp}:${hashEventIdentity(identity)}`;
}

export function buildPersistentBattleLogPayload(entry = {}) {
  const eventId = buildBattleLogEventId(entry);
  const timestamp = toEpochMs(entry?.timestamp) ?? Date.now();

  return {
    timestamp,
    mode: entry?.mode,
    text: entry?.text ?? "",
    ...(eventId ? { eventId } : {}),
    ...(typeof entry?.win === "boolean" && { win: entry.win }),
    ...(entry?.enemyName != null && entry.enemyName !== "" && { enemyName: entry.enemyName }),
    ...(typeof entry?.injury === "boolean" && { injury: entry.injury }),
    ...(entry?.digimonId ? { digimonId: entry.digimonId } : {}),
    ...(entry?.digimonName ? { digimonName: entry.digimonName } : {}),
  };
}
