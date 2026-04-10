"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACHIEVEMENT_VER1_MASTER,
  analyzeUserEncyclopediaMigration,
  runEncyclopediaMigration,
} = require("../scripts/backfillUserEncyclopedia");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(baseValue, incomingValue) {
  if (!isPlainObject(baseValue) || !isPlainObject(incomingValue)) {
    return clone(incomingValue);
  }

  const merged = { ...clone(baseValue) };
  Object.entries(incomingValue).forEach(([key, value]) => {
    merged[key] = key in merged ? deepMerge(merged[key], value) : clone(value);
  });
  return merged;
}

function createMockFirestore(initialDocuments = {}) {
  const store = new Map(
    Object.entries(initialDocuments).map(([docPath, data]) => [docPath, clone(data)])
  );

  function getDirectChildren(collectionPath) {
    return Array.from(store.entries())
      .filter(([docPath]) => {
        if (!docPath.startsWith(`${collectionPath}/`)) {
          return false;
        }

        const remainder = docPath.slice(collectionPath.length + 1);
        return remainder.split("/").length === 1;
      })
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([docPath, data]) => createDocSnapshot(docPath, data));
  }

  function createDocRef(docPath) {
    return {
      path: docPath,
      id: docPath.split("/").pop(),
      collection(collectionName) {
        return createCollectionRef(`${docPath}/${collectionName}`);
      },
      async get() {
        const data = store.get(docPath);
        return createDocSnapshot(docPath, data);
      },
    };
  }

  function createDocSnapshot(docPath, data) {
    return {
      id: docPath.split("/").pop(),
      exists: data !== undefined,
      data: () => clone(data),
      ref: createDocRef(docPath),
    };
  }

  function createCollectionRef(collectionPath) {
    return {
      path: collectionPath,
      doc(docId) {
        return createDocRef(`${collectionPath}/${docId}`);
      },
      limit(limitValue) {
        return {
          async get() {
            const docs = getDirectChildren(collectionPath).slice(0, limitValue);
            return { docs, size: docs.length };
          },
        };
      },
      async get() {
        const docs = getDirectChildren(collectionPath);
        return { docs, size: docs.length };
      },
    };
  }

  return {
    collection(collectionName) {
      return createCollectionRef(collectionName);
    },
    batch() {
      const operations = [];
      return {
        set(ref, data, options = {}) {
          operations.push({
            path: ref.path,
            data: clone(data),
            merge: Boolean(options && options.merge),
          });
        },
        async commit() {
          operations.forEach(({ path, data, merge }) => {
            const existing = store.get(path);
            store.set(path, merge ? deepMerge(existing || {}, data) : clone(data));
          });
        },
      };
    },
    getData(docPath) {
      return clone(store.get(docPath));
    },
  };
}

function createDependencies() {
  const versions = ["Ver.1", "Ver.2"];
  const dataMaps = {
    "Ver.1": {
      Agumon: { id: "Agumon", name: "아구몬" },
      Patamon: { id: "Patamon", name: "파타몬" },
      Koromon: { id: "Koromon", name: "코로몬" },
    },
    "Ver.2": {
      GabumonV2: { id: "GabumonV2", name: "가부몬X" },
    },
  };

  return {
    versions,
    normalizeDigimonVersionLabel(version = "Ver.1") {
      return versions.includes(version) ? version : "Ver.1";
    },
    getDigimonDataMapByVersion(version = "Ver.1") {
      return dataMaps[version] || {};
    },
    getDigimonVersionByDigimonId(digimonId) {
      if (digimonId === "GabumonV2") {
        return "Ver.2";
      }
      return "Ver.1";
    },
    resolveDigimonSnapshotFromToken(token, ...maps) {
      const normalizedToken = typeof token === "string" ? token.trim() : "";
      if (!normalizedToken) {
        return { digimonId: null, digimonName: null };
      }

      for (const map of maps) {
        if (!map || typeof map !== "object") {
          continue;
        }

        if (map[normalizedToken]) {
          return {
            digimonId: normalizedToken,
            digimonName: map[normalizedToken].name,
          };
        }

        const matchedEntry = Object.entries(map).find(([, entry]) => {
          return entry && (entry.id === normalizedToken || entry.name === normalizedToken);
        });

        if (matchedEntry) {
          const [key, entry] = matchedEntry;
          return {
            digimonId: entry.id || key,
            digimonName: entry.name || normalizedToken,
          };
        }
      }

      return { digimonId: null, digimonName: normalizedToken };
    },
    computeAchievementsFromEncyclopedia(encyclopedia = {}) {
      if (
        encyclopedia?.["Ver.1"]?.Agumon?.isDiscovered &&
        encyclopedia?.["Ver.1"]?.Patamon?.isDiscovered
      ) {
        return [ACHIEVEMENT_VER1_MASTER];
      }

      return [];
    },
  };
}

test("analyzeUserEncyclopediaMigration은 root/version/slot/log 소스를 canonical 규칙으로 병합한다", () => {
  const dependencies = createDependencies();
  const analysis = analyzeUserEncyclopediaMigration(
    {
      uid: "u1",
      rootData: {
        encyclopedia: {
          "Ver.1": {
            Agumon: {
              isDiscovered: true,
              firstDiscoveredAt: 5000,
              raisedCount: 2,
              bestStats: { maxAge: 3 },
              history: [{ date: 5000, result: "root" }],
            },
          },
        },
      },
      versionEncyclopedia: {
        "Ver.1": {
          Agumon: {
            isDiscovered: true,
            firstDiscoveredAt: 3000,
            raisedCount: 1,
            bestStats: { maxAge: 5 },
            history: [{ date: 6000, result: "version" }],
          },
        },
        "Ver.2": {},
      },
      slotRecords: [
        {
          id: "slot1",
          data: {
            version: "Ver.1",
            encyclopedia: {
              "Ver.1": {
                Patamon: {
                  isDiscovered: true,
                  firstDiscoveredAt: 7000,
                  raisedCount: 1,
                  bestStats: { maxWeight: 10 },
                  history: [{ date: 7000, result: "slot" }],
                },
              },
            },
            activityLogs: [
              {
                text: "Evolution: Evolved to Koromon!",
                timestamp: 9000,
              },
            ],
          },
          activityLogDocs: [],
          battleLogDocs: [],
        },
      ],
    },
    dependencies
  );

  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Agumon.firstDiscoveredAt, 3000);
  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Agumon.raisedCount, 2);
  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Agumon.bestStats.maxAge, 5);
  assert.equal(
    analysis.canonicalEncyclopedia["Ver.1"].Agumon.history.map((entry) => entry.result).join(","),
    "version,root"
  );
  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Patamon.isDiscovered, true);
  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Koromon.isDiscovered, true);
  assert.equal(analysis.sourceSummary.rootLegacy.used, true);
  assert.equal(analysis.sourceSummary.slotLegacy.used, true);
  assert.equal(analysis.sourceSummary.logsRecovery.contributedEntries, 1);
  assert.deepEqual(analysis.achievements, [ACHIEVEMENT_VER1_MASTER]);
  assert.equal(analysis.maxSlots, 15);
});

test("runEncyclopediaMigration은 dry-run에서는 쓰지 않고 apply에서 version/profile/root mirror를 갱신한다", async () => {
  const dependencies = createDependencies();
  const logger = { log() {} };
  const adminModule = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "__SERVER_TIMESTAMP__",
      },
    },
  };
  const db = createMockFirestore({
    "users/u1": {
      displayName: "테스터",
      achievements: [],
      maxSlots: 10,
      encyclopedia: {
        "Ver.1": {
          Agumon: {
            isDiscovered: true,
            firstDiscoveredAt: 1000,
            raisedCount: 1,
            bestStats: {},
            history: [],
          },
        },
      },
    },
    "users/u1/slots/slot1": {
      version: "Ver.1",
      encyclopedia: {
        "Ver.1": {
          Patamon: {
            isDiscovered: true,
            firstDiscoveredAt: 2000,
            raisedCount: 1,
            bestStats: {},
            history: [],
          },
        },
      },
      selectedDigimon: "Koromon",
    },
  });

  const dryRunSummary = await runEncyclopediaMigration({
    db,
    dryRun: true,
    userIds: ["u1"],
    dependencies,
    logger,
    adminModule,
  });

  assert.equal(dryRunSummary.versionDocWrites, 1);
  assert.equal(dryRunSummary.profileWrites, 0);
  assert.equal(db.getData("users/u1/encyclopedia/Ver.1"), undefined);

  const applySummary = await runEncyclopediaMigration({
    db,
    dryRun: false,
    userIds: ["u1"],
    dependencies,
    logger,
    adminModule,
  });

  assert.equal(applySummary.versionDocWrites, 1);
  assert.equal(applySummary.profileWrites, 1);
  assert.equal(applySummary.rootMirrorWrites, 1);

  const versionDoc = db.getData("users/u1/encyclopedia/Ver.1");
  assert.deepEqual(Object.keys(versionDoc).sort(), ["Agumon", "Koromon", "Patamon"]);

  const rootUser = db.getData("users/u1");
  assert.deepEqual(rootUser.achievements, [ACHIEVEMENT_VER1_MASTER]);
  assert.equal(rootUser.maxSlots, 15);
  assert.ok(rootUser.encyclopedia);
  assert.equal(rootUser.encyclopediaMigration.migrationVersion, "2026-04-10-encyclopedia-v1");
  assert.equal(rootUser.encyclopediaMigration.lastMigratedAt, "__SERVER_TIMESTAMP__");

  const profileMain = db.getData("users/u1/profile/main");
  assert.deepEqual(profileMain.achievements, [ACHIEVEMENT_VER1_MASTER]);
  assert.equal(profileMain.maxSlots, 15);
  assert.equal(profileMain.updatedAt, "__SERVER_TIMESTAMP__");
});

test("legacy encyclopedia 엔트리에 isDiscovered가 없어도 기록 흔적으로 발견 처리한다", () => {
  const dependencies = createDependencies();

  const analysis = analyzeUserEncyclopediaMigration(
    {
      uid: "u2",
      rootData: {
        encyclopedia: {
          "Ver.1": {
            Agumon: {
              raisedCount: 3,
              history: [{ date: 1000, result: "legacy-root" }],
            },
            Patamon: {
              bestStats: { maxAge: 5 },
            },
          },
        },
      },
      versionEncyclopedia: {
        "Ver.1": {},
        "Ver.2": {},
      },
      slotRecords: [],
    },
    dependencies
  );

  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Agumon.isDiscovered, true);
  assert.equal(analysis.canonicalEncyclopedia["Ver.1"].Patamon.isDiscovered, true);
  assert.deepEqual(analysis.achievements, [ACHIEVEMENT_VER1_MASTER]);
});
