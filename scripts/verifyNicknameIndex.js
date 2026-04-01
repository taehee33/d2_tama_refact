const {
  analyzeNicknameIndexState,
  collectNicknameEntries,
  fetchNicknameIndexEntries,
  initializeFirestore,
  printCollisionReport,
  printExtraIndexList,
  printNicknameEntryList,
  printNicknameIndexMismatchList,
} = require("./nicknameIndexShared");

async function main() {
  const db = initializeFirestore();
  const { entries, normalizedCount } = await collectNicknameEntries(db);
  const indexEntries = await fetchNicknameIndexEntries(db);
  const analysis = analyzeNicknameIndexState(entries, indexEntries);

  console.log(`[nickname verify] 커스텀 테이머명 ${analysis.expectedCount}건`);
  console.log(`[nickname verify] nickname_index 문서 ${analysis.actualCount}건`);
  console.log(`[nickname verify] 아직 정규화가 필요한 사용자 ${normalizedCount}건`);

  let hasFailure = false;

  if (analysis.collisions.length > 0) {
    hasFailure = true;
    console.error(`[nickname verify] 사용자 닉네임 충돌 ${analysis.collisions.length}건`);
    printCollisionReport(analysis.collisions);
  }

  if (analysis.normalizationIssues.length > 0) {
    hasFailure = true;
    printNicknameEntryList("[nickname verify] 공백 정규화가 필요한 사용자", analysis.normalizationIssues);
  }

  if (analysis.missingIndexEntries.length > 0) {
    hasFailure = true;
    printNicknameEntryList("[nickname verify] 인덱스 누락 사용자", analysis.missingIndexEntries);
  }

  if (analysis.mismatchedIndexEntries.length > 0) {
    hasFailure = true;
    printNicknameIndexMismatchList(analysis.mismatchedIndexEntries);
  }

  if (analysis.extraIndexEntries.length > 0) {
    hasFailure = true;
    printExtraIndexList(analysis.extraIndexEntries);
  }

  if (hasFailure) {
    console.error("[nickname verify] 검증 실패");
    process.exitCode = 1;
    return;
  }

  console.log("[nickname verify] users/{uid}.tamerName 과 nickname_index 상태가 일치합니다.");
}

main().catch((error) => {
  console.error("[nickname verify] 실패:", error);
  process.exitCode = 1;
});
