const { admin, initializeFirestore } = require("./nicknameIndexShared");

const BATCH_LIMIT = 400;

function hasOwnField(data, fieldName) {
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldName);
}

function buildProfileUpdates(rootData = {}, profileData = {}) {
  const updates = {};

  if (!hasOwnField(profileData, "tamerName") && hasOwnField(rootData, "tamerName")) {
    updates.tamerName = rootData.tamerName ?? null;
  }

  if (!hasOwnField(profileData, "achievements") && Array.isArray(rootData.achievements)) {
    updates.achievements = rootData.achievements;
  }

  if (
    !hasOwnField(profileData, "maxSlots") &&
    typeof rootData.maxSlots === "number" &&
    rootData.maxSlots >= 0
  ) {
    updates.maxSlots = rootData.maxSlots;
  }

  return updates;
}

async function commitBatch(batch, operationCount) {
  if (operationCount === 0) {
    return 0;
  }

  await batch.commit();
  return 1;
}

async function main() {
  const db = initializeFirestore();
  const usersSnapshot = await db.collection("users").get();

  let batch = db.batch();
  let operationCount = 0;
  let committedBatchCount = 0;
  let profileUpsertCount = 0;
  let skippedExistingCount = 0;
  let skippedEmptyCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const rootData = userDoc.data();
    const profileRef = userDoc.ref.collection("profile").doc("main");
    const profileSnap = await profileRef.get();
    const profileData = profileSnap.exists ? profileSnap.data() : {};
    const updates = buildProfileUpdates(rootData, profileData);

    if (Object.keys(updates).length === 0) {
      if (profileSnap.exists) {
        skippedExistingCount += 1;
      } else {
        skippedEmptyCount += 1;
      }
      continue;
    }

    batch.set(
      profileRef,
      {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    operationCount += 1;
    profileUpsertCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      committedBatchCount += await commitBatch(batch, operationCount);
      batch = db.batch();
      operationCount = 0;
    }
  }

  committedBatchCount += await commitBatch(batch, operationCount);

  console.log(`[profile backfill] users 문서 ${usersSnapshot.size}건을 읽었습니다.`);
  console.log(`[profile backfill] profile/main 업서트 ${profileUpsertCount}건`);
  console.log(`[profile backfill] 이미 profile/main이 준비된 사용자 ${skippedExistingCount}건`);
  console.log(`[profile backfill] 복사할 루트 프로필 필드가 없어 건너뛴 사용자 ${skippedEmptyCount}건`);
  console.log(`[profile backfill] 커밋 배치 수 ${committedBatchCount}개`);
}

main().catch((error) => {
  console.error("[profile backfill] 실패:", error);
  process.exitCode = 1;
});
