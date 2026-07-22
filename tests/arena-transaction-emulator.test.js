"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Arena Admin SDK transaction store가 emulator에서 원자 갱신한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";
  const {
    getArenaFirestore,
    runArenaTransaction,
  } = require("../digimon-tamagotchi-frontend/api/_lib/arenaTransactions");
  const db = getArenaFirestore();
  const ref = db.doc("arena_transaction_smoke/counter");
  await ref.set({ value: 0 });

  const result = await runArenaTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const nextValue = Number(snapshot.data()?.value || 0) + 1;
    transaction.update(ref, { value: nextValue });
    return nextValue;
  });

  assert.equal(result, 1);
  assert.equal((await ref.get()).data().value, 1);
  await ref.delete();
});
