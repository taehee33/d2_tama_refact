const { admin, initializeFirestore } = require("./nicknameIndexShared");
const {
  OPERATOR_ROLES_COLLECTION,
  createOperatorRolePayload,
} = require("../digimon-tamagotchi-frontend/api/_lib/operatorConfig");

const BATCH_LIMIT = 400;

function normalizeCommaSeparatedList(value, { lowercase = true } = {}) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((item) => {
      const normalized = item.trim();
      return lowercase ? normalized.toLowerCase() : normalized;
    })
    .filter(Boolean);
}

function collectIdentifiers(keys = [], options = {}) {
  return [...new Set(keys.flatMap((key) => normalizeCommaSeparatedList(process.env[key], options)))];
}

function resolveUserDirectoryName(rootData = {}, profileData = {}, uid = "") {
  return (
    (typeof profileData.tamerName === "string" && profileData.tamerName.trim()) ||
    (typeof rootData.tamerName === "string" && rootData.tamerName.trim()) ||
    (typeof rootData.displayName === "string" && rootData.displayName.trim()) ||
    (typeof rootData.email === "string" && rootData.email.trim()
      ? rootData.email.trim().split("@")[0]
      : "") ||
    (uid ? `Trainer_${uid.slice(0, 6)}` : "")
  );
}

async function commitBatch(batch, operationCount) {
  if (operationCount === 0) {
    return 0;
  }

  await batch.commit();
  return 1;
}

async function buildUserIndexes(db) {
  const usersSnapshot = await db.collection("users").get();
  const userByUid = new Map();
  const userByEmail = new Map();

  for (const userDoc of usersSnapshot.docs) {
    const rootData = userDoc.data() || {};
    const profileSnap = await userDoc.ref.collection("profile").doc("main").get();
    const profileData = profileSnap.exists ? profileSnap.data() || {} : {};
    const email =
      typeof rootData.email === "string" && rootData.email.trim()
        ? rootData.email.trim().toLowerCase()
        : "";
    const displayName = resolveUserDirectoryName(rootData, profileData, userDoc.id);
    const record = {
      uid: userDoc.id,
      email,
      displayName,
    };

    userByUid.set(userDoc.id.toLowerCase(), record);

    if (email) {
      userByEmail.set(email, record);
    }
  }

  return {
    userByUid,
    userByEmail,
    userCount: usersSnapshot.size,
  };
}

async function resolveUidByEmail(auth, email, userByEmail) {
  try {
    const authUser = await auth.getUserByEmail(email);
    return {
      uid: authUser.uid,
      email: typeof authUser.email === "string" ? authUser.email.trim().toLowerCase() : email,
      displayName:
        (typeof authUser.displayName === "string" && authUser.displayName.trim()) ||
        userByEmail.get(email)?.displayName ||
        "",
    };
  } catch (error) {
    return userByEmail.get(email) || null;
  }
}

async function main() {
  const db = initializeFirestore();
  const auth = admin.auth();
  const { userByUid, userByEmail, userCount } = await buildUserIndexes(db);
  const uidIdentifiers = collectIdentifiers([
    "OPERATOR_UIDS",
    "ARENA_ADMIN_UIDS",
    "NEWS_EDITOR_UIDS",
  ], { lowercase: false });
  const emailIdentifiers = collectIdentifiers([
    "OPERATOR_EMAILS",
    "ARENA_ADMIN_EMAILS",
    "NEWS_EDITOR_EMAILS",
  ]);
  const resolvedTargets = new Map();
  const unresolvedEmails = [];

  uidIdentifiers.forEach((uid) => {
    const userRecord = userByUid.get(uid.toLowerCase()) || null;
    resolvedTargets.set(uid, {
      uid,
      email: userRecord?.email || "",
      displayName: userRecord?.displayName || "",
    });
  });

  for (const email of emailIdentifiers) {
    const resolved = await resolveUidByEmail(auth, email, userByEmail);

    if (!resolved?.uid) {
      unresolvedEmails.push(email);
      continue;
    }

    resolvedTargets.set(String(resolved.uid).toLowerCase(), {
      uid: String(resolved.uid),
      email: resolved.email || email,
      displayName: resolved.displayName || "",
    });
  }

  let batch = db.batch();
  let operationCount = 0;
  let committedBatchCount = 0;
  let createdCount = 0;
  let existingCount = 0;

  for (const target of resolvedTargets.values()) {
    const roleRef = db.collection(OPERATOR_ROLES_COLLECTION).doc(target.uid);
    const roleSnap = await roleRef.get();

    if (roleSnap.exists) {
      existingCount += 1;
    } else {
      createdCount += 1;
    }

    batch.set(
      roleRef,
      createOperatorRolePayload({
        uid: target.uid,
        isOperator: true,
        email: target.email,
        displayName: target.displayName,
        grantedBy: "migration",
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      { merge: true }
    );
    operationCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      committedBatchCount += await commitBatch(batch, operationCount);
      batch = db.batch();
      operationCount = 0;
    }
  }

  committedBatchCount += await commitBatch(batch, operationCount);

  console.log(`[operator migration] users 문서 ${userCount}건을 읽었습니다.`);
  console.log(`[operator migration] env uid 식별자 ${uidIdentifiers.length}건`);
  console.log(`[operator migration] env email 식별자 ${emailIdentifiers.length}건`);
  console.log(`[operator migration] Firestore 운영자 문서 생성 ${createdCount}건`);
  console.log(`[operator migration] 기존 문서 병합 ${existingCount}건`);
  console.log(`[operator migration] 커밋 배치 수 ${committedBatchCount}개`);
  console.log(`[operator migration] UID 해석 실패 이메일 ${unresolvedEmails.length}건`);

  if (unresolvedEmails.length > 0) {
    unresolvedEmails.forEach((email) => {
      console.warn(`[operator migration] unresolved email: ${email}`);
    });
  }
}

main().catch((error) => {
  console.error("[operator migration] 실패:", error);
  process.exitCode = 1;
});
