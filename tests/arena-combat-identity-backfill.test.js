"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAbsentOnlyIdentityPatch,
  parseArgs,
} = require("../scripts/backfillArenaCombatIdentity");

test("identity backfill은 누락 필드만 채운다", () => {
  assert.deepEqual(buildAbsentOnlyIdentityPatch({}, () => "life-a"), {
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "life-a",
    combatRevision: 1,
  });
});

test("identity backfill은 기존 값을 변경하지 않는다", () => {
  const existing = {
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "life-existing",
    combatRevision: 7,
  };
  assert.deepEqual(buildAbsentOnlyIdentityPatch(existing, () => "life-new"), {});
});

test("migration 기본값은 dry-run이고 apply는 명시해야 한다", () => {
  assert.equal(parseArgs(["--project", "demo"]).apply, false);
  assert.equal(parseArgs(["--project", "demo", "--apply"]).apply, true);
});
