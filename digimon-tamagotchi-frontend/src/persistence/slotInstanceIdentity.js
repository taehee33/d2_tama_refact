export const SLOT_INSTANCE_ID_SCHEMA_VERSION = 1;

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

  throw new Error("slot instance identity를 만들 수 있는 Web Crypto API가 없습니다.");
}

export function hasValidSlotInstanceIdentity(slotData = {}) {
  return Boolean(
    slotData.slotInstanceIdSchemaVersion === SLOT_INSTANCE_ID_SCHEMA_VERSION &&
      typeof slotData.slotInstanceId === "string" &&
      slotData.slotInstanceId.trim()
  );
}

export function createSlotInstanceIdentity(createInstanceId = defaultCreateInstanceId) {
  const slotInstanceId = createInstanceId();
  if (typeof slotInstanceId !== "string" || !slotInstanceId.trim()) {
    throw new Error("slotInstanceId 생성 결과가 올바르지 않습니다.");
  }

  return {
    slotInstanceIdSchemaVersion: SLOT_INSTANCE_ID_SCHEMA_VERSION,
    slotInstanceId: slotInstanceId.trim(),
  };
}

/**
 * 기존 슬롯의 생명 ID를 보존하고, legacy 슬롯만 새 ID를 발급합니다.
 */
export function preserveOrCreateSlotInstanceIdentity(
  slotData = {},
  createInstanceId = defaultCreateInstanceId
) {
  if (hasValidSlotInstanceIdentity(slotData)) {
    return {
      slotInstanceIdSchemaVersion: SLOT_INSTANCE_ID_SCHEMA_VERSION,
      slotInstanceId: slotData.slotInstanceId.trim(),
    };
  }

  return createSlotInstanceIdentity(createInstanceId);
}
