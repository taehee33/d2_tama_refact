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
  const payload = await requestOperatorApi(currentUser, "/api/operator/status");

  return payload?.viewer || {
    isOperator: false,
    canAccessUserDirectory: false,
  };
}
