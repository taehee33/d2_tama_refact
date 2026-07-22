export const ARENA_IDENTITY_SCHEMA_VERSION = 1;
export const INITIAL_COMBAT_REVISION = 1;

function defaultCreateInstanceId() {
  const browserCrypto = typeof window !== "undefined" ? window.crypto : null;
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  throw new Error("combat identity를 만들 수 있는 Web Crypto API가 없습니다.");
}

export function hasValidCombatIdentity(slotData = {}) {
  return Boolean(
    slotData.arenaIdentitySchemaVersion === ARENA_IDENTITY_SCHEMA_VERSION &&
      typeof slotData.digimonInstanceId === "string" &&
      slotData.digimonInstanceId.trim() &&
      Number.isInteger(slotData.combatRevision) &&
      slotData.combatRevision >= INITIAL_COMBAT_REVISION
  );
}

export function createNewLifeCombatIdentity(createInstanceId = defaultCreateInstanceId) {
  const digimonInstanceId = createInstanceId();
  if (typeof digimonInstanceId !== "string" || !digimonInstanceId.trim()) {
    throw new Error("digimonInstanceId 생성 결과가 올바르지 않습니다.");
  }

  return {
    arenaIdentitySchemaVersion: ARENA_IDENTITY_SCHEMA_VERSION,
    digimonInstanceId: digimonInstanceId.trim(),
    combatRevision: INITIAL_COMBAT_REVISION,
  };
}

export function preserveOrCreateCombatIdentity(
  slotData = {},
  createInstanceId = defaultCreateInstanceId
) {
  if (hasValidCombatIdentity(slotData)) {
    return {
      arenaIdentitySchemaVersion: ARENA_IDENTITY_SCHEMA_VERSION,
      digimonInstanceId: slotData.digimonInstanceId.trim(),
      combatRevision: slotData.combatRevision,
    };
  }

  return createNewLifeCombatIdentity(createInstanceId);
}

export function buildFormTransitionCombatIdentity(slotData = {}) {
  if (!hasValidCombatIdentity(slotData)) {
    throw new Error("형태 전환 전에 slot combat identity backfill이 필요합니다.");
  }

  return {
    arenaIdentitySchemaVersion: ARENA_IDENTITY_SCHEMA_VERSION,
    digimonInstanceId: slotData.digimonInstanceId.trim(),
    combatRevision: slotData.combatRevision + 1,
  };
}
