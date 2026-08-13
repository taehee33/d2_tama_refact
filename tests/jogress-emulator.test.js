"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  completeLocalJogress,
  completeJogressRoom,
  createJogressRoom,
  joinJogressRoom,
  listJogressRooms,
} = require("../digimon-tamagotchi-frontend/api/_lib/jogressService");
const {
  createLocalJogressReceiptId,
} = require("../digimon-tamagotchi-frontend/api/_lib/jogressDomain");

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

test("로컬 조그레스는 두 슬롯·로그·도감·receipt를 원자적으로 저장하고 재시도한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" },
    `jogress-local-${Date.now()}`
  );
  const db = getFirestore(app);
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    now: new Date("2026-08-13T00:00:00.000Z"),
  };
  t.after(async () => {
    for (const name of ["jogress_logs", "users"]) {
      await db.recursiveDelete(db.collection(name));
    }
    await deleteApp(app);
  });

  await db.doc("users/local-user/slots/slot1").set({
    selectedDigimon: "BanchoLeomon",
    version: "Ver.3",
    revision: 4,
    slotInstanceId: "slot-life-1",
    digimonInstanceId: "current-life",
    combatRevision: 5,
    lastSavedAt: deps.now.getTime(),
    digimonStats: stats(),
  });
  await db.doc("users/local-user/slots/slot2").set({
    selectedDigimon: "Darkdramon",
    version: "Ver.4",
    revision: 7,
    slotInstanceId: "slot-life-2",
    digimonInstanceId: "partner-life",
    combatRevision: 9,
    lastSavedAt: deps.now.getTime(),
    digimonStats: stats(),
  });

  const input = {
    uid: "local-user",
    requestId: "local-request-1",
    currentSlotId: 1,
    partnerSlotId: 2,
    expectedCurrentRevision: 4,
    expectedPartnerRevision: 7,
    deps,
  };
  const completed = await completeLocalJogress(input);
  assert.equal(completed.idempotent, false);
  assert.equal(completed.slotOutcome.selectedDigimon, "Chaosmon");
  assert.equal(completed.partnerOutcome.selectedDigimon, "Darkdramon");

  const current = (await db.doc("users/local-user/slots/slot1").get()).data();
  const partner = (await db.doc("users/local-user/slots/slot2").get()).data();
  assert.equal(current.selectedDigimon, "Chaosmon");
  assert.equal(current.revision, 5);
  assert.equal(current.combatRevision, 6);
  assert.equal(partner.selectedDigimon, "Darkdramon");
  assert.equal(partner.revision, 8);
  assert.equal(partner.combatRevision, 10);
  assert.equal(partner.digimonStats.isDead, true);
  assert.equal(
    partner.digimonStats.deathReason,
    "JOGRESS_PARTNER (조그레스 파트너)"
  );
  assert.equal(
    (await db.collection("users/local-user/slots/slot1/logs").get()).size,
    1
  );
  assert.equal(
    (await db.collection("users/local-user/slots/slot2/logs").get()).size,
    1
  );
  const encyclopedia = (
    await db.doc("users/local-user/encyclopedia/Ver.3").get()
  ).data();
  assert.equal(encyclopedia.BanchoLeomon.isDiscovered, true);
  assert.equal(encyclopedia.Chaosmon.isDiscovered, true);

  const receiptId = createLocalJogressReceiptId(input);
  const receipt = (await db.doc(`jogress_logs/${receiptId}`).get()).data();
  assert.equal(receipt.requestId, "local-request-1");
  assert.equal(receipt.revisionBefore, 4);
  assert.equal(receipt.revisionAfter, 5);
  assert.equal(receipt.partnerRevisionBefore, 7);
  assert.equal(receipt.partnerRevisionAfter, 8);

  const retried = await completeLocalJogress(input);
  assert.equal(retried.idempotent, true);
  assert.equal(
    (await db.doc("users/local-user/slots/slot1").get()).data().revision,
    5
  );
  assert.equal(
    (await db.collection("users/local-user/slots/slot1/logs").get()).size,
    1
  );
  await assert.rejects(
    completeLocalJogress({ ...input, expectedPartnerRevision: 8 }),
    (error) => error.code === "IDEMPOTENCY_KEY_REUSED"
  );
});

test("로컬 조그레스의 revision 충돌과 transaction 실패는 두 슬롯을 모두 보존한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" },
    `jogress-local-conflict-${Date.now()}`
  );
  const db = getFirestore(app);
  const now = new Date("2026-08-13T00:30:00.000Z");
  t.after(async () => {
    for (const name of ["jogress_logs", "users"]) {
      await db.recursiveDelete(db.collection(name));
    }
    await deleteApp(app);
  });
  const currentRef = db.doc("users/local-conflict/slots/slot1");
  const partnerRef = db.doc("users/local-conflict/slots/slot2");
  await currentRef.set({
    selectedDigimon: "BanchoLeomon", version: "Ver.3", revision: 2,
    slotInstanceId: "slot-a", digimonInstanceId: "life-a", combatRevision: 3,
    lastSavedAt: now.getTime(), digimonStats: stats(),
  });
  await partnerRef.set({
    selectedDigimon: "Darkdramon", version: "Ver.4", revision: 5,
    slotInstanceId: "slot-b", digimonInstanceId: "life-b", combatRevision: 6,
    lastSavedAt: now.getTime(), digimonStats: stats(),
  });
  const beforeCurrent = (await currentRef.get()).data();
  const beforePartner = (await partnerRef.get()).data();

  await assert.rejects(
    completeLocalJogress({
      uid: "local-conflict",
      requestId: "conflict-request",
      currentSlotId: 1,
      partnerSlotId: 2,
      expectedCurrentRevision: 2,
      expectedPartnerRevision: 4,
      deps: { db, runTransaction: (callback) => db.runTransaction(callback), now },
    }),
    (error) => error.code === "JOGRESS_STATE_CONFLICT"
  );
  assert.deepEqual((await currentRef.get()).data(), beforeCurrent);
  assert.deepEqual((await partnerRef.get()).data(), beforePartner);

  const forcedFailure = new Error("forced transaction failure");
  await assert.rejects(
    completeLocalJogress({
      uid: "local-conflict",
      requestId: "forced-failure-request",
      currentSlotId: 1,
      partnerSlotId: 2,
      expectedCurrentRevision: 2,
      expectedPartnerRevision: 5,
      deps: {
        db,
        now,
        runTransaction: (callback) => db.runTransaction(async (transaction) => {
          await callback(transaction);
          throw forcedFailure;
        }),
      },
    }),
    forcedFailure
  );
  assert.deepEqual((await currentRef.get()).data(), beforeCurrent);
  assert.deepEqual((await partnerRef.get()).data(), beforePartner);
  assert.equal((await db.collection("jogress_logs").get()).empty, true);
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
