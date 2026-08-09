"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MasterDataError } = require("./masterDataDomain");
const { getStoredRevision } = require("./masterDataService");

test("저장 revision은 누락된 경우에만 0으로 bootstrap한다", () => {
  assert.equal(getStoredRevision({}), 0);
  assert.equal(getStoredRevision({ revision: null }), 0);
  assert.equal(getStoredRevision({ revision: 0 }), 0);
  assert.equal(getStoredRevision({ revision: 3 }), 3);
});

test("저장 revision은 숫자 정수가 아니면 손상으로 거부한다", () => {
  for (const invalidRevision of ["", "0", false, 1.5, -1]) {
    assert.throws(
      () => getStoredRevision({ revision: invalidRevision }),
      (error) =>
        error instanceof MasterDataError &&
        error.code === "MASTER_DATA_REVISION_CORRUPT" &&
        error.status === 500
    );
  }
});
