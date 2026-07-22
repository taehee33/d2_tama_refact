#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const ARENA_IDENTITY_SCHEMA_VERSION = 1;

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    limit: Number.POSITIVE_INFINITY,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
    reportPath: null,
    resumeAfter: null,
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
      index += 1;
    } else if (arg === "--report") {
      options.reportPath = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--resume-after") {
      options.resumeAfter = argv[index + 1] || null;
      index += 1;
    } else if (arg === "--help") options.help = true;
    else throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
  }
  return options;
}

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return cert(
      JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH), "utf8")
      )
    );
  }
  return applicationDefault();
}

function buildAbsentOnlyIdentityPatch(slotData = {}, createInstanceId = crypto.randomUUID) {
  const patch = {};
  if (slotData.arenaIdentitySchemaVersion === undefined) {
    patch.arenaIdentitySchemaVersion = ARENA_IDENTITY_SCHEMA_VERSION;
  }
  if (slotData.digimonInstanceId === undefined) {
    patch.digimonInstanceId = createInstanceId();
  }
  if (slotData.combatRevision === undefined) {
    patch.combatRevision = 1;
  }
  return patch;
}

async function processSlot(db, doc, apply) {
  if (!apply) {
    const patch = buildAbsentOnlyIdentityPatch(doc.data() || {});
    return { changed: Object.keys(patch).length > 0, fields: Object.keys(patch) };
  }

  return db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(doc.ref);
    if (!fresh.exists) return { changed: false, fields: [], missing: true };
    const patch = buildAbsentOnlyIdentityPatch(fresh.data() || {});
    const fields = Object.keys(patch);
    if (fields.length > 0) transaction.update(doc.ref, patch);
    return { changed: fields.length > 0, fields };
  });
}

async function runBackfill(options) {
  if (!options.projectId) throw new Error("--project가 필요합니다.");
  if (getApps().length === 0) {
    initializeApp({ credential: loadCredential(), projectId: options.projectId });
  }
  const db = getFirestore();
  const snapshot = await db.collectionGroup("slots").get();
  const docs = [...snapshot.docs]
    .sort((left, right) => left.ref.path.localeCompare(right.ref.path))
    .filter((doc) => !options.resumeAfter || doc.ref.path > options.resumeAfter)
    .slice(0, options.limit);

  const report = {
    schemaVersion: 1,
    migration: "arena-combat-identity-backfill",
    mode: options.apply ? "apply" : "dry-run",
    projectId: options.projectId,
    generatedAt: new Date().toISOString(),
    scanned: 0,
    changed: 0,
    skipped: 0,
    missingDuringApply: 0,
    errors: 0,
    changedFieldCounts: {
      arenaIdentitySchemaVersion: 0,
      digimonInstanceId: 0,
      combatRevision: 0,
    },
    nextResumeAfter: null,
  };

  for (const doc of docs) {
    report.scanned += 1;
    report.nextResumeAfter = doc.ref.path;
    try {
      const result = await processSlot(db, doc, options.apply);
      if (result.missing) report.missingDuringApply += 1;
      if (result.changed) {
        report.changed += 1;
        result.fields.forEach((field) => {
          report.changedFieldCounts[field] += 1;
        });
      } else report.skipped += 1;
    } catch (error) {
      report.errors += 1;
    }
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "node scripts/backfillArenaCombatIdentity.js --project <id> [--dry-run|--apply] [--limit <n>] [--resume-after <path>] [--report <path>]\n"
    );
    return;
  }
  const report = await runBackfill(options);
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
  buildAbsentOnlyIdentityPatch,
  parseArgs,
  runBackfill,
};
