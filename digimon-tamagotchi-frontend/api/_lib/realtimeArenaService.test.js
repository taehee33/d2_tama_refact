"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRealtimeBattle, commandRealtimeLobby } = require("./realtimeArenaLobbyService");
const { commandRealtimeRound } = require("./realtimeArenaRoundService");

function createHarness() {
  const store = new Map();
  const writes = [];
  const db = { doc: (path) => ({ path }) };
  const snapshot = (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path), updateTime: null });
  const runTransaction = async (callback) => callback({
    getAll: async (...refs) => refs.map(snapshot),
    get: async (ref) => snapshot(ref),
    create: (ref, data) => { if (store.has(ref.path)) throw new Error("already exists"); store.set(ref.path, data); writes.push({ path: ref.path, type: "create" }); },
    set: (ref, data) => { store.set(ref.path, data); writes.push({ path: ref.path, type: "set" }); },
  });
  const projectSlot = (slotSnapshot, now, options = {}) => {
    const slot = slotSnapshot.data();
    return {
      slot,
      projectedStats: slot.digimonStats,
      digimon: {
        name: slot.name,
        stage: slot.stage,
        attribute: slot.attribute,
        stats: { type: slot.attribute, attackSprite: 2 },
        spriteBasePath: "/sprites",
        sprite: 1,
      },
      power: slot.power,
      powerDetails: { basePower: slot.power },
      projectionAsOf: options.projectionAsOf || now,
    };
  };
  store.set("users/host/slots/slot1", { selectedDigimon: "Agumon", name: "아구몬", stage: "Adult", attribute: "Vaccine", power: 50, version: "Ver.1", digimonStats: {} });
  store.set("users/guest/slots/slot2", { selectedDigimon: "Gabumon", name: "파피몬", stage: "Adult", attribute: "Data", power: 50, version: "Ver.1", digimonStats: {} });
  store.set("users/intruder/slots/slot3", { selectedDigimon: "Agumon", name: "아구몬", stage: "Adult", attribute: "Vaccine", power: 50, version: "Ver.1", digimonStats: {} });
  return { store, writes, deps: { db, runTransaction, projectSlot } };
}

async function startBattle(harness) {
  const created = await createRealtimeBattle({ uid: "host", slotId: "slot1", requestId: "create-1", deps: { ...harness.deps, now: new Date("2026-07-30T00:00:00.000Z") } });
  const battleId = created.battle.battleId;
  await commandRealtimeLobby({ uid: "guest", battleId, command: "join", input: { requestId: "join-1", slotId: "slot2" }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") } });
  await commandRealtimeLobby({ uid: "host", battleId, command: "set-ready", input: { requestId: "ready-host-1", ready: true }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:02.000Z") } });
  const started = await commandRealtimeLobby({ uid: "guest", battleId, command: "set-ready", input: { requestId: "ready-guest-1", ready: true }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:03.000Z") } });
  return { battleId, started };
}

test("양쪽 준비가 모이면 같은 transaction에서 mvp-0 snapshot과 1라운드를 고정한다", async () => {
  const harness = createHarness();
  const { started } = await startBattle(harness);
  assert.equal(started.battle.status, "selecting");
  assert.equal(started.battle.round, 1);
  assert.equal(started.battle.rulesVersion, "mvp-0");
  assert.deepEqual(started.battle.currentHp, { host: 13, guest: 13 });
  assert.equal(started.battle.participants.host.stage, "Adult");
  assert.equal(started.battle.participants.guest.stage, "Adult");
});

test("첫 행동은 secret만 쓰고 두 번째 행동은 public 라운드를 정확히 한 번 판정한다", async () => {
  const harness = createHarness();
  const { battleId, started } = await startBattle(harness);
  harness.writes.length = 0;
  const first = await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "host-action-1", round: 1, expectedStateVersion: started.battle.stateVersion, action: "attack" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:04.000Z") },
  });
  assert.equal(first.status, "accepted");
  assert.deepEqual(harness.writes.map((write) => write.path), [`realtimeArenaBattleSecrets/${battleId}`]);
  harness.writes.length = 0;
  const second = await commandRealtimeRound({
    uid: "guest", battleId, command: "submit-action",
    input: { requestId: "guest-action-1", round: 1, expectedStateVersion: started.battle.stateVersion, action: "special_attack" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:05.000Z") },
  });
  assert.equal(second.status, "resolved");
  assert.equal(second.battle.round, 2);
  assert.equal(second.battle.resolvedRounds.length, 1);
  assert.equal(second.battle.resolvedRounds[0].hostAction, "attack");
  assert.equal(second.battle.resolvedRounds[0].guestAction, "special_attack");
  assert.deepEqual(new Set(harness.writes.map((write) => write.path)), new Set([`realtimeArenaBattles/${battleId}`, `realtimeArenaBattleSecrets/${battleId}`]));
});

test("기한이 지난 restore는 현재 라운드 하나만 timeout 처리하고 새 7초 deadline을 연다", async () => {
  const harness = createHarness();
  const { battleId } = await startBattle(harness);
  const restored = await commandRealtimeRound({
    uid: "host", battleId, command: "restore", input: { requestId: "restore-1" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:10:00.000Z") },
  });
  assert.equal(restored.battle.round, 2);
  assert.equal(restored.battle.resolvedRounds.length, 1);
  assert.deepEqual(restored.battle.resolvedRounds[0].timeoutSides, ["host", "guest"]);
  assert.equal(restored.battle.deadlineAt.toISOString(), "2026-07-30T00:10:07.000Z");
});

test("취소 완료 후 같은 요청을 재시도하면 영수증을 재생한다", async () => {
  const harness = createHarness();
  const created = await createRealtimeBattle({
    uid: "host",
    slotId: "slot1",
    requestId: "create-cancel",
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const input = { requestId: "cancel-1" };
  const cancelled = await commandRealtimeLobby({
    uid: "host",
    battleId: created.battle.battleId,
    command: "cancel",
    input,
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  const replayed = await commandRealtimeLobby({
    uid: "host",
    battleId: created.battle.battleId,
    command: "cancel",
    input,
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:02.000Z") },
  });
  assert.equal(cancelled.battle.status, "cancelled");
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.battle.stateVersion, cancelled.battle.stateVersion);
});

test("게스트 영수증은 UID에 묶여 다른 사용자의 같은 requestId를 재생하지 않는다", async () => {
  const harness = createHarness();
  const created = await createRealtimeBattle({
    uid: "host",
    slotId: "slot1",
    requestId: "create-leave",
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const battleId = created.battle.battleId;
  await commandRealtimeLobby({
    uid: "guest",
    battleId,
    command: "join",
    input: { requestId: "shared-request", slotId: "slot2" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  await commandRealtimeLobby({
    uid: "guest",
    battleId,
    command: "leave",
    input: { requestId: "leave-1" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:02.000Z") },
  });
  const joined = await commandRealtimeLobby({
    uid: "intruder",
    battleId,
    command: "join",
    input: { requestId: "shared-request", slotId: "slot3" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:03.000Z") },
  });
  assert.equal(joined.replayed, false);
  assert.equal(joined.battle.guestUid, "intruder");
});
