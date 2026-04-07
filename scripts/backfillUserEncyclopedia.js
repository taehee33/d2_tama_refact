const { initializeFirestore } = require("./nicknameIndexShared");

const ENCYCLOPEDIA_VERSIONS = ["Ver.1", "Ver.2"];
const BATCH_LIMIT = 400;

function hasVersionEntries(versionEntries) {
  return (
    versionEntries &&
    typeof versionEntries === "object" &&
    Object.keys(versionEntries).length > 0
  );
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
  let userCount = 0;
  let versionBackfillCount = 0;
  let existingVersionSkipCount = 0;
  let emptyVersionSkipCount = 0;
  let noRootEncyclopediaSkipCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    userCount += 1;
    const encyclopedia = userDoc.data()?.encyclopedia;

    if (!encyclopedia || typeof encyclopedia !== "object") {
      noRootEncyclopediaSkipCount += 1;
      continue;
    }

    const versionRefs = ENCYCLOPEDIA_VERSIONS.map((version) =>
      userDoc.ref.collection("encyclopedia").doc(version)
    );
    const versionSnapshots = await Promise.all(versionRefs.map((ref) => ref.get()));

    ENCYCLOPEDIA_VERSIONS.forEach((version, index) => {
      const versionData = encyclopedia[version];
      if (!hasVersionEntries(versionData)) {
        emptyVersionSkipCount += 1;
        return;
      }

      if (versionSnapshots[index].exists) {
        existingVersionSkipCount += 1;
        return;
      }

      batch.set(versionRefs[index], versionData);
      operationCount += 1;
      versionBackfillCount += 1;
    });

    if (operationCount >= BATCH_LIMIT) {
      committedBatchCount += await commitBatch(batch, operationCount);
      batch = db.batch();
      operationCount = 0;
    }
  }

  committedBatchCount += await commitBatch(batch, operationCount);

  console.log(`[encyclopedia backfill] 사용자 ${userCount}건을 읽었습니다.`);
  console.log(`[encyclopedia backfill] 버전 문서 생성 ${versionBackfillCount}건`);
  console.log(`[encyclopedia backfill] 기존 버전 문서 존재로 스킵 ${existingVersionSkipCount}건`);
  console.log(`[encyclopedia backfill] 루트 encyclopedia 비어 있음 스킵 ${emptyVersionSkipCount}건`);
  console.log(`[encyclopedia backfill] encyclopedia 자체 없음 스킵 ${noRootEncyclopediaSkipCount}건`);
  console.log(`[encyclopedia backfill] 커밋 배치 수 ${committedBatchCount}개`);
  console.log("[encyclopedia backfill] 이번 단계에서는 루트 users/{uid}.encyclopedia 필드를 삭제하지 않습니다.");
}

main().catch((error) => {
  console.error("[encyclopedia backfill] 실패:", error);
  process.exitCode = 1;
});
