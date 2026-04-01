"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  analyzeNicknameIndexState,
  collectNicknameEntriesFromUsers,
  createNicknameEntry,
  createNicknameIndexEntry,
  isNicknameIndexInSync,
  normalizeNicknameInput,
  toNicknameKey,
} = require("../scripts/nicknameIndexShared");

test("공백 정규화와 닉네임 키 생성은 운영 규칙과 동일하게 동작한다", () => {
  assert.equal(normalizeNicknameInput("  A   B  "), "A B");
  assert.equal(toNicknameKey("  TaMer   Name "), "tamer name");
});

test("A B 와 A  B 는 같은 키로 충돌한다", () => {
  const { entries } = collectNicknameEntriesFromUsers([
    { uid: "u1", tamerName: "A B" },
    { uid: "u2", tamerName: "A  B" },
  ]);

  const analysis = analyzeNicknameIndexState(entries, []);

  assert.equal(analysis.collisions.length, 1);
  assert.deepEqual(
    analysis.collisions[0].map((entry) => entry.uid),
    ["u1", "u2"]
  );
});

test("verify 분석은 정규화 필요 사용자, 누락, 불일치, 불필요한 인덱스를 구분한다", () => {
  const userEntries = [
    createNicknameEntry("u1", "한  솔"),
    createNicknameEntry("u2", "타이치"),
  ];
  const indexEntries = [
    createNicknameIndexEntry("한 솔", {
      uid: "u1",
      nickname: "한 솔",
      normalizedKey: "한 솔",
    }),
    createNicknameIndexEntry("타이치", {
      uid: "wrong-user",
      nickname: "타이치",
      normalizedKey: "타이치",
    }),
    createNicknameIndexEntry("stale-key", {
      uid: "ghost",
      nickname: "고스트",
      normalizedKey: "stale-key",
    }),
  ];

  const analysis = analyzeNicknameIndexState(userEntries, indexEntries);

  assert.equal(analysis.normalizationIssues.length, 1);
  assert.equal(analysis.missingIndexEntries.length, 0);
  assert.equal(analysis.mismatchedIndexEntries.length, 1);
  assert.equal(analysis.extraIndexEntries.length, 1);
  assert.equal(analysis.expectedCount, 2);
  assert.equal(analysis.actualCount, 3);
});

test("이미 일치하는 인덱스는 재백필 대상이 아니다", () => {
  const entry = createNicknameEntry("u1", "한 솔");
  const syncedIndex = createNicknameIndexEntry("한 솔", {
    uid: "u1",
    nickname: "한 솔",
    normalizedKey: "한 솔",
  });

  assert.equal(isNicknameIndexInSync(entry, syncedIndex), true);
});
