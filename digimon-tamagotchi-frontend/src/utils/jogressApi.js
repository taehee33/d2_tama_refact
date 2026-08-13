const JOGRESS_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

export class JogressApiError extends Error {
  constructor(message, { code = null, status = 0, retryable = false, details = null } = {}) {
    super(message);
    this.name = "JogressApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

async function requestJogressApi(currentUser, path, options = {}) {
  if (!currentUser?.getIdToken) throw new JogressApiError("로그인이 필요합니다.", { status: 401 });
  const token = await currentUser.getIdToken();
  const response = await fetch(`${JOGRESS_API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const rawText = await response.text();
  let payload = null;
  try { payload = rawText ? JSON.parse(rawText) : null; } catch (_error) { payload = null; }
  if (!response.ok) {
    const error = payload?.error;
    throw new JogressApiError(
      error?.message || (typeof error === "string" ? error : "조그레스 요청을 처리하지 못했습니다."),
      { code: error?.code || null, status: response.status, retryable: error?.retryable === true, details: error?.details || null }
    );
  }
  return payload;
}

export function fetchJogressRooms(currentUser, scope = "waiting") {
  return requestJogressApi(currentUser, `/api/jogress?scope=${encodeURIComponent(scope)}`);
}

export function createJogressRoomApi(currentUser, { slotId, expectedRevision }) {
  return requestJogressApi(currentUser, "/api/jogress", {
    method: "POST",
    body: { action: "create", slotId, expectedRevision },
  });
}

export function joinJogressRoomApi(currentUser, { roomId, guestSlotId, expectedRevision }) {
  return requestJogressApi(currentUser, "/api/jogress", {
    method: "POST",
    body: { action: "join", roomId, guestSlotId, expectedRevision },
  });
}

export function completeJogressRoomApi(currentUser, { roomId, expectedRevision }) {
  return requestJogressApi(currentUser, "/api/jogress", {
    method: "POST",
    body: { action: "complete", roomId, expectedRevision },
  });
}

export function completeLocalJogressApi(currentUser, {
  requestId,
  currentSlotId,
  partnerSlotId,
  expectedCurrentRevision,
  expectedPartnerRevision,
}) {
  return requestJogressApi(currentUser, "/api/jogress", {
    method: "POST",
    body: {
      action: "complete-local",
      requestId,
      currentSlotId,
      partnerSlotId,
      expectedCurrentRevision,
      expectedPartnerRevision,
    },
  });
}

export function cancelJogressRoomApi(currentUser, roomId) {
  return requestJogressApi(currentUser, `/api/jogress?roomId=${encodeURIComponent(roomId)}`, { method: "DELETE" });
}
