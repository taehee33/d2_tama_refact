"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const babel = require("../digimon-tamagotchi-frontend/node_modules/@babel/core");
const presetReactApp = require.resolve("../digimon-tamagotchi-frontend/node_modules/babel-preset-react-app");

const { admin, initializeFirestore } = require("./nicknameIndexShared");
const encyclopediaMigrationCore = require("../digimon-tamagotchi-frontend/src/utils/encyclopediaMigrationCore");

const {
  areEntriesEquivalent,
  buildCanonicalEncyclopedia,
  createEmptyEncyclopedia,
  hasVersionEntries,
  mergeEncyclopediaEntry,
  normalizeVersionEntries,
  toEpochMs,
} = encyclopediaMigrationCore;

const MIGRATION_VERSION = "2026-04-12-encyclopedia-v2";
const WRITE_BATCH_LIMIT = 350;
const BASE_MAX_SLOTS = 10;
const SLOTS_PER_MASTER = 5;
const ACHIEVEMENT_VER1_MASTER = "ver1_master";
const ACHIEVEMENT_VER2_MASTER = "ver2_master";
const ENCYCLOPEDIA_STRUCTURE = {
  storageMode: "version-docs-with-root-metadata",
  canonicalCollection: "encyclopedia",
  canonicalDocStrategy: "version",
  rootMirrorEnabled: false,
  phase: "read-compat",
};
const FRONTEND_SRC_ROOT = path.resolve(__dirname, "../digimon-tamagotchi-frontend/src");
const ORIGINAL_JS_LOADER = Module._extensions[".js"];

let frontendLoaderInstalled = false;
let frontendDependenciesCache = null;

function installFrontendSourceLoader() {
  if (frontendLoaderInstalled) {
    return;
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "test";
  }
  if (!process.env.BABEL_ENV) {
    process.env.BABEL_ENV = process.env.NODE_ENV;
  }

  Module._extensions[".js"] = function compileFrontendSource(module, filename) {
    if (filename.startsWith(FRONTEND_SRC_ROOT)) {
      const source = fs.readFileSync(filename, "utf8");
      const { code } = babel.transformSync(source, {
        filename,
        presets: [presetReactApp],
        babelrc: false,
        configFile: false,
        sourceMaps: "inline",
      });
      return module._compile(code, filename);
    }

    return ORIGINAL_JS_LOADER(module, filename);
  };

  frontendLoaderInstalled = true;
}

function loadFrontendEncyclopediaDependencies() {
  if (frontendDependenciesCache) {
    return frontendDependenciesCache;
  }

  installFrontendSourceLoader();

  const digimonVersionUtils = require(path.join(FRONTEND_SRC_ROOT, "utils/digimonVersionUtils.js"));
  const digimonLogSnapshot = require(path.join(FRONTEND_SRC_ROOT, "utils/digimonLogSnapshot.js"));
  const encyclopediaMaster = require(path.join(FRONTEND_SRC_ROOT, "logic/encyclopediaMaster.js"));

  frontendDependenciesCache = {
    versions: digimonVersionUtils.SUPPORTED_DIGIMON_VERSIONS,
    getDigimonDataMapByVersion: digimonVersionUtils.getDigimonDataMapByVersion,
    getDigimonVersionByDigimonId: digimonVersionUtils.getDigimonVersionByDigimonId,
    normalizeDigimonVersionLabel: digimonVersionUtils.normalizeDigimonVersionLabel,
    resolveDigimonSnapshotFromToken: digimonLogSnapshot.resolveDigimonSnapshotFromToken,
    computeAchievementsFromEncyclopedia(encyclopedia = {}) {
      const achievements = [];
      const achievementConfigs = [
        { version: "Ver.1", key: ACHIEVEMENT_VER1_MASTER },
        { version: "Ver.2", key: ACHIEVEMENT_VER2_MASTER },
      ];

      achievementConfigs.forEach(({ version, key }) => {
        const requiredIds = encyclopediaMaster.getRequiredDigimonIds(version);
        if (encyclopediaMaster.isVersionComplete(encyclopedia?.[version] || {}, requiredIds)) {
          achievements.push(key);
        }
      });

      return achievements;
    },
  };

  return frontendDependenciesCache;
}

function parseRecoveredDigimonToken(text = "") {
  const patterns = [
    /Reborn as\s+([^\n]+)/i,
    /Transformed to\s+(.+?)\s+\(death form\)/i,
    /Evolved to\s+(.+?)!/i,
    /조그레스 진화(?:\([^)]*\))?:\s*(.+?)!/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function getRecoveryDataMaps(preferredVersion = "Ver.1", dependencies) {
  const normalizedVersion = dependencies.normalizeDigimonVersionLabel(preferredVersion);

  return [
    dependencies.getDigimonDataMapByVersion(normalizedVersion),
    ...dependencies.versions
      .filter((version) => version !== normalizedVersion)
      .map((version) => dependencies.getDigimonDataMapByVersion(version)),
  ].filter(Boolean);
}

function resolveRecoveredDigimonId(entry, preferredVersion = "Ver.1", dependencies) {
  const directDigimonId =
    typeof entry?.digimonId === "string" ? entry.digimonId.trim() : "";
  if (directDigimonId) {
    return directDigimonId;
  }

  const directToken =
    typeof entry?.digimonName === "string" && entry.digimonName.trim()
      ? entry.digimonName.trim()
      : parseRecoveredDigimonToken(entry?.text || "");

  if (!directToken) {
    return null;
  }

  return (
    dependencies.resolveDigimonSnapshotFromToken(
      directToken,
      ...getRecoveryDataMaps(preferredVersion, dependencies)
    )?.digimonId || null
  );
}

function buildRecoveredEncyclopediaEntry(observedAt = Date.now(), resultText) {
  const observedAtMs = toEpochMs(observedAt) ?? Date.now();

  return {
    isDiscovered: true,
    firstDiscoveredAt: observedAtMs,
    raisedCount: 1,
    lastRaisedAt: observedAtMs,
    bestStats: {},
    history: [
      {
        date: observedAtMs,
        result: resultText || "복구: 슬롯 기록에서 발견 이력 복원",
        finalStats: {},
      },
    ],
  };
}

function resolveRecoveredDigimonVersion(digimonId, preferredVersion = "Ver.1", dependencies) {
  const normalizedDigimonId = typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedDigimonId) {
    return dependencies.normalizeDigimonVersionLabel(preferredVersion);
  }

  const preferredDataMap = dependencies.getDigimonDataMapByVersion(preferredVersion) || {};
  if (preferredDataMap[normalizedDigimonId]) {
    return dependencies.normalizeDigimonVersionLabel(preferredVersion);
  }

  return dependencies.normalizeDigimonVersionLabel(
    dependencies.getDigimonVersionByDigimonId(normalizedDigimonId) || preferredVersion
  );
}

function markRecoveredDigimon(
  encyclopedia,
  digimonId,
  observedAt,
  resultText,
  preferredVersion = "Ver.1",
  dependencies
) {
  const normalizedDigimonId =
    typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedDigimonId) {
    return;
  }

  const version = resolveRecoveredDigimonVersion(
    normalizedDigimonId,
    preferredVersion,
    dependencies
  );

  if (!encyclopedia[version]) {
    encyclopedia[version] = {};
  }

  encyclopedia[version][normalizedDigimonId] = mergeEncyclopediaEntry(
    encyclopedia[version][normalizedDigimonId],
    buildRecoveredEncyclopediaEntry(observedAt, resultText)
  );
}

function collectRecoveredDigimonsFromEntries(
  encyclopedia,
  entries = [],
  preferredVersion = "Ver.1",
  dependencies,
  resultText = "복구: 활동 로그에서 발견 이력 복원"
) {
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const digimonId = resolveRecoveredDigimonId(entry, preferredVersion, dependencies);
    if (!digimonId) {
      return;
    }

    markRecoveredDigimon(
      encyclopedia,
      digimonId,
      entry?.timestamp,
      resultText,
      preferredVersion,
      dependencies
    );
  });
}

function buildSlotLegacyEncyclopedia(slotRecords = [], versions = []) {
  const sources = slotRecords
    .filter((slotRecord) => slotRecord?.data?.encyclopedia)
    .map((slotRecord, index) => ({
      key: `slot-${slotRecord.id || index + 1}`,
      encyclopedia: slotRecord.data.encyclopedia,
    }));

  return buildCanonicalEncyclopedia({
    versions,
    sources,
  }).encyclopedia;
}

function buildRecoveredEncyclopediaFromSlotRecords(slotRecords = [], dependencies) {
  const recovered = createEmptyEncyclopedia(dependencies.versions);

  slotRecords.forEach((slotRecord) => {
    const slotData = slotRecord?.data || {};
    const slotVersion = dependencies.normalizeDigimonVersionLabel(
      slotData.version || "Ver.1"
    );
    const slotObservedAt =
      toEpochMs(slotData.updatedAt) ??
      toEpochMs(slotData.createdAt) ??
      Date.now();

    markRecoveredDigimon(
      recovered,
      slotData.selectedDigimon,
      slotObservedAt,
      "복구: 현재 슬롯 디지몬 반영",
      slotVersion,
      dependencies
    );
    markRecoveredDigimon(
      recovered,
      slotData.digimonStats?.selectedDigimon,
      slotObservedAt,
      "복구: 저장된 슬롯 스탯 반영",
      slotVersion,
      dependencies
    );

    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.digimonStats?.activityLogs,
      slotVersion,
      dependencies
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.activityLogs,
      slotVersion,
      dependencies
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.digimonStats?.battleLogs,
      slotVersion,
      dependencies,
      "복구: 배틀 로그에서 발견 이력 복원"
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotData.battleLogs,
      slotVersion,
      dependencies,
      "복구: 배틀 로그에서 발견 이력 복원"
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotRecord.activityLogDocs,
      slotVersion,
      dependencies
    );
    collectRecoveredDigimonsFromEntries(
      recovered,
      slotRecord.battleLogDocs,
      slotVersion,
      dependencies,
      "복구: 배틀 로그에서 발견 이력 복원"
    );
  });

  return recovered;
}

function computeMaxSlotsFromAchievements(achievements = []) {
  const masterCount = (Array.isArray(achievements) ? achievements : []).filter(
    (achievement) =>
      achievement === ACHIEVEMENT_VER1_MASTER || achievement === ACHIEVEMENT_VER2_MASTER
  ).length;

  return BASE_MAX_SLOTS + masterCount * SLOTS_PER_MASTER;
}

function areVersionEntriesEqual(left = {}, right = {}) {
  const normalizedLeft = normalizeVersionEntries(left);
  const normalizedRight = normalizeVersionEntries(right);
  const digimonIds = [...new Set([...Object.keys(normalizedLeft), ...Object.keys(normalizedRight)])];

  if (Object.keys(normalizedLeft).length !== Object.keys(normalizedRight).length) {
    return false;
  }

  return digimonIds.every((digimonId) => {
    const leftEntry = normalizedLeft[digimonId];
    const rightEntry = normalizedRight[digimonId];

    if (!leftEntry || !rightEntry) {
      return false;
    }

    return areEntriesEquivalent(leftEntry, rightEntry);
  });
}

function resolveCurrentAchievements(profileData = {}, rootData = {}) {
  if (Array.isArray(profileData?.achievements)) {
    return profileData.achievements;
  }

  if (Array.isArray(rootData?.achievements)) {
    return rootData.achievements;
  }

  return [];
}

function resolveCurrentMaxSlots(profileData = {}, rootData = {}) {
  if (typeof profileData?.maxSlots === "number") {
    return profileData.maxSlots;
  }

  if (typeof rootData?.maxSlots === "number") {
    return rootData.maxSlots;
  }

  return BASE_MAX_SLOTS;
}

function buildMigrationMetadata(sourceSummary = {}) {
  return {
    migrationVersion: MIGRATION_VERSION,
    sourceSummary,
    recoveredFromLogs: sourceSummary?.recoveredFromLogs || 0,
  };
}

function buildRootMetadataPayload(analysis = {}, adminModule) {
  return {
    encyclopediaStructure: ENCYCLOPEDIA_STRUCTURE,
    encyclopediaMigration: {
      ...analysis.migrationMetadata,
      lastMigratedAt: adminModule.firestore.FieldValue.serverTimestamp(),
    },
  };
}

function analyzeUserEncyclopediaMigration(userSources = {}, dependencies) {
  const rootData = userSources?.rootData || {};
  const profileData = userSources?.profileData || {};
  const versionEncyclopedia =
    userSources?.versionEncyclopedia || createEmptyEncyclopedia(dependencies.versions);
  const slotRecords = Array.isArray(userSources?.slotRecords) ? userSources.slotRecords : [];
  const slotLegacyEncyclopedia = buildSlotLegacyEncyclopedia(slotRecords, dependencies.versions);
  const recoveredEncyclopedia = buildRecoveredEncyclopediaFromSlotRecords(slotRecords, dependencies);
  const { encyclopedia: canonicalEncyclopedia, sourceSummary } = buildCanonicalEncyclopedia({
    versions: dependencies.versions,
    sources: [
      {
        key: "versionDocs",
        encyclopedia: versionEncyclopedia,
      },
      {
        key: "rootLegacy",
        encyclopedia: rootData?.encyclopedia,
        isFallback: true,
      },
      {
        key: "slotLegacy",
        encyclopedia: slotLegacyEncyclopedia,
        isFallback: true,
      },
      {
        key: "logsRecovery",
        encyclopedia: recoveredEncyclopedia,
        isFallback: true,
        onlyFillMissing: true,
      },
    ],
  });
  const achievements = dependencies.computeAchievementsFromEncyclopedia(canonicalEncyclopedia);
  const maxSlots = computeMaxSlotsFromAchievements(achievements);
  const versionDocChanges = dependencies.versions.reduce((accumulator, version) => {
    accumulator[version] = !areVersionEntriesEqual(
      versionEncyclopedia?.[version],
      canonicalEncyclopedia?.[version]
    );
    return accumulator;
  }, {});
  const currentAchievements = resolveCurrentAchievements(profileData, rootData);
  const currentMaxSlots = resolveCurrentMaxSlots(profileData, rootData);

  return {
    uid: userSources?.uid || null,
    canonicalEncyclopedia,
    sourceSummary,
    achievements,
    maxSlots,
    currentAchievements,
    currentMaxSlots,
    versionDocChanges,
    migrationMetadata: buildMigrationMetadata(sourceSummary),
  };
}

async function fetchVersionEncyclopedia(userDoc, dependencies) {
  const versionEncyclopedia = createEmptyEncyclopedia(dependencies.versions);
  const versionSnapshots = await Promise.all(
    dependencies.versions.map((version) =>
      userDoc.ref.collection("encyclopedia").doc(version).get()
    )
  );

  versionSnapshots.forEach((snapshot, index) => {
    if (snapshot.exists) {
      versionEncyclopedia[dependencies.versions[index]] = normalizeVersionEntries(snapshot.data());
    }
  });

  return versionEncyclopedia;
}

async function fetchSlotRecords(userDoc) {
  const slotSnapshot = await userDoc.ref.collection("slots").get();

  return await Promise.all(
    slotSnapshot.docs.map(async (slotDoc) => {
      const [activityLogsSnapshot, battleLogsSnapshot] = await Promise.all([
        slotDoc.ref.collection("logs").get(),
        slotDoc.ref.collection("battleLogs").get(),
      ]);

      return {
        id: slotDoc.id,
        data: slotDoc.data(),
        activityLogDocs: activityLogsSnapshot.docs.map((logDoc) => logDoc.data()),
        battleLogDocs: battleLogsSnapshot.docs.map((logDoc) => logDoc.data()),
      };
    })
  );
}

async function fetchUserMigrationSources(userDoc, dependencies) {
  const [profileSnapshot, versionEncyclopedia, slotRecords] = await Promise.all([
    userDoc.ref.collection("profile").doc("main").get(),
    fetchVersionEncyclopedia(userDoc, dependencies),
    fetchSlotRecords(userDoc),
  ]);

  return {
    uid: userDoc.id,
    rootData: userDoc.data(),
    profileData: profileSnapshot.exists ? profileSnapshot.data() : {},
    versionEncyclopedia,
    slotRecords,
  };
}

async function fetchTargetUserDocs(db, userIds = [], limit = null) {
  const uniqueUserIds = [...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean))];

  if (uniqueUserIds.length > 0) {
    const userSnapshots = await Promise.all(
      uniqueUserIds.map((uid) => db.collection("users").doc(uid).get())
    );

    return {
      userDocs: userSnapshots.filter((snapshot) => snapshot.exists),
      missingUserIds: uniqueUserIds.filter((uid, index) => !userSnapshots[index].exists),
    };
  }

  let query = db.collection("users");
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const usersSnapshot = await query.get();
  return {
    userDocs: usersSnapshot.docs,
    missingUserIds: [],
  };
}

function createUserReport(analysis, dependencies) {
  const changedVersions = dependencies.versions.filter(
    (version) =>
      analysis.versionDocChanges[version] &&
      hasVersionEntries(analysis.canonicalEncyclopedia?.[version])
  );

  return {
    uid: analysis.uid,
    canonicalEntryCount: Object.values(analysis.sourceSummary?.canonical?.byVersion || {}).reduce(
      (sum, count) => sum + count,
      0
    ),
    changedVersions,
    achievementsChanged:
      JSON.stringify([...(analysis.currentAchievements || [])].sort()) !==
      JSON.stringify([...(analysis.achievements || [])].sort()),
    maxSlotsChanged: analysis.currentMaxSlots !== analysis.maxSlots,
    fallbackSources: analysis.sourceSummary?.fallbackSources || [],
    recoveredFromLogs: analysis.migrationMetadata?.recoveredFromLogs || 0,
    achievements: analysis.achievements,
    maxSlots: analysis.maxSlots,
  };
}

async function commitBatch(batch, operationCount) {
  if (operationCount === 0) {
    return 0;
  }

  await batch.commit();
  return 1;
}

function queueUserMigrationWrites(batch, userDoc, analysis, dependencies, adminModule) {
  let operationCount = 0;
  let versionWriteCount = 0;

  dependencies.versions.forEach((version) => {
    const versionEntries = analysis.canonicalEncyclopedia?.[version];
    if (!hasVersionEntries(versionEntries)) {
      return;
    }

    if (!analysis.versionDocChanges[version]) {
      return;
    }

    batch.set(userDoc.ref.collection("encyclopedia").doc(version), versionEntries);
    operationCount += 1;
    versionWriteCount += 1;
  });

  const sharedProfilePayload = {
    achievements: analysis.achievements,
    maxSlots: analysis.maxSlots,
    updatedAt: adminModule.firestore.FieldValue.serverTimestamp(),
  };

  batch.set(
    userDoc.ref,
    {
      ...buildRootMetadataPayload(analysis, adminModule),
    },
    { merge: true }
  );
  operationCount += 1;

  batch.set(
    userDoc.ref.collection("profile").doc("main"),
    sharedProfilePayload,
    { merge: true }
  );
  operationCount += 1;

  return {
    operationCount,
    versionWriteCount,
  };
}

async function runEncyclopediaMigration({
  db = null,
  dryRun = true,
  limit = null,
  userIds = [],
  logger = console,
  dependencies = null,
  adminModule = admin,
} = {}) {
  const firestore = db || initializeFirestore();
  const resolvedDependencies = dependencies || loadFrontendEncyclopediaDependencies();
  const { userDocs, missingUserIds } = await fetchTargetUserDocs(
    firestore,
    userIds,
    limit
  );

  const summary = {
    dryRun,
    processedUsers: 0,
    missingUserIds,
    usersWithVersionWrites: 0,
    versionDocWrites: 0,
    profileWrites: 0,
    rootMetadataWrites: 0,
    achievementChanges: 0,
    fallbackUsers: 0,
    recoveredUsers: 0,
    recoveredEntries: 0,
    committedBatchCount: 0,
    reports: [],
  };

  let batch = dryRun ? null : firestore.batch();
  let batchedOperationCount = 0;

  for (const userDoc of userDocs) {
    summary.processedUsers += 1;

    const userSources = await fetchUserMigrationSources(userDoc, resolvedDependencies);
    const analysis = analyzeUserEncyclopediaMigration(userSources, resolvedDependencies);
    const report = createUserReport(analysis, resolvedDependencies);
    summary.reports.push(report);

    if (report.changedVersions.length > 0) {
      summary.usersWithVersionWrites += 1;
      summary.versionDocWrites += report.changedVersions.length;
    }
    if (report.achievementsChanged || report.maxSlotsChanged) {
      summary.achievementChanges += 1;
    }
    if (report.fallbackSources.length > 0) {
      summary.fallbackUsers += 1;
    }
    if (report.recoveredFromLogs > 0) {
      summary.recoveredUsers += 1;
      summary.recoveredEntries += report.recoveredFromLogs;
    }

    if (dryRun) {
      continue;
    }

    const queuedWrites = queueUserMigrationWrites(
      batch,
      userDoc,
      analysis,
      resolvedDependencies,
      adminModule
    );
    batchedOperationCount += queuedWrites.operationCount;
    summary.profileWrites += 1;
    summary.rootMetadataWrites += 1;

    if (batchedOperationCount >= WRITE_BATCH_LIMIT) {
      summary.committedBatchCount += await commitBatch(batch, batchedOperationCount);
      batch = firestore.batch();
      batchedOperationCount = 0;
    }
  }

  if (!dryRun) {
    summary.committedBatchCount += await commitBatch(batch, batchedOperationCount);
  }

  if (logger?.log) {
    logger.log(
      `[encyclopedia migration] ${dryRun ? "DRY RUN" : "APPLY"} | 처리 사용자 ${summary.processedUsers}건`
    );
    if (summary.missingUserIds.length > 0) {
      logger.log(
        `[encyclopedia migration] 찾지 못한 UID ${summary.missingUserIds.length}건: ${summary.missingUserIds.join(", ")}`
      );
    }
    logger.log(
      `[encyclopedia migration] 버전 문서 변경 사용자 ${summary.usersWithVersionWrites}건 / 문서 ${summary.versionDocWrites}건`
    );
    logger.log(
      `[encyclopedia migration] achievements 또는 maxSlots 재계산 대상 ${summary.achievementChanges}건`
    );
    logger.log(
      `[encyclopedia migration] legacy fallback 의존 사용자 ${summary.fallbackUsers}건`
    );
    logger.log(
      `[encyclopedia migration] 로그 기반 복구 사용자 ${summary.recoveredUsers}건 / 복구 엔트리 ${summary.recoveredEntries}건`
    );
    if (!dryRun) {
      logger.log(
        `[encyclopedia migration] profile/main 쓰기 ${summary.profileWrites}건 / root metadata 쓰기 ${summary.rootMetadataWrites}건 / 커밋 배치 ${summary.committedBatchCount}개`
      );
    }

    summary.reports.forEach((report) => {
      logger.log(
        `- uid=${report.uid} | canonical=${report.canonicalEntryCount} | changedVersions=${
          report.changedVersions.join(",") || "-"
        } | fallback=${report.fallbackSources.join(",") || "-"} | recovered=${
          report.recoveredFromLogs
        } | achievements=${report.achievements.join(",") || "-"} | maxSlots=${report.maxSlots}`
      );
    });

    if (!dryRun) {
      logger.log(
        "[encyclopedia migration] 1차 마이그레이션은 root/slot legacy 도감 필드를 삭제하지 않습니다."
      );
    }
  }

  return summary;
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: true,
    limit: null,
    userIds: [],
  };

  argv.forEach((arg) => {
    if (arg === "--apply") {
      options.dryRun = false;
      return;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith("--limit=")) {
      const parsedLimit = Number.parseInt(arg.split("=")[1], 10);
      options.limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
      return;
    }

    if (arg.startsWith("--user=") || arg.startsWith("--users=")) {
      const rawUserIds = arg.split("=")[1] || "";
      options.userIds.push(
        ...rawUserIds
          .split(",")
          .map((userId) => userId.trim())
          .filter(Boolean)
      );
    }
  });

  options.userIds = [...new Set(options.userIds)];
  return options;
}

async function main() {
  const options = parseCliArgs();
  await runEncyclopediaMigration(options);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[encyclopedia migration] 실패:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
  MIGRATION_VERSION,
  analyzeUserEncyclopediaMigration,
  computeMaxSlotsFromAchievements,
  loadFrontendEncyclopediaDependencies,
  parseCliArgs,
  runEncyclopediaMigration,
};
