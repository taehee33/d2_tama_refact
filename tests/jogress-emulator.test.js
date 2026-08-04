"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  completeJogressRoom,
  createJogressRoom,
  joinJogressRoom,
  listJogressRooms,
} = require("../digimon-tamagotchi-frontend/api/_lib/jogressService");

function stats() {
  return {
    isDead: false,
    fullness: 5,
    strength: 5,
    effort: 2,
    energy: 20,
    weight: 30,
    lifespanSeconds: 10,
    timeToEvolveSeconds: 999999,
    activityLogs: [],
  };
}

test("live 조그레스는 양쪽을 2단계로 진화시키고 새 형태를 별도 등록한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-${Date.now()}`);
  const db = getFirestore(app);
  let sequence = 0;
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    now: new Date("2026-08-04T00:00:00.000Z"),
    randomUUID: () => `room-${++sequence}`,
  };
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "users"]) {
      await db.recursiveDelete(db.collection(name));
    }
    await deleteApp(app);
  });

  await db.doc("users/host/slots/slot1").set({
    selectedDigimon: "BanchoLeomon", version: "Ver.3", revision: 1,
    digimonInstanceId: "host-life", combatRevision: 4, lastSavedAt: deps.now.getTime(), digimonStats: stats(),
  });
  await db.doc("users/guest/slots/slot2").set({
    selectedDigimon: "Darkdramon", version: "Ver.4", revision: 1,
    digimonInstanceId: "guest-life", combatRevision: 8, lastSavedAt: deps.now.getTime(), digimonStats: stats(),
  });

  const concurrent = await Promise.all([
    createJogressRoom({ uid: "host", slotId: 1, expectedRevision: 1, deps }),
    createJogressRoom({ uid: "host", slotId: "slot1", expectedRevision: 1, deps }),
  ]);
  assert.equal(new Set(concurrent.map((result) => result.room.id)).size, 1);
  const roomId = concurrent[0].room.id;

  const joined = await joinJogressRoom({ uid: "guest", roomId, guestSlotId: 2, expectedRevision: 1, deps });
  assert.equal(joined.room.status, "paired");
  assert.equal(joined.slotOutcome.selectedDigimon, "Chaosmon");
  assert.equal(joined.slotOutcome.digimonStats.isDead, false);
  assert.equal((await db.doc("users/host/slots/slot1").get()).data().selectedDigimon, "BanchoLeomon");

  const completed = await completeJogressRoom({ uid: "host", roomId, expectedRevision: 1, deps });
  assert.equal(completed.room.status, "completed");
  const host = (await db.doc("users/host/slots/slot1").get()).data();
  const guest = (await db.doc("users/guest/slots/slot2").get()).data();
  assert.equal(host.selectedDigimon, "Chaosmon");
  assert.equal(guest.selectedDigimon, "Chaosmon");
  assert.equal(host.digimonStats.isDead, false);
  assert.equal(guest.digimonStats.isDead, false);
  assert.equal(host.combatRevision, 5);
  assert.equal(guest.combatRevision, 9);
  assert.equal(host.revision, 2);
  assert.equal(guest.revision, 2);

  await db.doc("users/host/slots/slot1").update({ selectedDigimon: "Chimairamon", combatRevision: 6, revision: 3 });
  const replacement = await createJogressRoom({ uid: "host", slotId: 1, expectedRevision: 3, deps });
  assert.notEqual(replacement.room.id, roomId);
});

test("서로 다른 네 형태의 동시 생성은 사용자당 활성 방을 최대 3개로 제한한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-limit-${Date.now()}`);
  const db = getFirestore(app);
  let sequence = 0;
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    now: new Date("2026-08-04T00:30:00.000Z"),
    randomUUID: () => `limit-${++sequence}`,
  };
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "users"]) {
      await db.recursiveDelete(db.collection(name));
    }
    await deleteApp(app);
  });
  for (let slot = 1; slot <= 4; slot += 1) {
    await db.doc(`users/limit-host/slots/slot${slot}`).set({
      selectedDigimon: "BanchoLeomon",
      version: "Ver.3",
      revision: 1,
      digimonInstanceId: `limit-life-${slot}`,
      combatRevision: 1,
      lastSavedAt: deps.now.getTime(),
      digimonStats: stats(),
    });
  }
  const attempts = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => createJogressRoom({
    uid: "limit-host",
    slotId: index + 1,
    expectedRevision: 1,
    deps,
  })));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 3);
  const rejected = attempts.filter((result) => result.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "JOGRESS_ROOM_LIMIT_REACHED");
  const owner = (await db.doc("jogress_room_owners/limit-host").get()).data();
  assert.equal(owner.activeRoomIds.length, 3);
});

test("Ghost 동시 참가는 한 명만 진화시키고 현재 호스트 슬롯을 byte-level로 보존한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-ghost-${Date.now()}`);
  const db = getFirestore(app);
  let sequence = 0;
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    now: new Date("2026-08-04T01:00:00.000Z"),
    randomUUID: () => `ghost-${++sequence}`,
  };
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "users"]) {
      await db.recursiveDelete(db.collection(name));
    }
    await deleteApp(app);
  });

  await db.doc("users/ghost-host/slots/slot1").set({
    selectedDigimon: "Chimairamon", version: "Ver.3", revision: 1,
    digimonInstanceId: "old-life", combatRevision: 3, lastSavedAt: deps.now.getTime(), digimonStats: stats(),
  });
  for (const uid of ["guest-a", "guest-b"]) {
    await db.doc(`users/${uid}/slots/slot1`).set({
      selectedDigimon: "Mugendramon", version: "Ver.5", revision: 1,
      digimonInstanceId: `${uid}-life`, combatRevision: 2, lastSavedAt: deps.now.getTime(), digimonStats: stats(),
    });
  }

  const created = await createJogressRoom({ uid: "ghost-host", slotId: 1, expectedRevision: 1, deps });
  assert.equal(created.room.hostSnapshot.digimonId, "Chimairamon");
  assert.equal(created.room.hostSnapshot.sourceIdentityId, undefined);
  assert.equal(created.room.hostSourceIdentityId, undefined);
  await db.doc("users/ghost-host/slots/slot1").update({
    selectedDigimon: "Darkdramon", version: "Ver.4", revision: 2, combatRevision: 4,
  });
  const replacement = await createJogressRoom({ uid: "ghost-host", slotId: 1, expectedRevision: 2, deps });
  assert.notEqual(replacement.room.id, created.room.id);
  const beforeHost = (await db.doc("users/ghost-host/slots/slot1").get()).data();

  const attempts = await Promise.allSettled([
    joinJogressRoom({ uid: "guest-a", roomId: created.room.id, guestSlotId: 1, expectedRevision: 1, deps }),
    joinJogressRoom({ uid: "guest-b", roomId: created.room.id, guestSlotId: 1, expectedRevision: 1, deps }),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
  const winner = attempts.find((result) => result.status === "fulfilled").value;
  assert.equal(winner.room.status, "completed");
  assert.equal(winner.room.linkStatus, "ghost");
  assert.equal(winner.room.completionMode, "ghost");
  assert.equal(winner.slotOutcome.selectedDigimon, "Millenniumon");
  const winnerUid = winner.room.guestUid;
  const retried = await joinJogressRoom({ uid: winnerUid, roomId: created.room.id, guestSlotId: 1, expectedRevision: 1, deps });
  assert.equal(retried.idempotent, true);
  assert.deepEqual((await db.doc("users/ghost-host/slots/slot1").get()).data(), beforeHost);

  const mine = await listJogressRooms({ uid: "ghost-host", scope: "mine", deps });
  assert.equal(mine.rooms.length, 1);
  assert.equal(mine.rooms[0].id, replacement.room.id);
  assert.equal(mine.rooms[0].linkStatus, "live");
});

test("live 참가 뒤 호스트 형태가 바뀌면 게스트 결과를 유지하고 ghostFallback 완료한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-fallback-${Date.now()}`);
  const db = getFirestore(app);
  const deps = { db, runTransaction: (callback) => db.runTransaction(callback), now: new Date("2026-08-04T01:30:00.000Z"), randomUUID: () => "fallback" };
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "users"]) await db.recursiveDelete(db.collection(name));
    await deleteApp(app);
  });
  await db.doc("users/fallback-host/slots/slot1").set({ selectedDigimon: "BanchoLeomon", version: "Ver.3", revision: 1, digimonInstanceId: "host-life", combatRevision: 1, lastSavedAt: deps.now.getTime(), digimonStats: stats() });
  await db.doc("users/fallback-guest/slots/slot1").set({ selectedDigimon: "Darkdramon", version: "Ver.4", revision: 1, digimonInstanceId: "guest-life", combatRevision: 1, lastSavedAt: deps.now.getTime(), digimonStats: stats() });
  const created = await createJogressRoom({ uid: "fallback-host", slotId: 1, expectedRevision: 1, deps });
  const joined = await joinJogressRoom({ uid: "fallback-guest", roomId: created.room.id, guestSlotId: 1, expectedRevision: 1, deps });
  assert.equal(joined.room.status, "paired");
  await db.doc("users/fallback-host/slots/slot1").update({ selectedDigimon: "Chimairamon", version: "Ver.3", revision: 2, combatRevision: 2 });
  const completed = await completeJogressRoom({ uid: "fallback-host", roomId: created.room.id, expectedRevision: 2, deps });
  assert.equal(completed.room.status, "completed");
  assert.equal(completed.room.completionMode, "ghostFallback");
  const host = (await db.doc("users/fallback-host/slots/slot1").get()).data();
  const guest = (await db.doc("users/fallback-guest/slots/slot1").get()).data();
  assert.equal(host.selectedDigimon, "Chimairamon");
  assert.equal(host.revision, 2);
  assert.deepEqual(host.jogressStatus, {});
  assert.equal(guest.selectedDigimon, "Chaosmon");
});

test("진화·사망·환생·슬롯 삭제 후에도 waiting 방은 Ghost 목록에 유지된다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-links-${Date.now()}`);
  const db = getFirestore(app);
  let sequence = 0;
  const deps = { db, runTransaction: (callback) => db.runTransaction(callback), now: new Date("2026-08-04T02:00:00.000Z"), randomUUID: () => `link-${++sequence}` };
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "users"]) await db.recursiveDelete(db.collection(name));
    await deleteApp(app);
  });
  const mutations = [
    { selectedDigimon: "Darkdramon", combatRevision: 2 },
    { "digimonStats.isDead": true, combatRevision: 2 },
    { digimonInstanceId: "new-life", combatRevision: 1 },
  ];
  for (let index = 0; index < mutations.length; index += 1) {
    const uid = `host-${index}`;
    const ref = db.doc(`users/${uid}/slots/slot1`);
    await ref.set({ selectedDigimon: "BanchoLeomon", version: "Ver.3", revision: 1, digimonInstanceId: "life", combatRevision: 1, lastSavedAt: deps.now.getTime(), digimonStats: stats() });
    await createJogressRoom({ uid, slotId: 1, expectedRevision: 1, deps });
    await ref.update(mutations[index]);
  }
  const deletedRef = db.doc("users/host-deleted/slots/slot1");
  await deletedRef.set({ selectedDigimon: "BanchoLeomon", version: "Ver.3", revision: 1, digimonInstanceId: "life", combatRevision: 1, lastSavedAt: deps.now.getTime(), digimonStats: stats() });
  await createJogressRoom({ uid: "host-deleted", slotId: 1, expectedRevision: 1, deps });
  await deletedRef.delete();

  const waiting = await listJogressRooms({ uid: "viewer", scope: "waiting", deps });
  assert.equal(waiting.rooms.length, 4);
  assert.ok(waiting.rooms.every((room) => room.linkStatus === "ghost" && room.status === "waiting"));
});
