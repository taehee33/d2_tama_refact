const OPERATOR_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";
const LOCAL_OPERATOR_HOSTS = new Set(["localhost", "127.0.0.1"]);

function buildOperatorUrl(path) {
  return `${OPERATOR_API_BASE_URL}${path}`;
}

function normalizeCommaSeparatedList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function collectClientOperatorIdentifiers(keys = []) {
  return [...new Set(keys.flatMap((key) => normalizeCommaSeparatedList(process.env[key])))];
}

function shouldUseLocalOperatorFallback() {
  if (typeof window === "undefined" || !window.location) {
    return false;
  }

  return LOCAL_OPERATOR_HOSTS.has(String(window.location.hostname || "").toLowerCase());
}

function getLocalOperatorStatus(currentUser) {
  const uid = typeof currentUser?.uid === "string" ? currentUser.uid.trim().toLowerCase() : "";
  const email =
    typeof currentUser?.email === "string" ? currentUser.email.trim().toLowerCase() : "";
  const operatorUids = collectClientOperatorIdentifiers([
    "REACT_APP_OPERATOR_UIDS",
    "REACT_APP_ARENA_ADMIN_UIDS",
    "REACT_APP_NEWS_EDITOR_UIDS",
  ]);
  const operatorEmails = collectClientOperatorIdentifiers([
    "REACT_APP_OPERATOR_EMAILS",
    "REACT_APP_ARENA_ADMIN_EMAILS",
    "REACT_APP_NEWS_EDITOR_EMAILS",
  ]);
  const isOperator = operatorUids.includes(uid) || (email ? operatorEmails.includes(email) : false);

  return {
    isOperator,
    canAccessUserDirectory: isOperator,
  };
}

function extractOperatorErrorMessage(response, payload, rawText) {
  const nestedErrorMessage =
    typeof payload?.error === "object" ? payload.error?.message || payload.error?.code : "";
  const directErrorMessage = typeof payload?.error === "string" ? payload.error : "";
  const payloadMessage = typeof payload?.message === "string" ? payload.message : "";
  const preferredMessage = nestedErrorMessage || directErrorMessage || payloadMessage;

  if (preferredMessage) {
    return preferredMessage;
  }

  if (rawText) {
    return `${rawText} (HTTP ${response.status})`;
  }

  return `운영자 상태를 확인하지 못했습니다. (HTTP ${response.status})`;
}

async function requestOperatorApi(currentUser, path) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(buildOperatorUrl(path), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    throw new Error(extractOperatorErrorMessage(response, payload, rawText));
  }

  return payload;
}

export async function fetchOperatorStatus(currentUser) {
  try {
    const payload = await requestOperatorApi(currentUser, "/api/operator/status");

    return payload?.viewer || {
      isOperator: false,
      canAccessUserDirectory: false,
    };
  } catch (error) {
    if (shouldUseLocalOperatorFallback()) {
      const localStatus = getLocalOperatorStatus(currentUser);

      if (localStatus.canAccessUserDirectory) {
        return localStatus;
      }
    }

    throw error;
  }
}
