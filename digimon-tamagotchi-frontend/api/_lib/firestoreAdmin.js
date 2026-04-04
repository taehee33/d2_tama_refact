"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIREBASE_TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function resolveProjectId() {
  const envProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID;

  if (envProjectId) {
    return envProjectId;
  }

  const firebasercPath = path.resolve(process.cwd(), ".firebaserc");
  if (!fs.existsSync(firebasercPath)) {
    return null;
  }

  try {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, "utf8"));
    return firebaserc?.projects?.default || null;
  } catch (error) {
    throw new Error(`.firebaserc 파싱 실패: ${error.message}`);
  }
}

function resolveServiceAccount() {
  const projectId = resolveProjectId();

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패: ${error.message}`);
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolvedPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`서비스 계정 파일을 찾을 수 없습니다: ${resolvedPath}`);
    }

    return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  }

  const defaultCandidates = [
    path.join(os.homedir(), ".config", "firebase", `${projectId || "firebase"}-adminsdk.json`),
    path.join(os.homedir(), ".config", "firebase", `${projectId || "firebase"}-service-account.json`),
    path.join(os.homedir(), ".config", "firebase", "service-account.json"),
  ];

  for (const candidatePath of defaultCandidates) {
    if (fs.existsSync(candidatePath)) {
      return JSON.parse(fs.readFileSync(candidatePath, "utf8"));
    }
  }

  return null;
}

function getServiceAccount() {
  const serviceAccount = resolveServiceAccount();

  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(
      "Firestore Admin 접근용 서비스 계정이 없습니다. FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH를 설정해 주세요."
    );
  }

  return serviceAccount;
}

function getFirestoreProjectId() {
  const projectId = resolveProjectId();

  if (!projectId) {
    throw new Error("Firestore 프로젝트 ID를 확인할 수 없습니다.");
  }

  return projectId;
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSignedJwt(serviceAccount) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: FIREBASE_TOKEN_URL,
    scope: FIRESTORE_SCOPE,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload)
  )}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${encodeBase64Url(signer.sign(serviceAccount.private_key))}`;
}

async function fetchFirestoreAccessToken() {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  const serviceAccount = getServiceAccount();
  const assertion = createSignedJwt(serviceAccount);
  const response = await fetch(FIREBASE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "Firestore Admin 토큰 발급에 실패했습니다.");
  }

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(0, (payload.expires_in || 3600) - 60) * 1000;
  return cachedAccessToken;
}

function buildFirestoreRestUrl(resourcePath = "") {
  const projectId = getFirestoreProjectId();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/${resourcePath}`;
}

async function fireAdminRequest(resourcePath, options = {}) {
  const accessToken = await fetchFirestoreAccessToken();
  const response = await fetch(buildFirestoreRestUrl(resourcePath), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || payload?.error || "Firestore Admin 요청을 처리하지 못했습니다."
    );
    error.status = response.status || 500;
    error.payload = payload;
    throw error;
  }

  return payload;
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

function encodeFirestoreValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value
          .map((item) => encodeFirestoreValue(item))
          .filter((item) => item !== null),
      },
    };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }

    return { doubleValue: value };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: encodeFirestoreFields(value),
      },
    };
  }

  return { stringValue: String(value) };
}

function encodeFirestoreFields(fields = {}) {
  return Object.entries(fields).reduce((accumulator, [key, value]) => {
    const encodedValue = encodeFirestoreValue(value);
    if (encodedValue !== null) {
      accumulator[key] = encodedValue;
    }
    return accumulator;
  }, {});
}

function getDocumentName(documentPath) {
  return `projects/${getFirestoreProjectId()}/databases/(default)/documents/${documentPath}`;
}

async function getDocument(documentPath) {
  try {
    const payload = await fireAdminRequest(`documents/${documentPath}`);
    return {
      id: payload.name?.split("/").pop() || documentPath.split("/").pop(),
      name: payload.name,
      data: parseFirestoreFields(payload.fields || {}),
    };
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function listDocuments(collectionPath, options = {}) {
  const pageSize = Number.isFinite(Number(options.pageSize)) ? Number(options.pageSize) : 500;
  const documents = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const payload = await fireAdminRequest(`documents/${collectionPath}?${params.toString()}`);
    const pageDocuments = Array.isArray(payload.documents) ? payload.documents : [];

    pageDocuments.forEach((document) => {
      documents.push({
        id: document.name?.split("/").pop() || null,
        name: document.name,
        data: parseFirestoreFields(document.fields || {}),
      });
    });

    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return documents;
}

function createSetWrite(documentPath, data) {
  return {
    update: {
      name: getDocumentName(documentPath),
      fields: encodeFirestoreFields(data),
    },
  };
}

function createUpdateWrite(documentPath, data, fieldPaths) {
  return {
    update: {
      name: getDocumentName(documentPath),
      fields: encodeFirestoreFields(data),
    },
    updateMask: {
      fieldPaths: Array.isArray(fieldPaths) ? fieldPaths : [],
    },
  };
}

async function commitWrites(writes = []) {
  if (!Array.isArray(writes) || writes.length === 0) {
    return { writeResults: [] };
  }

  return fireAdminRequest("documents:commit", {
    method: "POST",
    body: {
      writes,
    },
  });
}

module.exports = {
  commitWrites,
  createSetWrite,
  createUpdateWrite,
  getDocument,
  getDocumentName,
  listDocuments,
  parseFirestoreFields,
};
