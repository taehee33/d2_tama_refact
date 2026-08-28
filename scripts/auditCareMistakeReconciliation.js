#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const MAX_AUTOMATIC_INCIDENTS = 400;

function parseArgs(argv) {
  const options = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
    uid: null,
    slotIds: [],
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      options.projectId = argv[++index] || null;
    } else if (arg === "--uid") {
      options.uid = argv[++index] || null;
    } else if (arg === "--slots") {
      options.slotIds = String(argv[++index] || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg === "--report") {
      options.reportPath = argv[++index] || null;
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

function toEpochMs(value) {
  if (value == null) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalIdentityPart(value) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._~-]/g, "_");
}

function buildEvolutionStageInstanceId({
  digimonInstanceId,
  evolutionStageStartedAt,
  evolutionStage,
} = {}) {
  if (!digimonInstanceId || evolutionStageStartedAt == null) return null;
  return `stage:${canonicalIdentityPart(digimonInstanceId)}:${canonicalIdentityPart(
    evolutionStage || "unknown"
  )}:${evolutionStageStartedAt}`;
}

function normalizedType(data = {}) {
  return String(data.type || "").trim().toUpperCase();
}

function isCareOccurrence(data = {}) {
  const type = normalizedType(data);
  return type === "CAREMISTAKE" ||
    (type === "CARE_MISTAKE" && String(data.text || "").includes("케어미스"));
}

function isCareResolution(data = {}) {
  const type = normalizedType(data);
  if (type === "CARE_MISTAKE_RESOLVED") return true;
  if (type !== "PLAY_OR_SNACK") return false;
  const text = String(data.text || "");
  return text.includes("성공") || text.includes("해소") || text.includes("Care Mistakes");
}

function hasCurrentIdentity(data, identity) {
  const explicitFields = ["slotInstanceId", "digimonInstanceId", "evolutionStageInstanceId"]
    .filter((field) => typeof data[field] === "string" && data[field].trim());
  return explicitFields.every((field) => data[field] === identity[field]);
}

function selectCurrentStageEvidence(documents, identity, stageStartedAt) {
  const seen = new Set();
  return documents
    .map((document) => ({ id: document.id, ...(document.data() || {}) }))
    .filter((data) => {
      if (!hasCurrentIdentity(data, identity)) return false;
      const timestamp = toEpochMs(data.timestamp ?? data.occurredAt ?? data.resolvedAt);
      return timestamp != null && timestamp >= stageStartedAt;
    })
    .filter((data) => {
      const key = data.eventId || data.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildSlotAudit({ slotId, slotData, logDocs, incidentDocs }) {
  const stats = slotData.digimonStats || {};
  const stageStartedAt = toEpochMs(
    slotData.evolutionStageStartedAt ?? stats.evolutionStageStartedAt ?? stats.stageStartedAt
  );
  const digimonInstanceId = slotData.digimonInstanceId || stats.digimonInstanceId || null;
  const identity = {
    slotInstanceId: slotData.slotInstanceId || stats.slotInstanceId || null,
    digimonInstanceId,
    evolutionStageInstanceId:
      slotData.evolutionStageInstanceId ||
      stats.evolutionStageInstanceId ||
      buildEvolutionStageInstanceId({
        digimonInstanceId,
        evolutionStageStartedAt: stageStartedAt,
        evolutionStage: slotData.evolutionStage || stats.evolutionStage,
      }),
  };
  const identityComplete = Object.values(identity).every(
    (value) => typeof value === "string" && value.trim()
  );
  const currentLogs = stageStartedAt == null
    ? []
    : selectCurrentStageEvidence(logDocs, identity, stageStartedAt);
  const occurrenceLogs = currentLogs.filter(isCareOccurrence);
  const resolutionLogs = currentLogs.filter(isCareResolution);
  const currentIncidents = identityComplete
    ? incidentDocs
      .map((document) => ({ id: document.id, ...(document.data() || {}) }))
      .filter((incident) => hasCurrentIdentity(incident, identity))
    : [];
  const unresolvedIncidentCount = currentIncidents.filter(
    (incident) => incident.status !== "resolved" && incident.resolvedAt == null
  ).length;
  const evidenceProjection = Math.max(0, occurrenceLogs.length - resolutionLogs.length);
  const evidenceCount = Math.max(currentIncidents.length, occurrenceLogs.length);
  const audit = {
    hasCompleteIdentity: identityComplete,
    hasStageStartedAt: stageStartedAt != null,
    withinAutomaticIncidentLimit: evidenceCount <= MAX_AUTOMATIC_INCIDENTS,
  };

  return {
    slotId,
    identity,
    evolutionStageStartedAt: stageStartedAt,
    revision: Number.isInteger(slotData.revision) ? slotData.revision : null,
    storedProjection: {
      rootCareMistakes: slotData.careMistakes ?? null,
      rootUnresolvedCareMistakeCount: slotData.unresolvedCareMistakeCount ?? null,
      nestedCareMistakes: stats.careMistakes ?? null,
      nestedUnresolvedCareMistakeCount: stats.unresolvedCareMistakeCount ?? null,
      reconciliationStatus: slotData.careMistakeReconciliationStatus || null,
      reconciliationVersion: slotData.careMistakeReconciliationVersion ?? null,
    },
    evidence: {
      totalLogCount: logDocs.length,
      currentStageLogCount: currentLogs.length,
      occurrenceCount: occurrenceLogs.length,
      resolutionCount: resolutionLogs.length,
      incidentCount: currentIncidents.length,
      unresolvedIncidentCount,
      projectedFromActivityLogs: evidenceProjection,
      sourceEventIds: occurrenceLogs.map((log) => log.eventId || log.id),
    },
    audit,
    recommendedStatus: Object.values(audit).every(Boolean) ? "verified" : "ambiguous",
  };
}

async function runAudit(options, { db: injectedDb } = {}) {
  if (!options.projectId) throw new Error("--project가 필요합니다.");
  if (!options.uid) throw new Error("--uid가 필요합니다.");
  if (!options.slotIds.length) throw new Error("--slots가 필요합니다.");

  if (!injectedDb && getApps().length === 0) {
    initializeApp({ credential: loadCredential(), projectId: options.projectId });
  }
  const db = injectedDb || getFirestore();
  const slots = [];
  for (const slotId of options.slotIds) {
    const slotRef = db.doc(`users/${options.uid}/slots/${slotId}`);
    const [slotSnapshot, logSnapshot, incidentSnapshot] = await Promise.all([
      slotRef.get(),
      slotRef.collection("logs").get(),
      slotRef.collection("careMistakeIncidents").get(),
    ]);
    if (!slotSnapshot.exists) {
      slots.push({ slotId, exists: false });
      continue;
    }
    slots.push({
      exists: true,
      ...buildSlotAudit({
        slotId,
        slotData: slotSnapshot.data() || {},
        logDocs: logSnapshot.docs,
        incidentDocs: incidentSnapshot.docs,
      }),
    });
  }

  return {
    schemaVersion: 1,
    auditType: "care-mistake-reconciliation-read-only",
    projectId: options.projectId,
    generatedAt: new Date().toISOString(),
    writesPerformed: 0,
    slots,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "node scripts/auditCareMistakeReconciliation.js --project <id> --uid <uid> --slots 4,5 [--report <path>]\n"
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

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildEvolutionStageInstanceId,
  buildSlotAudit,
  isCareOccurrence,
  isCareResolution,
  parseArgs,
  runAudit,
  selectCurrentStageEvidence,
};
