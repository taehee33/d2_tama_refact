"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildSlotDryRun,
  normalizeSlotDocumentId,
  parseArgs,
  resolveUid,
  runDryRun,
} = require("../scripts/dryRunCareMistakeV2");

function fakeDoc(id, data) {
  return { id, data: () => data };
}

test("dry-run 진입점은 Firestore write API를 import하거나 호출하지 않는다", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/dryRunCareMistakeV2.js"),
    "utf8"
  );
  assert.match(
    source,
    /const \{ getFirestore \} = require\("firebase-admin\/firestore"\)/
  );
  assert.doesNotMatch(
    source,
    /\b(runTransaction|writeBatch|bulkWriter|FieldValue)\b|\.(set|update|create|delete)\s*\(/
  );
});

test("기본 dry-run 대상은 슬롯 4·5이고 숫자 ID를 실제 문서 ID로 정규화한다", () => {
  assert.deepEqual(parseArgs(["--project", "p1", "--uid", "u1"]), {
    projectId: "p1",
    uid: "u1",
    uidFile: null,
    slotIds: ["4", "5"],
    reportPath: null,
    redactIdentifiers: false,
  });
  assert.equal(normalizeSlotDocumentId("4"), "slot4");
  assert.equal(normalizeSlotDocumentId("slot5"), "slot5");
});

test("UID는 파일에서 읽어 명령행 노출 없이 사용할 수 있다", () => {
  const uidPath = path.join(
    process.env.TMPDIR || "/tmp",
    `care-mistake-v2-uid-${process.pid}.txt`
  );
  fs.writeFileSync(uidPath, "private_uid_12345\n", { mode: 0o600 });
  try {
    assert.equal(resolveUid({ uid: null, uidFile: uidPath }), "private_uid_12345");
    assert.throws(
      () => resolveUid({ uid: "private_uid_12345", uidFile: uidPath }),
      /동시에 사용할 수 없습니다/
    );
  } finally {
    fs.unlinkSync(uidPath);
  }
});

test("legacy 로그는 진단만 하고 nested counter를 canonical baseline으로 보고한다", () => {
  const identity = {
    slotInstanceId: "slot-life-4",
    digimonInstanceId: "digimon-life-4",
    evolutionStageInstanceId: "stage-life-4",
  };
  const result = buildSlotDryRun({
    requestedSlotId: "4",
    evidence: {
      exists: true,
      slotDocumentId: "slot4",
      slotData: {
        ...identity,
        evolutionStageStartedAt: 100,
        careMistakes: 0,
        unresolvedCareMistakeCount: 0,
        digimonStats: { careMistakes: 2, unresolvedCareMistakeCount: 2 },
      },
      logDocs: [
        fakeDoc("l1", { ...identity, type: "CAREMISTAKE", timestamp: 200 }),
        fakeDoc("l2", { ...identity, type: "CAREMISTAKE", timestamp: 201 }),
        fakeDoc("l3", { ...identity, type: "CAREMISTAKE", timestamp: 202 }),
      ],
      incidentDocs: [],
      receipts: [],
    },
  });

  assert.equal(result.canonicalBaseline, 2);
  assert.equal(result.classification, "degraded");
  assert.equal(result.v2UnresolvedIncidentCount, 0);
  assert.equal(result.chainStatus, "not_applicable");
  assert.equal(result.repairability, "migration");
});

test("runDryRun은 주입된 read loader만 사용하고 writesPerformed 0을 고정한다", async () => {
  let reads = 0;
  const report = await runDryRun({
    projectId: "p1",
    uid: "u1",
    slotIds: ["4", "5"],
    reportPath: null,
    redactIdentifiers: false,
  }, {
    loadEvidence: async (_db, _uid, slotId) => {
      reads += 1;
      return { exists: false, slotDocumentId: normalizeSlotDocumentId(slotId) };
    },
  });

  assert.equal(reads, 2);
  assert.equal(report.writesPerformed, 0);
  assert.deepEqual(report.slots.map((slot) => slot.slotId), ["slot4", "slot5"]);
});

test("redact 옵션은 UID와 슬롯 identity를 결과에서 제거한다", async () => {
  const report = await runDryRun({
    projectId: "p1",
    uid: "private-uid",
    slotIds: ["4"],
    reportPath: null,
    redactIdentifiers: true,
  }, {
    loadEvidence: async () => ({
      exists: false,
      slotDocumentId: "slot4",
    }),
  });

  assert.equal(report.uid, "[REDACTED]");
  assert.equal(Object.hasOwn(report.slots[0], "identity"), false);
});
