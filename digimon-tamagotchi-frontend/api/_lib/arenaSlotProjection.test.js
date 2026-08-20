"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { projectArenaSlot } = require("./arenaSlotProjection");

test("runtime 필드가 없는 디지타마도 projection unavailable이 아니라 starter로 판정한다", () => {
  assert.throws(
    () => projectArenaSlot(
      {
        exists: true,
        data: () => ({
          selectedDigimon: "Digitama",
          version: "Ver.3",
          digimonStats: {},
        }),
        updateTime: new Date("2026-08-20T00:00:00.000Z"),
      },
      new Date("2026-08-20T00:00:00.000Z")
    ),
    (error) => error.code === "ARENA_SLOT_STARTER" && error.status === 422
  );
});

test("저장된 사망 상태는 디지타마보다 먼저 dead로 판정한다", () => {
  assert.throws(
    () => projectArenaSlot(
      {
        exists: true,
        data: () => ({
          selectedDigimon: "Digitama",
          version: "Ver.1",
          digimonStats: { isDead: true },
        }),
        updateTime: new Date("2026-08-20T00:00:00.000Z"),
      },
      new Date("2026-08-20T00:00:00.000Z")
    ),
    (error) => error.code === "ARENA_SLOT_DEAD" && error.status === 422
  );
});
