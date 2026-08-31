export const CARE_MISTAKE_V2_INTEGRITY = Object.freeze({
  VERIFIED: "verified",
  LEGACY_BASELINE: "legacy_baseline",
  DEGRADED: "degraded",
  REPAIR_REQUIRED: "repair_required",
  UNKNOWN: "integrity_unknown",
});

export class CareMistakeV2ApiError extends Error {
  constructor(code, message, status = 500, details = null) {
    super(message);
    this.name = "CareMistakeV2ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function authHeaders(user) {
  if (!user?.getIdToken) throw new CareMistakeV2ApiError("AUTH_REQUIRED", "로그인이 필요합니다.", 401);
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  const error = body?.error || {};
  throw new CareMistakeV2ApiError(
    error.code || "CARE_MISTAKE_V2_API_ERROR",
    error.message || "케어미스 V2 요청을 처리하지 못했습니다.",
    response.status,
    error.details || null
  );
}

export async function fetchCareMistakeV2Integrity(user, slotId, { fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(
      `/api/operator/status?action=care-mistake-v2&slotId=${encodeURIComponent(slotId)}`,
      { headers: await authHeaders(user) }
    );
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof CareMistakeV2ApiError && error.status < 500) throw error;
    return {
      schemaVersion: null,
      effectiveIntegrityStatus: CARE_MISTAKE_V2_INTEGRITY.UNKNOWN,
      diagnosticCodes: [],
      retryable: true,
    };
  }
}

export async function commitCareMistakeV2ApiCommand(user, slotId, command, {
  fetchImpl = fetch,
} = {}) {
  const response = await fetchImpl("/api/operator/status?action=care-mistake-v2", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ action: "command", slotId, command }),
  });
  return parseResponse(response);
}

export async function nativeInitCareMistakeV2ApiSlot(user, slotId, {
  commandId,
  slotData,
  fetchImpl = fetch,
} = {}) {
  const response = await fetchImpl("/api/operator/status?action=care-mistake-v2", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ action: "native_init", slotId, commandId, slotData }),
  });
  return parseResponse(response);
}

export function isCareMistakeV2Slot(slotData = {}) {
  return slotData?.careMistakeState?.schemaVersion === 2;
}

export function canMutateWithCareIntegrity(status) {
  return status === CARE_MISTAKE_V2_INTEGRITY.VERIFIED ||
    status === CARE_MISTAKE_V2_INTEGRITY.LEGACY_BASELINE ||
    status === CARE_MISTAKE_V2_INTEGRITY.DEGRADED;
}

export function buildCareMistakeV2Command({
  commandId,
  commandType,
  state,
  expectedRevision,
  payload = {},
} = {}) {
  if (!state || state.schemaVersion !== 2) {
    throw new TypeError("V2 careMistakeState가 필요합니다.");
  }
  return {
    commandId,
    commandType,
    careSchemaVersion: 2,
    rootReceiptId: state.rootReceiptId,
    receiptId: state.receiptId,
    evolutionStageInstanceId: state.evolutionStageInstanceId,
    expectedRevision,
    payload,
  };
}
