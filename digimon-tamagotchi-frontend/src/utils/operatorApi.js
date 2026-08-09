const OPERATOR_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

function buildOperatorUrl(path) {
  return `${OPERATOR_API_BASE_URL}${path}`;
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

function createOperatorApiError(response, payload, rawText) {
  const error = new Error(extractOperatorErrorMessage(response, payload, rawText));
  error.name = "OperatorApiError";
  error.status = response.status;
  error.code =
    typeof payload?.error === "object" && typeof payload.error.code === "string"
      ? payload.error.code
      : null;
  error.details =
    typeof payload?.error === "object" && payload.error.details
      ? payload.error.details
      : null;
  return error;
}

async function fetchWithSingleNetworkRetry(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    return fetch(url, options);
  }
}

async function requestOperatorApi(currentUser, path, { method = "GET", body } = {}) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const options = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const response = await fetchWithSingleNetworkRetry(buildOperatorUrl(path), options);

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
    throw createOperatorApiError(response, payload, rawText);
  }

  return payload;
}

export async function fetchOperatorStatus(currentUser) {
  const payload = await requestOperatorApi(currentUser, "/api/operator/status");

  return payload?.viewer || {
    isOperator: false,
    canAccessUserDirectory: false,
  };
}

export async function saveOperatorMasterData(currentUser, input) {
  const payload = await requestOperatorApi(
    currentUser,
    "/api/operator/status?action=master-data-save",
    { method: "POST", body: input }
  );
  return payload?.result || null;
}

export async function restoreOperatorMasterData(currentUser, input) {
  const payload = await requestOperatorApi(
    currentUser,
    "/api/operator/status?action=master-data-restore",
    { method: "POST", body: input }
  );
  return payload?.result || null;
}
