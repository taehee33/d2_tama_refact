"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { commandRealtimeRound } = require("../digimon-tamagotchi-frontend/api/_lib/realtimeArenaRoundService");
const { createRequestHash } = require("../digimon-tamagotchi-frontend/api/_lib/realtimeArenaDomain");
const { createRealtimeArenaRulesSnapshot } = require("../digimon-tamagotchi-frontend/api/_generated/gameProjection.cjs");

test("실시간 아레나 transaction은 첫 제출 metadata를 숨기고 동시 판정을 한 번만 commit한다", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async (t) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";
  const app = initializeApp({ projectId }, `realtime-arena-${Date.now()}`);
  const db = getFirestore(app);
  const battleId = `rtb_${"a".repeat(43)}`;
  const rulesVersion = "mvp-0";
  const rulesSnapshot = createRealtimeArenaRulesSnapshot(rulesVersion);
  const rulesSnapshotHash = createRequestHash({ rulesVersion, rulesSnapshot });
  const startedAt = new Date("2026-07-30T00:00:00.000Z");
  const deadlineAt = new Date("2026-07-30T00:00:07.000Z");
  t.after(async () => {
    await db.doc(`realtimeArenaBattles/${battleId}`).delete().catch(() => {});
    await db.doc(`realtimeArenaBattleSecrets/${battleId}`).delete().catch(() => {});
    await deleteApp(app);
  });
  await db.doc(`realtimeArenaBattles/${battleId}`).set({
    schemaVersion: 1, battleId, status: "selecting", hostUid: "host", guestUid: "guest",
    lobby: { host: { ready: true }, guest: { ready: true } }, rulesVersion, rulesSnapshot, rulesSnapshotHash,
    participants: {
      host: { stage: "Adult", attribute: "Free", sourcePower: 50, maxHp: 13, baseAttack: 3 },
      guest: { stage: "Adult", attribute: "Free", sourcePower: 50, maxHp: 13, baseAttack: 3 },
    },
    round: 1, maxRounds: 7, stateVersion: 4, deadlineAt: Timestamp.fromDate(deadlineAt),
    currentHp: { host: 13, guest: 13 }, timeoutStreaks: { host: 0, guest: 0 }, resolvedRounds: [], result: null,
    createdAt: Timestamp.fromDate(startedAt), updatedAt: Timestamp.fromDate(startedAt), startedAt: Timestamp.fromDate(startedAt), finishedAt: null,
    expiresAt: Timestamp.fromDate(new Date("2026-07-31T00:00:00.000Z")),
  });
  await db.doc(`realtimeArenaBattleSecrets/${battleId}`).set({
    schemaVersion: 1, battleId, secretVersion: 1,
    participants: { host: { uid: "host", slotId: "slot1" }, guest: { uid: "guest", slotId: "slot1" } },
    rulesVersion, rulesSnapshotHash,
    roundSecrets: { "1": { hostSubmission: null, guestSubmission: null, resolved: false, resolvedAt: null, resolutionType: null, resultHash: null } },
    latestCommandReceipts: { host: {}, guest: {} }, createdAt: Timestamp.fromDate(startedAt), updatedAt: Timestamp.fromDate(startedAt),
  });
  const before = await db.doc(`realtimeArenaBattles/${battleId}`).get();
  await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "host-1", round: 1, expectedStateVersion: 4, action: "attack" },
    deps: { db, now: new Date("2026-07-30T00:00:03.000Z") },
  });
  const afterFirst = await db.doc(`realtimeArenaBattles/${battleId}`).get();
  assert.deepEqual(afterFirst.data(), before.data());
  assert.equal(afterFirst.updateTime.toMillis(), before.updateTime.toMillis());
  const results = await Promise.all([
    commandRealtimeRound({
      uid: "guest", battleId, command: "submit-action",
      input: { requestId: "guest-1", round: 1, expectedStateVersion: 4, action: "special_attack" },
      deps: { db, now: new Date("2026-07-30T00:00:04.000Z") },
    }),
    commandRealtimeRound({
      uid: "guest", battleId, command: "submit-action",
      input: { requestId: "guest-1", round: 1, expectedStateVersion: 4, action: "special_attack" },
      deps: { db, now: new Date("2026-07-30T00:00:04.000Z") },
    }),
  ]);
  assert.ok(results.every((result) => result.status === "resolved" || result.status === "replayed"));
  const finalBattle = (await db.doc(`realtimeArenaBattles/${battleId}`).get()).data();
  assert.equal(finalBattle.round, 2);
  assert.equal(finalBattle.resolvedRounds.length, 1);
  assert.equal(finalBattle.stateVersion, 5);
});
