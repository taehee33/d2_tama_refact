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
  deleteDoc,
  doc,
  getDoc,
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
  for (const target of [
    "jogress_rooms/room-a",
    "jogress_room_owners/alice",
    "jogress_room_registrations/registration-a",
    "jogress_room_v3_migration_backups/room-a",
  ]) {
    await assertFails(setDoc(doc(aliceDb, target), { ownerUid: "alice" }));
  }
});

test("legacy Jogress 로그와 Arena 엔트리는 모든 클라이언트 쓰기를 거부한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `legacy-global-write-rules-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "jogress_logs/existing-log"), {
      ownerUid: "regular-user",
    });
    await setDoc(doc(context.firestore(), "arena_entries/existing-entry"), {
      userId: "regular-user",
    });
    await setDoc(doc(context.firestore(), "operator_roles/operator-user"), {
      active: true,
      role: "operator",
    });
  });

  const contexts = [
    {
      label: "비인증",
      db: testEnvironment.unauthenticatedContext().firestore(),
    },
    {
      label: "익명 로그인",
      db: testEnvironment.authenticatedContext("anonymous-user", {
        firebase: { sign_in_provider: "anonymous" },
      }).firestore(),
    },
    {
      label: "일반 로그인",
      db: testEnvironment.authenticatedContext("regular-user").firestore(),
    },
    {
      label: "운영자 로그인",
      db: testEnvironment.authenticatedContext("operator-user").firestore(),
    },
  ];

  for (const { label, db } of contexts) {
    await t.test(`${label} 사용자의 legacy 전역 쓰기`, async () => {
      await assertFails(
        setDoc(doc(db, `jogress_logs/new-${label}`), { ownerUid: label })
      );
      await assertFails(
        updateDoc(doc(db, "jogress_logs/existing-log"), { ownerUid: label })
      );
      await assertFails(deleteDoc(doc(db, "jogress_logs/existing-log")));

      await assertFails(
        setDoc(doc(db, `arena_entries/new-${label}`), {
          userId: label,
          record: {
            wins: 0,
            losses: 0,
            seasonWins: 0,
            seasonLosses: 0,
            seasonId: 3,
          },
        })
      );
      await assertFails(
        updateDoc(doc(db, "arena_entries/existing-entry"), { userId: label })
      );
      await assertFails(deleteDoc(doc(db, "arena_entries/existing-entry")));
    });
  }

  const regularDb = testEnvironment.authenticatedContext("regular-user").firestore();
  await assertSucceeds(getDoc(doc(regularDb, "jogress_logs/existing-log")));
  await assertSucceeds(getDoc(doc(regularDb, "arena_entries/existing-entry")));
  await assertFails(
    getDoc(
      doc(
        testEnvironment.unauthenticatedContext().firestore(),
        "arena_entries/existing-entry"
      )
    )
  );
});

test("마스터 데이터와 모든 game_settings는 서버만 쓸 수 있다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `master-data-rules-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const serverDb = context.firestore();
    await setDoc(doc(serverDb, "game_settings/arena_config"), { mode: "active" });
    await setDoc(doc(serverDb, "game_settings/digimon_master_data"), {
      revision: 2,
      ver1Overrides: {},
    });
    await setDoc(
      doc(serverDb, "game_settings/digimon_master_data/snapshots/receipt-1"),
      { revisionAfter: 2 }
    );
  });

  const contexts = [
    {
      label: "비인증",
      db: testEnvironment.unauthenticatedContext().firestore(),
    },
    {
      label: "익명 로그인",
      db: testEnvironment.authenticatedContext("anonymous-user", {
        firebase: { sign_in_provider: "anonymous" },
      }).firestore(),
    },
    {
      label: "일반 로그인",
      db: testEnvironment.authenticatedContext("regular-user").firestore(),
    },
    {
      label: "운영자 로그인",
      db: testEnvironment.authenticatedContext("operator-user").firestore(),
    },
  ];

  for (const { label, db } of contexts) {
    await t.test(`${label} 사용자의 전역 설정 쓰기`, async () => {
      await assertFails(
        setDoc(doc(db, `game_settings/new-setting-${label}`), { enabled: true })
      );
      await assertFails(
        updateDoc(doc(db, "game_settings/arena_config"), { mode: "disabled" })
      );
      await assertFails(
        updateDoc(doc(db, "game_settings/digimon_master_data"), { revision: 3 })
      );
      await assertFails(deleteDoc(doc(db, "game_settings/digimon_master_data")));
      await assertFails(
        setDoc(
          doc(db, `game_settings/digimon_master_data/snapshots/new-${label}`),
          { revisionAfter: 3 }
        )
      );
      await assertFails(
        updateDoc(
          doc(db, "game_settings/digimon_master_data/snapshots/receipt-1"),
          { revisionAfter: 4 }
        )
      );
      await assertFails(
        deleteDoc(
          doc(db, "game_settings/digimon_master_data/snapshots/receipt-1")
        )
      );
    });
  }

  const regularDb = testEnvironment.authenticatedContext("regular-user").firestore();
  await assertSucceeds(getDoc(doc(regularDb, "game_settings/arena_config")));
  await assertSucceeds(getDoc(doc(regularDb, "game_settings/digimon_master_data")));
  await assertSucceeds(
    getDoc(
      doc(regularDb, "game_settings/digimon_master_data/snapshots/receipt-1")
    )
  );
  await assertFails(
    getDoc(
      doc(
        testEnvironment.unauthenticatedContext().firestore(),
        "game_settings/digimon_master_data"
      )
    )
  );
});
