const {
  collectNicknameEntries,
  findNicknameCollisions,
  initializeFirestore,
  printCollisionReport,
} = require("./nicknameIndexShared");

async function main() {
  const db = initializeFirestore();
  const { entries, normalizedCount } = await collectNicknameEntries(db);
  const collisions = findNicknameCollisions(entries);

  console.log(`[nickname audit] 커스텀 테이머명 ${entries.length}건을 검사했습니다.`);
  console.log(`[nickname audit] 공백 정규화 대상 ${normalizedCount}건`);

  if (collisions.length > 0) {
    console.error(`[nickname audit] 충돌 ${collisions.length}건 발견. 백필을 중단하세요.`);
    printCollisionReport(collisions);
    process.exitCode = 1;
    return;
  }

  console.log("[nickname audit] 충돌이 없습니다. nickname_index 백필을 진행할 수 있습니다.");
}

main().catch((error) => {
  console.error("[nickname audit] 실패:", error);
  process.exitCode = 1;
});
