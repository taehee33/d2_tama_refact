"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

function parseEmulatorHost(value) {
  const [host, port] = String(value || "127.0.0.1:8080").split(":");
  return { host, port: Number(port) || 8080 };
}

test("Arena combat identity bridge Rules가 형태·생명 전환 불변식을 지킨다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `arena-rules-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  const aliceDb = testEnvironment.authenticatedContext("alice").firestore();
  const strictRef = doc(aliceDb, "users/alice/slots/slot1");
  const legacyRef = doc(aliceDb, "users/alice/slots/slot2");
  const corruptRef = doc(aliceDb, "users/alice/slots/slot3");

  await assertFails(
    setDoc(strictRef, { selectedDigimon: "Digitama", digimonStats: {} })
  );
  await assertSucceeds(
    setDoc(strictRef, {
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "life-a",
      combatRevision: 1,
      selectedDigimon: "Digitama",
      digimonStats: {},
    })
  );
  await assertSucceeds(updateDoc(strictRef, { digimonStats: { strength: 2 } }));
  await assertFails(
    updateDoc(strictRef, {
      selectedDigimon: "Koromon",
    })
  );
  await assertSucceeds(
    updateDoc(strictRef, {
      selectedDigimon: "Koromon",
      combatRevision: 2,
    })
  );
  await assertFails(
    updateDoc(strictRef, {
      digimonInstanceId: "life-b",
      combatRevision: 3,
    })
  );
  await assertSucceeds(
    updateDoc(strictRef, {
      digimonInstanceId: "life-b",
      combatRevision: 1,
      selectedDigimon: "Digitama",
    })
  );

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice/slots/slot2"), {
      selectedDigimon: "Agumon",
      digimonStats: {},
    });
    await setDoc(doc(context.firestore(), "users/alice/slots/slot3"), {
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: null,
      combatRevision: 0,
      selectedDigimon: "Agumon",
      digimonStats: {},
    });
  });
  await assertSucceeds(updateDoc(legacyRef, { digimonStats: { strength: 3 } }));
  await assertFails(updateDoc(corruptRef, { digimonStats: { strength: 3 } }));

  await assertFails(
    setDoc(doc(aliceDb, "arena_ghosts/ghost-a"), {
      ownerUid: "alice",
    })
  );
  await assertFails(
    setDoc(doc(aliceDb, "arena_combat_records/identity-a"), {
      ownerUid: "alice",
    })
  );
});
