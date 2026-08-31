#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  CARE_MISTAKE_V2_CLASSIFICATION,
  auditCareMistakeFullChain,
  classifyCareMistakeSlotV2,
  resolveEffectiveCareMistakeIntegrity,
} = require("../digimon-tamagotchi-frontend/api/_generated/gameProjection.cjs");
const { buildSlotAudit } = require("./auditCareMistakeReconciliation");

const READ_LIMIT_WITH_BOUNDARY_SENTINEL = 401;

function parseArgs(argv) {
  const options = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
    uid: null,
    uidFile: null,
    slotIds: ["4", "5"],
    reportPath: null,
    redactIdentifiers: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") options.projectId = argv[++index] || null;
    else if (arg === "--uid") options.uid = argv[++index] || null;
    else if (arg === "--uid-file") options.uidFile = argv[++index] || null;
    else if (arg === "--slots") {
      options.slotIds = String(argv[++index] || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg === "--report") options.reportPath = argv[++index] || null;
    else if (arg === "--redact-identifiers") options.redactIdentifiers = true;
    else if (arg === "--help") options.help = true;
    else throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
  }
  return options;
}

function resolveUid(options) {
  if (options.uid && options.uidFile) {
    throw new Error("--uid와 --uid-file은 동시에 사용할 수 없습니다.");
  }
  const uid = options.uidFile
    ? fs.readFileSync(path.resolve(process.cwd(), options.uidFile), "utf8").trim()
    : String(options.uid || "").trim();
  if (!uid) throw new Error("--uid 또는 --uid-file이 필요합니다.");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new Error("Firebase UID 형식이 올바르지 않습니다.");
  }
  return uid;
}

function normalizeSlotDocumentId(slotId) {
  const normalized = String(slotId || "").trim();
  if (!normalized) throw new Error("slot ID가 비어 있습니다.");
  return /^slot\d+$/.test(normalized) ? normalized : `slot${normalized}`;
}

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const credentialPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return cert(JSON.parse(fs.readFileSync(credentialPath, "utf8")));
  }
  const defaultCredentialPaths = [
    path.join(os.homedir(), ".config/firebase/d2tamarefact-adminsdk.json"),
    path.join(os.homedir(), ".config/firebase/d2tamarefact-service-account.json"),
  ];
  const defaultCredentialPath = defaultCredentialPaths.find((candidate) => fs.existsSync(candidate));
  if (defaultCredentialPath) {
    return cert(JSON.parse(fs.readFileSync(defaultCredentialPath, "utf8")));
  }
  return applicationDefault();
}

function documentsToData(documents = []) {
  return documents.map((document) => ({ id: document.id, ...(document.data() || {}) }));
}

async function loadSlotEvidence(db, uid, requestedSlotId) {
  const slotDocumentId = normalizeSlotDocumentId(requestedSlotId);
  const slotRef = db.doc(`users/${uid}/slots/${slotDocumentId}`);
  const slotSnapshot = await slotRef.get();
  if (!slotSnapshot.exists) return { exists: false, slotDocumentId };

  const slotData = slotSnapshot.data() || {};
  const state = slotData.careMistakeState || null;
  const [logsSnapshot, receiptsSnapshot] = await Promise.all([
    slotRef.collection("logs").limit(READ_LIMIT_WITH_BOUNDARY_SENTINEL).get(),
    slotRef.collection("careMistakeReceipts").get(),
  ]);

  let incidentQuery = slotRef.collection("careMistakeIncidents");
  if (state?.schemaVersion === 2 && state.rootReceiptId && state.evolutionStageInstanceId) {
    incidentQuery = incidentQuery
      .where("careSchemaVersion", "==", 2)
      .where("rootReceiptId", "==", state.rootReceiptId)
      .where("evolutionStageInstanceId", "==", state.evolutionStageInstanceId)
      .where("status", "==", "unresolved")
      .where("resolvedAt", "==", null);
  }
  const incidentSnapshot = await incidentQuery.limit(READ_LIMIT_WITH_BOUNDARY_SENTINEL).get();
  const incidentDocs = [...incidentSnapshot.docs];
  const headId = typeof state?.latestUnresolvedIncidentId === "string"
    ? state.latestUnresolvedIncidentId.trim()
    : "";
  if (headId && !incidentDocs.some((document) => document.id === headId)) {
    const headSnapshot = await slotRef.collection("careMistakeIncidents").doc(headId).get();
    if (headSnapshot.exists) incidentDocs.push(headSnapshot);
  }

  return {
    exists: true,
    slotDocumentId,
    slotData,
    logDocs: logsSnapshot.docs,
    incidentDocs,
    receipts: documentsToData(receiptsSnapshot.docs),
  };
}

function buildSlotDryRun({ requestedSlotId, evidence }) {
  if (!evidence.exists) {
    return { slotId: evidence.slotDocumentId || normalizeSlotDocumentId(requestedSlotId), exists: false };
  }
  const legacyAudit = buildSlotAudit({
    slotId: evidence.slotDocumentId,
    slotData: evidence.slotData,
    logDocs: evidence.logDocs,
    incidentDocs: evidence.incidentDocs,
  });
  const slotData = {
    ...evidence.slotData,
    slotInstanceId: evidence.slotData.slotInstanceId || legacyAudit.identity.slotInstanceId,
    digimonInstanceId: evidence.slotData.digimonInstanceId || legacyAudit.identity.digimonInstanceId,
    evolutionStageInstanceId:
      evidence.slotData.evolutionStageInstanceId || legacyAudit.identity.evolutionStageInstanceId,
  };
  const incidents = documentsToData(evidence.incidentDocs);
  const classification = classifyCareMistakeSlotV2({
    slotData,
    receipts: evidence.receipts,
    legacyEvidence: legacyAudit.evidence,
  });
  const state = slotData.careMistakeState || {};
  const isV2 = state.schemaVersion === 2;
  const effectiveIntegrity = isV2
    ? resolveEffectiveCareMistakeIntegrity({ slotData, receipts: evidence.receipts, incidents })
    : { diagnosticCodes: [] };
  const chain = isV2
    ? auditCareMistakeFullChain({ state, incidents })
    : {
        chainStatus: "not_applicable",
        orderingStatus: "not_applicable",
        repairability: classification.classification === CARE_MISTAKE_V2_CLASSIFICATION.REPAIR_REQUIRED
          ? "manual_repair"
          : "migration",
        diagnosticCodes: [],
        v2UnresolvedIncidentCount: 0,
      };

  return {
    slotId: evidence.slotDocumentId,
    exists: true,
    revision: Number.isInteger(slotData.revision) ? slotData.revision : null,
    identity: legacyAudit.identity,
    canonicalBaseline: classification.canonicalBaseline,
    classification: classification.classification,
    diagnosticCodes: Array.from(new Set([
      ...classification.diagnosticCodes,
      ...(effectiveIntegrity.diagnosticCodes || []),
      ...(chain.diagnosticCodes || []),
    ])).sort(),
    v2UnresolvedIncidentCount: chain.v2UnresolvedIncidentCount,
    storedPostCutoverCount: Number.isInteger(state.postCutoverUnresolvedCount)
      ? state.postCutoverUnresolvedCount
      : null,
    headIncidentId: state.latestUnresolvedIncidentId || null,
    chainStatus: chain.chainStatus,
    orderingStatus: chain.orderingStatus,
    repairability: chain.repairability,
    legacyEvidence: {
      occurrenceCount: legacyAudit.evidence.occurrenceCount,
      resolutionCount: legacyAudit.evidence.resolutionCount,
      unresolvedIncidentCount: legacyAudit.evidence.unresolvedIncidentCount,
    },
  };
}

async function runDryRun(options, { db: injectedDb, loadEvidence = loadSlotEvidence } = {}) {
  if (!options.projectId) throw new Error("--project가 필요합니다.");
  const uid = resolveUid(options);
  if (!options.slotIds?.length) throw new Error("--slots에 하나 이상의 slot이 필요합니다.");
  if (!injectedDb && loadEvidence === loadSlotEvidence && getApps().length === 0) {
    initializeApp({ credential: loadCredential(), projectId: options.projectId });
  }
  const db = injectedDb || (loadEvidence === loadSlotEvidence ? getFirestore() : null);
  const slots = [];
  for (const slotId of options.slotIds) {
    const evidence = await loadEvidence(db, uid, slotId);
    slots.push(buildSlotDryRun({ requestedSlotId: slotId, evidence }));
  }
  const report = {
    schemaVersion: 2,
    auditType: "care-mistake-v2-read-only-dry-run",
    projectId: options.projectId,
    uid,
    generatedAt: new Date().toISOString(),
    writesPerformed: 0,
    slots,
  };
  if (!options.redactIdentifiers) return report;
  return {
    ...report,
    uid: "[REDACTED]",
    slots: report.slots.map(({ identity: _identity, ...slot }) => slot),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "node scripts/dryRunCareMistakeV2.js --project <id> (--uid <uid> | --uid-file <path>) [--slots 4,5] [--redact-identifiers] [--report <path>]\n"
    );
    return;
  }
  const report = await runDryRun(options);
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
  buildSlotDryRun,
  loadSlotEvidence,
  normalizeSlotDocumentId,
  parseArgs,
  resolveUid,
  runDryRun,
};
