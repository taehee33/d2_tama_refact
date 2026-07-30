"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { assertFails, assertSucceeds, initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } = require("firebase/firestore");

function parseEmulatorHost(value) {
  const [host, port] = String(value || "127.0.0.1:8080").split(":");
  return { host, port: Number(port) || 8080 };
}

test("실시간 아레나 Rules는 참가자 public get만 허용하고 list/write/secret을 차단한다", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async (t) => {
  const testEnvironment = await initializeTestEnvironment({
    projectId: `realtime-arena-rules-${Date.now()}`,
    firestore: {
      ...parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST),
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "realtimeArenaBattles/battle-a"), { hostUid: "host", guestUid: "guest", status: "waiting" });
    await setDoc(doc(context.firestore(), "realtimeArenaBattleSecrets/battle-a"), { hostSubmission: { action: "attack" } });
  });
  const hostDb = testEnvironment.authenticatedContext("host").firestore();
  const guestDb = testEnvironment.authenticatedContext("guest").firestore();
  const strangerDb = testEnvironment.authenticatedContext("stranger").firestore();
  const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(hostDb, "realtimeArenaBattles/battle-a")));
  await assertSucceeds(getDoc(doc(guestDb, "realtimeArenaBattles/battle-a")));
  await assertFails(getDoc(doc(strangerDb, "realtimeArenaBattles/battle-a")));
  await assertFails(getDoc(doc(anonymousDb, "realtimeArenaBattles/battle-a")));
  await assertFails(getDocs(collection(hostDb, "realtimeArenaBattles")));
  await assertFails(setDoc(doc(hostDb, "realtimeArenaBattles/battle-b"), { hostUid: "host" }));
  await assertFails(updateDoc(doc(hostDb, "realtimeArenaBattles/battle-a"), { status: "finished" }));
  await assertFails(deleteDoc(doc(hostDb, "realtimeArenaBattles/battle-a")));
  await assertFails(getDoc(doc(hostDb, "realtimeArenaBattleSecrets/battle-a")));
  await assertFails(getDoc(doc(guestDb, "realtimeArenaBattleSecrets/battle-a")));
  await assertFails(setDoc(doc(hostDb, "realtimeArenaBattleSecrets/battle-b"), {}));
});
