const LOG_ARCHIVE_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

function buildLogArchiveUrl(path) {
  return `${LOG_ARCHIVE_API_BASE_URL}${path}`;
}

async function requestLogArchive(currentUser, path, options = {}) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(buildLogArchiveUrl(path), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      "로그 아카이브 요청을 처리하지 못했습니다.";
    throw new Error(errorMessage);
  }

  return payload;
}

export function createLogArchiveId(prefix = "archive") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function archiveArenaBattleLog(currentUser, body) {
  const payload = await requestLogArchive(currentUser, "/api/logs/arena-battles/archive", {
    method: "POST",
    body,
  });

  return payload.archive;
}

export async function getArenaBattleReplay(currentUser, archiveId) {
  const payload = await requestLogArchive(
    currentUser,
    `/api/logs/arena-battles/${encodeURIComponent(archiveId)}/replay`
  );

  return payload.archive;
}

export async function archiveJogressLog(currentUser, body) {
  const payload = await requestLogArchive(currentUser, "/api/logs/jogress/archive", {
    method: "POST",
    body,
  });

  return payload.archive;
}
