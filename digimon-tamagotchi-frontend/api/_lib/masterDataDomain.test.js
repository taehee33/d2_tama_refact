"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MasterDataError,
  createMasterDataSnapshotId,
  createSaveRequestFingerprint,
  normalizeMasterDataRestoreRequest,
  normalizeMasterDataSaveRequest,
} = require("./masterDataDomain");

function overrides(value = {}) {
  return {
    ver1: value,
    ver2: {},
    ver3: {},
    ver4: {},
    ver5: {},
  };
}

function saveInput(overrideValue = { name: "코로몬 수정" }) {
  return {
    requestId: "request-1",
    expectedRevision: 0,
    actionType: "save_row",
    note: "이름 변경",
    versionLabel: "Ver.1",
    targetDigimonId: "Koromon",
    overrides: overrides({ Koromon: overrideValue }),
  };
}

test("마스터 데이터 fingerprint는 객체 키 순서와 무관하다", () => {
  const first = normalizeMasterDataSaveRequest(saveInput({
    name: "코로몬 수정",
    stats: { basePower: 11, hungerCycle: 3 },
  }));
  const second = normalizeMasterDataSaveRequest(saveInput({
    stats: { hungerCycle: 3, basePower: 11 },
    name: "코로몬 수정",
  }));

  assert.equal(createSaveRequestFingerprint(first), createSaveRequestFingerprint(second));
});

test("snapshot ID는 운영자·action·requestId에 대해 결정적이다", () => {
  const input = {
    operatorUid: "operator-1",
    action: "master-data-save",
    requestId: "request-1",
  };
  const first = createMasterDataSnapshotId(input);

  assert.equal(first, createMasterDataSnapshotId(input));
  assert.notEqual(
    first,
    createMasterDataSnapshotId({ ...input, action: "master-data-restore" })
  );
  assert.match(first, /^master_[A-Za-z0-9_-]{43}$/);
});

test("저장 payload는 unknown 필드와 존재하지 않는 디지몬을 거부한다", () => {
  assert.throws(
    () => normalizeMasterDataSaveRequest(saveInput({ adminOnly: true })),
    (error) =>
      error instanceof MasterDataError &&
      error.code === "MASTER_DATA_FIELD_NOT_ALLOWED"
  );
  assert.throws(
    () =>
      normalizeMasterDataSaveRequest({
        ...saveInput(),
        targetDigimonId: "Unknownmon",
      }),
    (error) =>
      error instanceof MasterDataError &&
      error.code === "MASTER_DATA_DIGIMON_NOT_FOUND"
  );
});

test("복원 요청은 expectedRevision과 snapshotId를 필수로 검증한다", () => {
  assert.deepEqual(
    normalizeMasterDataRestoreRequest({
      requestId: "restore-1",
      expectedRevision: 3,
      snapshotId: "snapshot-1",
      note: "복원",
    }),
    {
      requestId: "restore-1",
      expectedRevision: 3,
      snapshotId: "snapshot-1",
      note: "복원",
    }
  );
  assert.throws(
    () =>
      normalizeMasterDataRestoreRequest({
        requestId: "restore-1",
        snapshotId: "snapshot-1",
      }),
    /expectedRevision/
  );
});

test("expectedRevision은 0 이상의 정수 number만 허용한다", () => {
  for (const invalidRevision of [null, "", "0", false, 1.5, -1]) {
    assert.throws(
      () =>
        normalizeMasterDataSaveRequest({
          ...saveInput(),
          expectedRevision: invalidRevision,
        }),
      (error) =>
        error instanceof MasterDataError &&
        error.code === "MASTER_DATA_INVALID_REQUEST"
    );
  }
});
