#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  ARENA_BATTLE_RULES_VERSION,
  ARENA_GHOST_SCHEMA_VERSION,
  ARENA_GHOST_SNAPSHOT_VERSION,
  createEmptyCombatRecord,
  createSeasonRecordId,
} = require("../digimon-tamagotchi-frontend/api/_lib/arenaDomain");
const {
  calculatePower,
  getDigimonEntryByVersion,
} = require("../digimon-tamagotchi-frontend/api/_generated/gameProjection.cjs");

const MIGRATION_SCHEMA_VERSION = 2;

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    limit: Number.POSITIVE_INFINITY,
    projectId: null,
    projectExplicit: false,
    confirmProjectId: null,
    reportPath: null,
    resumeAfter: null,
    allowApplicationDefault: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--limit") {
      options.limit = parsePositiveInteger(argv[index + 1], "--limit");
      index += 1;
    } else if (arg === "--project") {
      options.projectId = argv[index + 1] || null;
      options.projectExplicit = true;
      index += 1;
    } else if (arg === "--confirm-project") {
      options.confirmProjectId = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--report") {
      options.reportPath = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--resume-after") {
      options.resumeAfter = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--allow-application-default") options.allowApplicationDefault = true;
    else if (arg === "--help") options.help = true;
    else throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
  }
  return options;
}

function resolveCredentialSource() {
  if (process.env.FIRESTORE_EMULATOR_HOST) return "firestore-emulator";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return "service-account-json";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return "service-account-path";
  return "application-default";
}

function validateExecutionOptions(options) {
  if (!options.projectId || !options.projectExplicit) {
    throw new Error("대상 project를 --project로 명시해야 합니다.");
  }
  const credentialSource = resolveCredentialSource();
  if (options.apply) {
    if (options.confirmProjectId !== options.projectId) {
      throw new Error("--apply에는 동일한 --confirm-project 값이 필요합니다.");
    }
    if (credentialSource === "application-default" && !options.allowApplicationDefault) {
      throw new Error("--apply에는 명시적 service account 또는 --allow-application-default 확인이 필요합니다.");
    }
  }
  return credentialSource;
}

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const credentialPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return cert(JSON.parse(fs.readFileSync(credentialPath, "utf8")));
  }
  return applicationDefault();
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toDate(value, fallback) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeLegacyRecord(record = {}) {
  return {
    wins: normalizeInteger(record.wins),
    losses: normalizeInteger(record.losses),
    seasonWins: normalizeInteger(record.seasonWins),
    seasonLosses: normalizeInteger(record.seasonLosses),
    seasonId: normalizeInteger(record.seasonId),
    breakdownKnown: false,
  };
}

function analyzeLegacySnapshot(entry = {}, now = new Date()) {
  const source = entry.digimonSnapshot && typeof entry.digimonSnapshot === "object"
    ? entry.digimonSnapshot
    : {};
  const gameVersion = normalizeString(source.slotVersion, "Ver.1");
  const digimonId = normalizeString(source.digimonId || source.digimonName);
  const master = digimonId ? getDigimonEntryByVersion(gameVersion, digimonId) : null;
  const sourceStats = source.stats && typeof source.stats === "object" ? source.stats : null;
  const storedPower = Number(sourceStats?.power);
  const projectedPower = master && sourceStats ? Number(calculatePower(sourceStats, master)) : Number.NaN;
  const issues = [];
  if (!digimonId) issues.push("missing_digimon_id");
  if (!master) issues.push("unsupported_master_data");
  if (!sourceStats) issues.push("missing_stats");
  if (!Number.isFinite(projectedPower) || projectedPower < 0) issues.push("invalid_power_projection");
  const capturedAt = toDate(entry.createdAt, now);
  const snapshot = {
    gameVersion,
    digimonId: digimonId || "Unknown",
    digimonName: normalizeString(source.digimonName, master?.name || digimonId || "Unknown"),
    stage: normalizeString(source.stage, master?.stage || "Unknown"),
    attribute: normalizeString(source.stats?.type, master?.stats?.type || "Free"),
    spriteBasePath: normalizeString(source.spriteBasePath, master?.spriteBasePath || "").slice(0, 180),
    sprite: Math.max(0, normalizeInteger(source.sprite ?? master?.sprite)),
    attackSprite: Math.max(0, normalizeInteger(source.attackSprite ?? master?.stats?.attackSprite ?? source.sprite)),
    combatPowerAtCapture: Number.isFinite(projectedPower) ? Math.max(0, Math.trunc(projectedPower)) : 0,
    ageAtCapture: normalizeInteger(source.stats?.age),
    weightAtCapture: normalizeInteger(source.stats?.weight),
    capturedAt,
  };
  return {
    snapshot,
    issues,
    usable: issues.length === 0,
    powerProjection: {
      storedPower: Number.isFinite(storedPower) ? Math.max(0, Math.trunc(storedPower)) : null,
      projectedPower: snapshot.combatPowerAtCapture,
    },
  };
}

function buildLegacyGhostPlan({ id, data }, now = new Date()) {
  const ownerUid = normalizeString(data?.userId);
  const snapshotAnalysis = analyzeLegacySnapshot(data || {}, now);
  const anomalies = [...snapshotAnalysis.issues];
  if (!ownerUid) anomalies.push("missing_owner_uid");
  return {
    ghostId: id,
    ownerUid: ownerUid || null,
    canCreate: Boolean(ownerUid),
    status: snapshotAnalysis.usable && ownerUid ? "active" : "disabled",
    anomalies,
    ghost: {
      schemaVersion: ARENA_GHOST_SCHEMA_VERSION,
      ghostId: id,
      ownerUid: ownerUid || null,
      legacy: true,
      status: snapshotAnalysis.usable && ownerUid ? "active" : "disabled",
      sourceSlotId: null,
      sourceDigimonInstanceId: null,
      sourceCombatRevision: null,
      sourceCombatIdentityId: null,
      snapshotVersion: ARENA_GHOST_SNAPSHOT_VERSION,
      snapshotBattleRulesVersion: ARENA_BATTLE_RULES_VERSION,
      snapshot: snapshotAnalysis.snapshot,
      formRecordMirror: createEmptyCombatRecord(),
      ownDefenseRecord: { wins: 0, losses: 0 },
      pendingMirrorCount: 0,
      legacyRecord: normalizeLegacyRecord(data?.record),
      registeredAt: toDate(data?.createdAt, now),
      updatedAt: now,
      migration: {
        schemaVersion: MIGRATION_SCHEMA_VERSION,
        sourceCollection: "arena_entries",
        sourceDocumentId: id,
        powerProjectionVersion: 1,
      },
    },
  };
}

function aggregateCurrentSeason(entries, currentSeasonId) {
  const aggregates = new Map();
  for (const entry of entries) {
    const data = entry.data || {};
    const ownerUid = normalizeString(data.userId);
    const record = normalizeLegacyRecord(data.record);
    if (!ownerUid || record.seasonId !== currentSeasonId) continue;
    const aggregate = aggregates.get(ownerUid) || {
      ownerUid,
      seasonId: currentSeasonId,
      legacyUnclassifiedWins: 0,
      legacyUnclassifiedLosses: 0,
      sourceEntryCount: 0,
      sourceEntryIds: [],
    };
    aggregate.legacyUnclassifiedWins += record.seasonWins;
    aggregate.legacyUnclassifiedLosses += record.seasonLosses;
    aggregate.sourceEntryCount += 1;
    aggregate.sourceEntryIds.push(entry.id);
    aggregates.set(ownerUid, aggregate);
  }
  return [...aggregates.values()].sort((left, right) => left.ownerUid.localeCompare(right.ownerUid));
}

function buildSeasonRecordPatch(existing = {}, aggregate, now) {
  const attackWins = normalizeInteger(existing.attackWins);
  const attackLosses = normalizeInteger(existing.attackLosses);
  const defenseWins = normalizeInteger(existing.defenseWins);
  const defenseLosses = normalizeInteger(existing.defenseLosses);
  return {
    ...existing,
    schemaVersion: 1,
    seasonId: aggregate.seasonId,
    ownerUid: aggregate.ownerUid,
    attackWins,
    attackLosses,
    defenseWins,
    defenseLosses,
    legacyUnclassifiedWins: aggregate.legacyUnclassifiedWins,
    legacyUnclassifiedLosses: aggregate.legacyUnclassifiedLosses,
    wins: attackWins + defenseWins + aggregate.legacyUnclassifiedWins,
    losses: attackLosses + defenseLosses + aggregate.legacyUnclassifiedLosses,
    legacyMigrationSourceEntryCount: aggregate.sourceEntryCount,
    updatedAt: now,
    ...(!existing.createdAt ? { createdAt: now } : {}),
  };
}

function isLegacyGhostEquivalent(existing = {}, plan) {
  return existing.schemaVersion === ARENA_GHOST_SCHEMA_VERSION &&
    existing.legacy === true &&
    existing.ghostId === plan.ghostId &&
    existing.ownerUid === plan.ownerUid &&
    existing.migration?.sourceDocumentId === plan.ghostId;
}

function legacyGhostNeedsCorrection(existing = {}, plan) {
  return legacyGhostPowerMismatch(existing, plan) ||
    existing.status !== plan.ghost.status ||
    normalizeInteger(existing.migration?.powerProjectionVersion) !== 1;
}

function legacyGhostPowerMismatch(existing = {}, plan) {
  return normalizeInteger(existing.snapshot?.combatPowerAtCapture) !== plan.ghost.snapshot.combatPowerAtCapture;
}

function seasonAggregateMatches(existing = {}, aggregate) {
  return existing.schemaVersion === 1 &&
    existing.seasonId === aggregate.seasonId &&
    existing.ownerUid === aggregate.ownerUid &&
    normalizeInteger(existing.legacyUnclassifiedWins) === aggregate.legacyUnclassifiedWins &&
    normalizeInteger(existing.legacyUnclassifiedLosses) === aggregate.legacyUnclassifiedLosses &&
    normalizeInteger(existing.legacyMigrationSourceEntryCount) === aggregate.sourceEntryCount;
}

async function applyGhostPlan(db, plan, now) {
  if (!plan.canCreate) return { outcome: "error", code: "missing_owner_uid" };
  return db.runTransaction(async (transaction) => {
    const ghostRef = db.doc(`arena_ghosts/${plan.ghostId}`);
    const ownerRef = db.doc(`arena_ghost_owners/${plan.ownerUid}`);
    const [ghostSnapshot, ownerSnapshot] = await transaction.getAll(ghostRef, ownerRef);
    if (ghostSnapshot.exists) {
      const existingGhost = ghostSnapshot.data() || {};
      if (!isLegacyGhostEquivalent(existingGhost, plan)) {
        return { outcome: "error", code: "ghost_id_conflict" };
      }
      const powerChanged = legacyGhostPowerMismatch(existingGhost, plan);
      const correctedGhost = legacyGhostNeedsCorrection(existingGhost, plan);
      if (correctedGhost) {
        transaction.update(ghostRef, {
          status: plan.ghost.status,
          "snapshot.combatPowerAtCapture": plan.ghost.snapshot.combatPowerAtCapture,
          "migration.schemaVersion": MIGRATION_SCHEMA_VERSION,
          "migration.powerProjectionVersion": 1,
          "migration.powerRepairedAt": now,
          updatedAt: now,
        });
      }
      const ids = Array.isArray(ownerSnapshot.data?.()?.ghostIds) ? ownerSnapshot.data().ghostIds : [];
      if (!ids.includes(plan.ghostId)) {
        transaction.set(ownerRef, { schemaVersion: 1, ghostIds: [...ids, plan.ghostId], updatedAt: now });
        return { outcome: "repaired_registry", correctedGhost, powerChanged };
      }
      return { outcome: "skipped", correctedGhost, powerChanged };
    }
    const ids = Array.isArray(ownerSnapshot.data?.()?.ghostIds) ? ownerSnapshot.data().ghostIds : [];
    transaction.create(ghostRef, plan.ghost);
    transaction.set(ownerRef, {
      schemaVersion: 1,
      ghostIds: ids.includes(plan.ghostId) ? ids : [...ids, plan.ghostId],
      updatedAt: now,
    });
    return { outcome: "created" };
  });
}

async function applySeasonAggregate(db, aggregate, now) {
  const ref = db.doc(`arena_season_records/${createSeasonRecordId({ seasonId: aggregate.seasonId, ownerUid: aggregate.ownerUid })}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() || {} : {};
    if (seasonAggregateMatches(existing, aggregate)) return { outcome: "skipped" };
    transaction.set(ref, buildSeasonRecordPatch(existing, aggregate, now));
    return { outcome: "changed" };
  });
}

function summarizeLegacyReferences(logs, entryIds) {
  const fields = ["myEntryId", "defenderEntryId", "attackerEntryId"];
  let referenceCount = 0;
  let resolvableReferenceCount = 0;
  const missingEntryIds = new Set();
  for (const log of logs) {
    for (const field of fields) {
      const id = normalizeString(log.data?.[field]);
      if (!id) continue;
      referenceCount += 1;
      if (entryIds.has(id)) resolvableReferenceCount += 1;
      else missingEntryIds.add(id);
    }
  }
  return { referenceCount, resolvableReferenceCount, missingEntryIds: [...missingEntryIds].sort() };
}

async function runMigration(options, dependencies = {}) {
  const credentialSource = validateExecutionOptions(options);
  if (!dependencies.db && getApps().length === 0) {
    initializeApp({ credential: loadCredential(), projectId: options.projectId });
  }
  const db = dependencies.db || getFirestore();
  const now = dependencies.now || new Date();
  const [entrySnapshot, logSnapshot, configSnapshot, allGhostSnapshot] = await Promise.all([
    db.collection("arena_entries").get(),
    db.collection("arena_battle_logs").get(),
    db.doc("game_settings/arena_config").get(),
    db.collection("arena_ghosts").get(),
  ]);
  const allEntries = entrySnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const selectedEntries = allEntries
    .filter((entry) => !options.resumeAfter || entry.id > options.resumeAfter)
    .slice(0, options.limit);
  const allPlans = allEntries.map((entry) => buildLegacyGhostPlan(entry, now));
  const planById = new Map(allPlans.map((plan) => [plan.ghostId, plan]));
  const plans = selectedEntries.map((entry) => planById.get(entry.id));
  const currentSeasonId = normalizeInteger(configSnapshot.data?.()?.currentSeasonId);
  if (currentSeasonId < 1) throw new Error("game_settings/arena_config.currentSeasonId가 필요합니다.");
  const seasonAggregates = aggregateCurrentSeason(allEntries, currentSeasonId);
  const ghostSnapshots = plans.length
    ? await db.getAll(...plans.map((plan) => db.doc(`arena_ghosts/${plan.ghostId}`)))
    : [];
  const ghostSnapshotById = new Map(ghostSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const ownerUids = [...new Set(plans.map((plan) => plan.ownerUid).filter(Boolean))];
  const ownerSnapshots = ownerUids.length
    ? await db.getAll(...ownerUids.map((ownerUid) => db.doc(`arena_ghost_owners/${ownerUid}`)))
    : [];
  const ownerSnapshotByUid = new Map(ownerSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const seasonSnapshots = seasonAggregates.length
    ? await db.getAll(...seasonAggregates.map((aggregate) => db.doc(
        `arena_season_records/${createSeasonRecordId({ seasonId: aggregate.seasonId, ownerUid: aggregate.ownerUid })}`
      )))
    : [];
  const seasonSnapshotByOwner = new Map(seasonSnapshots.map((snapshot) => [snapshot.data()?.ownerUid, snapshot]));
  const entryIds = new Set(allEntries.map((entry) => entry.id));
  const references = summarizeLegacyReferences(
    logSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} })),
    entryIds
  );
  const report = {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    migration: "arena-legacy-ghosts-and-current-season",
    mode: options.apply ? "apply" : "dry-run",
    projectId: options.projectId,
    credentialSource,
    generatedAt: now.toISOString(),
    currentSeasonId,
    scanned: plans.length,
    created: 0,
    skipped: 0,
    disabled: 0,
    errors: 0,
    repairedOwnerRegistries: 0,
    correctedGhostsPlanned: 0,
    correctedGhostsApplied: 0,
    powerMismatchesPlanned: 0,
    powerMismatchesApplied: 0,
    ghostPowerCorrections: [],
    seasonRecordsChanged: 0,
    seasonRecordsSkipped: 0,
    writesPerformed: 0,
    originalDeletes: 0,
    nextResumeAfter: selectedEntries.at(-1)?.id || null,
    processedEntryIds: selectedEntries.map((entry) => entry.id),
    sourceCounts: { arenaEntries: allEntries.length, battleLogs: logSnapshot.size },
    allGhostCounts: {
      total: allGhostSnapshot.size,
      legacy: allGhostSnapshot.docs.filter((snapshot) => snapshot.data()?.legacy === true).length,
      nativeV2: allGhostSnapshot.docs.filter((snapshot) => snapshot.data()?.legacy !== true).length,
    },
    nativeV2GhostPowers: allGhostSnapshot.docs
      .filter((snapshot) => snapshot.data()?.legacy !== true)
      .map((snapshot) => ({
        gameVersion: snapshot.data()?.snapshot?.gameVersion || null,
        digimonId: snapshot.data()?.snapshot?.digimonId || null,
        combatPowerAtCapture: normalizeInteger(snapshot.data()?.snapshot?.combatPowerAtCapture),
      })),
    targetCountsBefore: {
      matchingGhosts: ghostSnapshots.filter((snapshot) => snapshot.exists).length,
      ownerRegistries: ownerSnapshots.filter((snapshot) => snapshot.exists).length,
      seasonRecords: seasonSnapshots.filter((snapshot) => snapshot.exists).length,
    },
    expectedGhostCountAfterFullMigration: allPlans.filter((plan) => plan.canCreate).length,
    fullMigrationProjection: {
      active: allPlans.filter((plan) => plan.canCreate && plan.status === "active").length,
      disabled: allPlans.filter((plan) => plan.canCreate && plan.status === "disabled").length,
      errors: allPlans.filter((plan) => !plan.canCreate).length,
    },
    overCapacityOwners: [],
    anomalies: [],
    currentSeasonAggregates: seasonAggregates,
    legacyLogReferences: references,
  };
  const ownerCounts = new Map();
  for (const entry of allEntries) {
    const ownerUid = normalizeString(entry.data.userId);
    if (ownerUid) ownerCounts.set(ownerUid, (ownerCounts.get(ownerUid) || 0) + 1);
  }
  report.overCapacityOwners = [...ownerCounts.entries()]
    .filter(([, count]) => count > 3)
    .map(([ownerUid, count]) => ({ ownerUid, count }));
  for (const plan of plans) {
    if (plan.anomalies.length) report.anomalies.push({ ghostId: plan.ghostId, codes: plan.anomalies });
    if (!options.apply) {
      if (!plan.canCreate) {
        report.errors += 1;
        continue;
      }
      const existingGhost = ghostSnapshotById.get(plan.ghostId);
      if (existingGhost?.exists) {
        const existingData = existingGhost.data() || {};
        if (!isLegacyGhostEquivalent(existingData, plan)) {
          report.errors += 1;
          report.anomalies.push({ ghostId: plan.ghostId, codes: ["ghost_id_conflict"] });
          continue;
        }
        if (legacyGhostNeedsCorrection(existingData, plan)) {
          report.correctedGhostsPlanned += 1;
        }
        if (legacyGhostPowerMismatch(existingData, plan)) {
          report.powerMismatchesPlanned += 1;
          report.ghostPowerCorrections.push({
            ghostId: plan.ghostId,
            gameVersion: plan.ghost.snapshot.gameVersion,
            digimonId: plan.ghost.snapshot.digimonId,
            previousPower: normalizeInteger(existingData.snapshot?.combatPowerAtCapture),
            correctedPower: plan.ghost.snapshot.combatPowerAtCapture,
          });
        }
        const ownerIds = ownerSnapshotByUid.get(plan.ownerUid)?.data?.()?.ghostIds;
        if (!Array.isArray(ownerIds) || !ownerIds.includes(plan.ghostId)) report.repairedOwnerRegistries += 1;
        else report.skipped += 1;
      } else if (plan.status === "disabled") report.disabled += 1;
      else report.created += 1;
      continue;
    }
    try {
      const result = await applyGhostPlan(db, plan, now);
      if (result.correctedGhost) {
        report.correctedGhostsApplied += 1;
        report.writesPerformed += 1;
      }
      if (result.powerChanged) report.powerMismatchesApplied += 1;
      if (result.outcome === "created") {
        if (plan.status === "disabled") report.disabled += 1;
        else report.created += 1;
        report.writesPerformed += 2;
      }
      else if (result.outcome === "repaired_registry") { report.repairedOwnerRegistries += 1; report.writesPerformed += 1; }
      else if (result.outcome === "skipped") report.skipped += 1;
      else { report.errors += 1; report.anomalies.push({ ghostId: plan.ghostId, codes: [result.code] }); }
    } catch (error) {
      report.errors += 1;
      report.anomalies.push({ ghostId: plan.ghostId, codes: [String(error.code || error.message)] });
    }
  }
  for (const aggregate of seasonAggregates) {
    if (!options.apply) {
      const existing = seasonSnapshotByOwner.get(aggregate.ownerUid);
      if (existing?.exists && seasonAggregateMatches(existing.data() || {}, aggregate)) {
        report.seasonRecordsSkipped += 1;
      } else report.seasonRecordsChanged += 1;
      continue;
    }
    try {
      const result = await applySeasonAggregate(db, aggregate, now);
      if (result.outcome === "changed") { report.seasonRecordsChanged += 1; report.writesPerformed += 1; }
      else report.seasonRecordsSkipped += 1;
    } catch (error) {
      report.errors += 1;
      report.anomalies.push({ ownerUid: aggregate.ownerUid, codes: [String(error.code || error.message)] });
    }
  }
  report.accountingValid = report.scanned === report.created + report.disabled + report.skipped + report.repairedOwnerRegistries + report.errors;
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("node scripts/migrateArenaGhosts.js --project <id> [--dry-run|--apply --confirm-project <id>] [--limit <n>] [--resume-after <id>] [--report <path>]\n");
    return;
  }
  const report = await runMigration(options);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.reportPath) {
    const reportPath = path.resolve(process.cwd(), options.reportPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serialized, "utf8");
  }
  process.stdout.write(serialized);
  if (report.errors > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  aggregateCurrentSeason,
  analyzeLegacySnapshot,
  applyGhostPlan,
  applySeasonAggregate,
  buildLegacyGhostPlan,
  buildSeasonRecordPatch,
  isLegacyGhostEquivalent,
  legacyGhostNeedsCorrection,
  legacyGhostPowerMismatch,
  parseArgs,
  runMigration,
  seasonAggregateMatches,
  summarizeLegacyReferences,
  validateExecutionOptions,
};
