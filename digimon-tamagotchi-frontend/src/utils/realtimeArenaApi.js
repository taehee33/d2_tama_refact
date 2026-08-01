const CLIENT_SCHEMA_VERSION = 1;

async function requestRealtimeArena(currentUser, url, body, method = "POST") {
  if (!currentUser?.getIdToken) throw new Error("실시간 배틀은 로그인이 필요합니다.");
  const token = await currentUser.getIdToken();
  const options = {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Arena-Client-Schema-Version": String(CLIENT_SCHEMA_VERSION),
    },
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "실시간 배틀 요청을 처리하지 못했습니다.");
    error.code = payload?.error?.code || "ARENA_REALTIME_REQUEST_FAILED";
    error.retryable = payload?.error?.retryable === true;
    throw error;
  }
  return payload;
}

export function listRealtimeArenaBattles(currentUser) {
  return requestRealtimeArena(currentUser, "/api/arena/realtime/battles", undefined, "GET");
}

export function createRealtimeArenaBattle(currentUser, { requestId, slotId, mode = "pvp" }) {
  return requestRealtimeArena(currentUser, "/api/arena/realtime/battles", { requestId, slotId, mode });
}

export function sendRealtimeArenaCommand(currentUser, battleId, body) {
  return requestRealtimeArena(currentUser, `/api/arena/realtime/battles/${encodeURIComponent(battleId)}/commands`, body);
}
