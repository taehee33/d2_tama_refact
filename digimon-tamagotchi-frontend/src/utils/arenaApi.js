const ARENA_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";
export const ARENA_CLIENT_SCHEMA_VERSION = 2;

export class ArenaApiError extends Error {
  constructor(message, { code = null, status = 0, retryable = false, details = null } = {}) {
    super(message);
    this.name = "ArenaApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function buildArenaUrl(path) {
  return `${ARENA_API_BASE_URL}${path}`;
}

function extractArenaErrorMessage(response, payload, rawText) {
  const nestedErrorMessage =
    typeof payload?.error === "object" ? payload.error?.message || payload.error?.code : "";
  const directErrorMessage = typeof payload?.error === "string" ? payload.error : "";
  const payloadMessage = typeof payload?.message === "string" ? payload.message : "";
  const preferredMessage = nestedErrorMessage || directErrorMessage || payloadMessage;

  if (preferredMessage) {
    return preferredMessage;
  }

  if (rawText && /<!doctype html>|<html/i.test(rawText)) {
    if (response.status === 404) {
      return "아레나 API 경로를 찾지 못했습니다. 로컬 개발 중이면 vercel dev 또는 REACT_APP_COMMUNITY_API_BASE_URL 설정이 필요합니다. (HTTP 404)";
    }

    return `아레나 요청이 HTML 응답으로 돌아왔습니다. API 연결 상태를 확인해 주세요. (HTTP ${response.status})`;
  }

  if (rawText) {
    return `${rawText} (HTTP ${response.status})`;
  }

  return `아레나 요청을 처리하지 못했습니다. (HTTP ${response.status})`;
}

async function requestArenaApi(currentUser, path, options = {}) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(buildArenaUrl(path), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.arenaSchemaVersion
        ? { "X-Arena-Client-Schema-Version": String(options.arenaSchemaVersion) }
        : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  let rawText = "";

  try {
    rawText = await response.text();
  } catch (error) {
    rawText = "";
  }

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ArenaApiError(extractArenaErrorMessage(response, payload, rawText), {
      code: typeof payload?.error === "object" ? payload.error.code || null : null,
      status: response.status,
      retryable: payload?.error?.retryable === true,
      details: payload?.error?.details || null,
    });
  }

  return payload;
}

export async function saveArenaAdminConfig(currentUser, body) {
  const payload = await requestArenaApi(currentUser, "/api/arena/admin/config", {
    method: "PUT",
    body,
  });

  return payload?.config || null;
}

export async function endArenaSeason(currentUser, body) {
  const payload = await requestArenaApi(currentUser, "/api/arena/admin/config?action=end-season", {
    method: "POST",
    body,
  });

  return payload?.season || null;
}

export async function deleteArenaArchive(currentUser, archiveId) {
  const payload = await requestArenaApi(
    currentUser,
    `/api/arena/admin/archives/${encodeURIComponent(archiveId)}`,
    {
      method: "DELETE",
    }
  );

  return payload?.archive || null;
}

export async function fetchArenaArchiveMonitoring(currentUser, options = {}) {
  const params = new URLSearchParams();

  params.set("view", "archive-monitoring");

  if (options.hours !== undefined && options.hours !== null) {
    params.set("hours", String(options.hours));
  }

  if (options.limit !== undefined && options.limit !== null) {
    params.set("limit", String(options.limit));
  }

  if (options.source) {
    params.set("source", String(options.source));
  }

  if (options.outcome) {
    params.set("outcome", String(options.outcome));
  }

  const queryString = params.toString();
  const payload = await requestArenaApi(
    currentUser,
    `/api/arena/admin/config${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
    }
  );

  return {
    summary: payload?.summary || null,
    events: Array.isArray(payload?.events) ? payload.events : [],
  };
}

export async function fetchArenaUserDirectory(currentUser) {
  const payload = await requestArenaApi(currentUser, "/api/arena/admin/config?view=user-directory", {
    method: "GET",
  });

  return {
    users: Array.isArray(payload?.users) ? payload.users : [],
    recentEvents: Array.isArray(payload?.recentEvents) ? payload.recentEvents : [],
    summary: payload?.summary || null,
  };
}

export async function setArenaUserOperatorRole(currentUser, body) {
  const payload = await requestArenaApi(
    currentUser,
    "/api/arena/admin/config?action=set-operator",
    {
      method: "POST",
      body,
    }
  );

  return payload?.role || null;
}

export async function completeArenaBattle(currentUser, body) {
  const payload = await requestArenaApi(currentUser, "/api/arena/battles/complete", {
    method: "POST",
    body,
  });

  return payload?.battle || null;
}

export async function submitArenaGhostBattle(currentUser, {
  requestId,
  attackerSlotId,
  defenderGhostId,
}) {
  const payload = await requestArenaApi(currentUser, "/api/arena/battles", {
    method: "POST",
    arenaSchemaVersion: ARENA_CLIENT_SCHEMA_VERSION,
    body: { requestId, attackerSlotId: String(attackerSlotId), defenderGhostId },
  });
  return payload?.battle || null;
}

export async function fetchArenaGhosts(currentUser, options = {}) {
  const params = new URLSearchParams();
  params.set("scope", options.scope || "mine");
  if (options.slotId !== undefined && options.slotId !== null) {
    params.set("slotId", String(options.slotId));
  }
  if (options.limit !== undefined && options.limit !== null) {
    params.set("limit", String(options.limit));
  }
  if (options.cursor) {
    params.set("cursor", String(options.cursor));
  }
  return requestArenaApi(currentUser, `/api/arena/ghosts?${params.toString()}`, {
    arenaSchemaVersion: ARENA_CLIENT_SCHEMA_VERSION,
  });
}

export async function registerArenaGhost(currentUser, slotId) {
  return requestArenaApi(currentUser, "/api/arena/ghosts", {
    method: "POST",
    arenaSchemaVersion: ARENA_CLIENT_SCHEMA_VERSION,
    body: { slotId: String(slotId) },
  });
}

export async function deleteArenaGhost(currentUser, ghostId) {
  return requestArenaApi(
    currentUser,
    `/api/arena/ghosts/${encodeURIComponent(ghostId)}`,
    {
      method: "DELETE",
      arenaSchemaVersion: ARENA_CLIENT_SCHEMA_VERSION,
    }
  );
}
