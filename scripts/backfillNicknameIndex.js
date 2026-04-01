const {
  admin,
  analyzeNicknameIndexState,
  collectNicknameEntries,
  createNicknameIndexPayload,
  fetchNicknameIndexEntries,
  initializeFirestore,
  isNicknameIndexInSync,
  printCollisionReport,
} = require("./nicknameIndexShared");

const BATCH_LIMIT = 400;

async function commitBatch(batch, operationCount) {
  if (operationCount === 0) {
    return 0;
  }

  await batch.commit();
  return 1;
}

async function main() {
  const db = initializeFirestore();
  const { entries, normalizedCount } = await collectNicknameEntries(db);
  const indexEntries = await fetchNicknameIndexEntries(db);
  const analysis = analyzeNicknameIndexState(entries, indexEntries);

  console.log(`[nickname backfill] 커스텀 테이머명 ${entries.length}건을 읽었습니다.`);
  console.log(`[nickname backfill] 공백 정규화 대상 ${normalizedCount}건`);
  console.log(`[nickname backfill] 기존 nickname_index 문서 ${indexEntries.length}건`);

  if (analysis.collisions.length > 0) {
    console.error(`[nickname backfill] 충돌 ${analysis.collisions.length}건 발견. 백필을 중단합니다.`);
    printCollisionReport(analysis.collisions);
    process.exitCode = 1;
    return;
  }

  let batch = db.batch();
  let operationCount = 0;
  let committedBatchCount = 0;
  let indexUpsertCount = 0;
  let userNormalizationCount = 0;
  let deletedExtraIndexCount = 0;

  for (const entry of entries) {
    const existingIndexEntry = analysis.indexByKey.get(entry.normalizedKey);

    if (!isNicknameIndexInSync(entry, existingIndexEntry)) {
      const indexRef = db.collection("nickname_index").doc(entry.normalizedKey);
      batch.set(indexRef, createNicknameIndexPayload(entry, existingIndexEntry), { merge: true });
      operationCount += 1;
      indexUpsertCount += 1;
    }

    if (entry.didNormalizeSpaces) {
      const userRef = db.collection("users").doc(entry.uid);
      batch.update(userRef, {
        tamerName: entry.normalizedNickname,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      operationCount += 1;
      userNormalizationCount += 1;
    }

    if (operationCount >= BATCH_LIMIT) {
      committedBatchCount += await commitBatch(batch, operationCount);
      batch = db.batch();
      operationCount = 0;
    }
  }

  for (const extraIndexEntry of analysis.extraIndexEntries) {
    const extraIndexRef = db.collection("nickname_index").doc(extraIndexEntry.docId);
    batch.delete(extraIndexRef);
    operationCount += 1;
    deletedExtraIndexCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      committedBatchCount += await commitBatch(batch, operationCount);
      batch = db.batch();
      operationCount = 0;
    }
  }

  committedBatchCount += await commitBatch(batch, operationCount);

  console.log(`[nickname backfill] nickname_index 업서트 ${indexUpsertCount}건`);
  console.log(`[nickname backfill] users/{uid}.tamerName 정규화 ${userNormalizationCount}건`);
  console.log(`[nickname backfill] 불필요한 nickname_index 삭제 ${deletedExtraIndexCount}건`);
  console.log(`[nickname backfill] 커밋 배치 수 ${committedBatchCount}개`);
  console.log("[nickname backfill] verify 통과 후 npm run nickname:cleanup 으로 metadata/nicknames 문서를 정리할 수 있습니다.");
}

main().catch((error) => {
  console.error("[nickname backfill] 실패:", error);
  process.exitCode = 1;
});
