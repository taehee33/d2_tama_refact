const ARENA_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

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
    throw new Error(extractArenaErrorMessage(response, payload, rawText));
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
  const payload = await requestArenaApi(currentUser, "/api/arena/admin/end-season", {
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
    `/api/arena/admin/archive-monitoring${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
    }
  );

  return {
    summary: payload?.summary || null,
    events: Array.isArray(payload?.events) ? payload.events : [],
  };
}

export async function completeArenaBattle(currentUser, body) {
  const payload = await requestArenaApi(currentUser, "/api/arena/battles/complete", {
    method: "POST",
    body,
  });

  return payload?.battle || null;
}
