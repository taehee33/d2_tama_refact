const ABLY_AUTH_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

function buildAblyAuthUrl(path) {
  return `${ABLY_AUTH_API_BASE_URL}${path}`;
}

function getAblyAuthErrorMessage(response, payload) {
  const nestedMessage =
    typeof payload?.error === "object" ? payload.error.message || payload.error.code : "";
  const directMessage = typeof payload?.error === "string" ? payload.error : "";

  return (
    nestedMessage ||
    directMessage ||
    `실시간 채팅 인증을 준비하지 못했습니다. (HTTP ${response.status})`
  );
}

export async function requestAblyToken(currentUser) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const firebaseToken = await currentUser.getIdToken();
  const response = await fetch(buildAblyAuthUrl("/api/operator/status?action=ably-token"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firebaseToken}`,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    throw new Error(getAblyAuthErrorMessage(response, payload));
  }

  return payload;
}

export function createAblyAuthCallback(currentUser) {
  return async function ablyAuthCallback(_tokenParams, callback) {
    try {
      callback(null, await requestAblyToken(currentUser));
    } catch (error) {
      callback(error, null);
    }
  };
}
