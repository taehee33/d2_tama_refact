const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");

function normalizeNicknameInput(raw) {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim().replace(/\s+/g, " ");
}

function toNicknameKey(raw) {
  return normalizeNicknameInput(raw).toLowerCase();
}

function createNicknameEntry(uid, rawNickname) {
  if (typeof rawNickname !== "string" || rawNickname.trim() === "") {
    return null;
  }

  const normalizedNickname = normalizeNicknameInput(rawNickname);
  if (!normalizedNickname) {
    return null;
  }

  return {
    uid,
    originalNickname: rawNickname,
    normalizedNickname,
    normalizedKey: toNicknameKey(normalizedNickname),
    didNormalizeSpaces: normalizedNickname !== rawNickname.trim(),
  };
}

function createNicknameIndexEntry(docId, data = {}) {
  return {
    docId,
    uid: data.uid ?? null,
    nickname: data.nickname ?? null,
    normalizedKey: data.normalizedKey ?? docId,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function createNicknameIndexPayload(entry, existingEntry = null) {
  return {
    uid: entry.uid,
    nickname: entry.normalizedNickname,
    normalizedKey: entry.normalizedKey,
    createdAt: existingEntry?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function isNicknameIndexInSync(entry, indexEntry) {
  if (!entry || !indexEntry) {
    return false;
  }

  return (
    indexEntry.uid === entry.uid &&
    indexEntry.nickname === entry.normalizedNickname &&
    indexEntry.normalizedKey === entry.normalizedKey &&
    indexEntry.docId === entry.normalizedKey
  );
}

function collectNicknameEntriesFromUsers(userRecords) {
  const entries = [];
  let normalizedCount = 0;

  userRecords.forEach((userRecord) => {
    const entry = createNicknameEntry(userRecord.uid, userRecord.tamerName);
    if (!entry) {
      return;
    }

    if (entry.didNormalizeSpaces) {
      normalizedCount += 1;
    }

    entries.push(entry);
  });

  return {
    entries,
    normalizedCount,
  };
}

function findNicknameCollisions(entries) {
  const nicknameMap = new Map();

  entries.forEach((entry) => {
    const existingEntries = nicknameMap.get(entry.normalizedKey) || [];
    existingEntries.push(entry);
    nicknameMap.set(entry.normalizedKey, existingEntries);
  });

  return Array.from(nicknameMap.values()).filter((collisionEntries) => collisionEntries.length > 1);
}

function analyzeNicknameIndexState(userEntries, indexEntries) {
  const collisions = findNicknameCollisions(userEntries);
  const normalizationIssues = userEntries.filter((entry) => entry.didNormalizeSpaces);
  const expectedByKey = new Map(userEntries.map((entry) => [entry.normalizedKey, entry]));
  const indexByKey = new Map(indexEntries.map((entry) => [entry.docId, entry]));
  const missingIndexEntries = [];
  const mismatchedIndexEntries = [];
  const extraIndexEntries = [];

  userEntries.forEach((entry) => {
    const actualEntry = indexByKey.get(entry.normalizedKey);
    if (!actualEntry) {
      missingIndexEntries.push(entry);
      return;
    }

    if (!isNicknameIndexInSync(entry, actualEntry)) {
      mismatchedIndexEntries.push({
        expected: entry,
        actual: actualEntry,
      });
    }
  });

  indexEntries.forEach((indexEntry) => {
    if (!expectedByKey.has(indexEntry.docId)) {
      extraIndexEntries.push(indexEntry);
    }
  });

  return {
    collisions,
    normalizationIssues,
    missingIndexEntries,
    mismatchedIndexEntries,
    extraIndexEntries,
    expectedCount: userEntries.length,
    actualCount: indexEntries.length,
    expectedByKey,
    indexByKey,
  };
}

function printCollisionReport(collisions) {
  collisions.forEach((collisionEntries, index) => {
    const representative = collisionEntries[0];
    console.error(`- 충돌 ${index + 1}: "${representative.normalizedNickname}" (${representative.normalizedKey})`);
    collisionEntries.forEach((entry) => {
      console.error(`  uid=${entry.uid} | 원본="${entry.originalNickname}" | 정규화="${entry.normalizedNickname}"`);
    });
  });
}

function printNicknameEntryList(label, entries) {
  if (entries.length === 0) {
    return;
  }

  console.error(`${label} ${entries.length}건`);
  entries.forEach((entry) => {
    console.error(`  uid=${entry.uid} | 원본="${entry.originalNickname}" | 정규화="${entry.normalizedNickname}"`);
  });
}

function printNicknameIndexMismatchList(mismatches) {
  if (mismatches.length === 0) {
    return;
  }

  console.error(`인덱스 불일치 ${mismatches.length}건`);
  mismatches.forEach(({ expected, actual }) => {
    console.error(
      `  key=${expected.normalizedKey} | expected(uid=${expected.uid}, nickname="${expected.normalizedNickname}") | actual(uid=${actual.uid}, nickname="${actual.nickname}", normalizedKey="${actual.normalizedKey}", docId="${actual.docId}")`
    );
  });
}

function printExtraIndexList(extraEntries) {
  if (extraEntries.length === 0) {
    return;
  }

  console.error(`불필요한 인덱스 ${extraEntries.length}건`);
  extraEntries.forEach((entry) => {
    console.error(
      `  docId=${entry.docId} | uid=${entry.uid} | nickname="${entry.nickname}" | normalizedKey="${entry.normalizedKey}"`
    );
  });
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

function resolveProjectId() {
  const envProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID;

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

function initializeFirestore() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccount = resolveServiceAccount();
  const projectId = resolveProjectId();

  const appOptions = {
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
  };

  if (projectId) {
    appOptions.projectId = projectId;
  }

  admin.initializeApp(appOptions);
  return admin.firestore();
}

async function collectNicknameEntries(db) {
  const usersSnapshot = await db.collection("users").get();
  const userRecords = [];

  usersSnapshot.forEach((userDoc) => {
    const userData = userDoc.data();
    userRecords.push({
      uid: userDoc.id,
      tamerName: userData.tamerName,
    });
  });

  return collectNicknameEntriesFromUsers(userRecords);
}

async function fetchNicknameIndexEntries(db) {
  const indexSnapshot = await db.collection("nickname_index").get();
  const entries = [];

  indexSnapshot.forEach((indexDoc) => {
    entries.push(createNicknameIndexEntry(indexDoc.id, indexDoc.data()));
  });

  return entries;
}

module.exports = {
  admin,
  analyzeNicknameIndexState,
  collectNicknameEntries,
  collectNicknameEntriesFromUsers,
  createNicknameEntry,
  createNicknameIndexEntry,
  createNicknameIndexPayload,
  fetchNicknameIndexEntries,
  findNicknameCollisions,
  initializeFirestore,
  isNicknameIndexInSync,
  normalizeNicknameInput,
  printCollisionReport,
  printExtraIndexList,
  printNicknameEntryList,
  printNicknameIndexMismatchList,
  toNicknameKey,
};
