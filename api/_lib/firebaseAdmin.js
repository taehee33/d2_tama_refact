"use strict";

function getFirebaseProjectId() {
  return process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || "";
}

function getFirebaseApiKey() {
  return process.env.REACT_APP_FIREBASE_API_KEY || "";
}

function getFirebaseConfig() {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();

  if (!projectId || !apiKey) {
    throw new Error(
      "Firebase 웹 환경변수가 부족합니다. REACT_APP_FIREBASE_PROJECT_ID와 REACT_APP_FIREBASE_API_KEY를 확인해 주세요."
    );
  }

  return {
    projectId,
    apiKey,
  };
}

async function verifyFirebaseIdToken(idToken) {
  const { apiKey } = getFirebaseConfig();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.users?.[0]?.localId) {
    const error = new Error("유효한 로그인 토큰이 아닙니다.");
    error.status = 401;
    throw error;
  }

  const user = payload.users[0];

  return {
    uid: user.localId,
    email: user.email || null,
    name: user.displayName || null,
    idToken,
  };
}

function parseFirestoreValue(value) {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }

  if ("booleanValue" in value) {
    return Boolean(value.booleanValue);
  }

  if ("timestampValue" in value) {
    return value.timestampValue;
  }

  if ("nullValue" in value) {
    return null;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }

  if ("mapValue" in value) {
    return parseFirestoreFields(value.mapValue.fields || {});
  }

  return value;
}

function parseFirestoreFields(fields = {}) {
  return Object.entries(fields).reduce((accumulator, [key, value]) => {
    accumulator[key] = parseFirestoreValue(value);
    return accumulator;
  }, {});
}

async function fetchFirestoreDocument(path, idToken) {
  const { projectId } = getFirebaseConfig();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error("Firestore 문서를 불러오지 못했습니다.");
    error.status = response.status || 500;
    error.payload = payload;
    throw error;
  }

  return parseFirestoreFields(payload.fields || {});
}

async function fetchUserProfile(uid, idToken) {
  return fetchFirestoreDocument(`users/${uid}`, idToken);
}

async function fetchUserSlot(uid, slotId, idToken) {
  return fetchFirestoreDocument(`users/${uid}/slots/slot${slotId}`, idToken);
}

module.exports = {
  fetchUserProfile,
  fetchUserSlot,
  getFirebaseConfig,
  verifyFirebaseIdToken,
};
