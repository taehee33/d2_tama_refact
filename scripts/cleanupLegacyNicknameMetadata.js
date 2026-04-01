const { initializeFirestore } = require("./nicknameIndexShared");

async function main() {
  const db = initializeFirestore();
  const legacyDocRef = db.collection("metadata").doc("nicknames");
  const legacyDoc = await legacyDocRef.get();

  if (!legacyDoc.exists) {
    console.log("[nickname cleanup] metadata/nicknames 문서가 이미 없습니다.");
    return;
  }

  await legacyDocRef.delete();
  console.log("[nickname cleanup] metadata/nicknames 문서를 삭제했습니다.");
}

main().catch((error) => {
  console.error("[nickname cleanup] 실패:", error);
  process.exitCode = 1;
});
