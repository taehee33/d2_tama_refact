#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function parseArgs(argv) {
  const options = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      options.projectId = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--report") {
      options.reportPath = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
    }
  }

  return options;
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
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function isLegacySnapshotUsable(snapshot = {}) {
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      typeof snapshot.digimonId === "string" &&
      snapshot.digimonId.trim() &&
      typeof snapshot.slotVersion === "string" &&
      snapshot.stats &&
      typeof snapshot.stats === "object"
  );
}

function buildEntryAudit(doc) {
  const data = doc.data() || {};
  const record = data.record || {};
  const snapshot = data.digimonSnapshot || {};
  return {
    id: doc.id,
    ownerUid: typeof data.userId === "string" ? data.userId : null,
    usableSnapshot: isLegacySnapshotUsable(snapshot),
    hasSlotReference: snapshot.slotId !== undefined && snapshot.slotId !== null,
    record: {
      wins: normalizeInteger(record.wins),
      losses: normalizeInteger(record.losses),
      seasonWins: normalizeInteger(record.seasonWins),
      seasonLosses: normalizeInteger(record.seasonLosses),
      seasonId: normalizeInteger(record.seasonId),
    },
  };
}

function summarizeEntries(entries) {
  const perOwner = new Map();
  const seasonTotals = new Map();

  entries.forEach((entry) => {
    const ownerKey = entry.ownerUid || "__missing_owner__";
    perOwner.set(ownerKey, (perOwner.get(ownerKey) || 0) + 1);

    const seasonKey = String(entry.record.seasonId || 0);
    const season = seasonTotals.get(seasonKey) || { wins: 0, losses: 0, entryCount: 0 };
    season.wins += entry.record.seasonWins;
    season.losses += entry.record.seasonLosses;
    season.entryCount += 1;
    seasonTotals.set(seasonKey, season);
  });

  const ownerCounts = [...perOwner.values()];
  return {
    count: entries.length,
    ownerCount: perOwner.size,
    maxPerOwner: ownerCounts.length ? Math.max(...ownerCounts) : 0,
    overCapacityOwnerCount: ownerCounts.filter((count) => count > 3).length,
    missingOwnerCount: entries.filter((entry) => !entry.ownerUid).length,
    unusableSnapshotCount: entries.filter((entry) => !entry.usableSnapshot).length,
    missingSlotReferenceCount: entries.filter((entry) => !entry.hasSlotReference).length,
    seasonTotals: Object.fromEntries([...seasonTotals.entries()].sort(([a], [b]) => Number(a) - Number(b))),
  };
}

function summarizeLogs(logDocs, entryIds) {
  let referencedLogCount = 0;
  let missingReferenceCount = 0;
  const referencedFields = ["myEntryId", "defenderEntryId", "attackerEntryId"];

  logDocs.forEach((doc) => {
    const data = doc.data() || {};
    const references = referencedFields
      .map((field) => data[field])
      .filter((value) => typeof value === "string" && value.trim());
    if (references.length > 0) {
      referencedLogCount += 1;
    }
    if (references.some((reference) => !entryIds.has(reference))) {
      missingReferenceCount += 1;
    }
  });

  return {
    count: logDocs.length,
    referencedLogCount,
    referenceRate: logDocs.length ? referencedLogCount / logDocs.length : 0,
    missingReferenceCount,
  };
}

async function runAudit(options) {
  if (!options.projectId) {
    throw new Error("--project 또는 FIREBASE_PROJECT_ID가 필요합니다.");
  }

  if (getApps().length === 0) {
    initializeApp({ credential: loadCredential(), projectId: options.projectId });
  }

  const db = getFirestore();
  const [entrySnapshot, logSnapshot, configSnapshot, slotSnapshot] = await Promise.all([
    db.collection("arena_entries").get(),
    db.collection("arena_battle_logs").get(),
    db.doc("game_settings/arena_config").get(),
    db.collectionGroup("slots").get(),
  ]);

  const entries = entrySnapshot.docs.map(buildEntryAudit);
  const entryIds = new Set(entries.map((entry) => entry.id));
  const missingIdentitySlots = slotSnapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return (
      data.arenaIdentitySchemaVersion !== 1 ||
      typeof data.digimonInstanceId !== "string" ||
      !data.digimonInstanceId.trim() ||
      !Number.isInteger(data.combatRevision) ||
      data.combatRevision < 1
    );
  });
  const rawArenaConfig = configSnapshot.exists ? configSnapshot.data() : null;
  const arenaConfig = rawArenaConfig
    ? {
        currentSeasonId: normalizeInteger(rawArenaConfig.currentSeasonId),
        seasonName:
          typeof rawArenaConfig.seasonName === "string" ? rawArenaConfig.seasonName : null,
        seasonDuration:
          typeof rawArenaConfig.seasonDuration === "string"
            ? rawArenaConfig.seasonDuration
            : null,
        lastArchivedSeasonId: normalizeInteger(rawArenaConfig.lastArchivedSeasonId),
      }
    : null;

  return {
    schemaVersion: 1,
    auditType: "arena-ghost-readiness-read-only",
    projectId: options.projectId,
    generatedAt: new Date().toISOString(),
    writesPerformed: 0,
    arenaConfig,
    legacyEntries: summarizeEntries(entries),
    battleLogs: summarizeLogs(logSnapshot.docs, entryIds),
    slots: {
      count: slotSnapshot.size,
      missingCombatIdentityCount: missingIdentitySlots.length,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "node scripts/auditArenaGhostReadiness.js --project <id> [--report <path>]\n"
    );
    return;
  }

  const report = await runAudit(options);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.reportPath) {
    const reportPath = path.resolve(process.cwd(), options.reportPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serialized, "utf8");
  }
  process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
