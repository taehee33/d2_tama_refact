"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRealtimeBattle, commandRealtimeLobby } = require("./realtimeArenaLobbyService");
const { createRealtimeCpuBattle } = require("./realtimeArenaCpuService");
const { commandRealtimeRound } = require("./realtimeArenaRoundService");
const { createRealtimeBattleId } = require("./realtimeArenaDomain");
const { selectRealtimeArenaCpuAction } = require("../_generated/gameProjection.cjs");

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
  store.set("users/host", { displayName: "호스트 테이머" });
  store.set("users/guest/slots/slot2", { selectedDigimon: "Gabumon", name: "파피몬", stage: "Adult", attribute: "Data", power: 50, version: "Ver.1", digimonStats: {} });
  store.set("users/intruder/slots/slot3", { selectedDigimon: "Agumon", name: "아구몬", stage: "Adult", attribute: "Vaccine", power: 50, version: "Ver.1", digimonStats: {} });
  return { store, writes, deps: { db, runTransaction, projectSlot } };
}

async function startBattle(harness) {
  const created = await createRealtimeBattle({ uid: "host", slotId: "slot1", requestId: "create-1", deps: { ...harness.deps, battleSeed: "pvp-battle-seed", now: new Date("2026-07-30T00:00:00.000Z") } });
  const battleId = created.battle.battleId;
  await commandRealtimeLobby({ uid: "guest", battleId, command: "join", input: { requestId: "join-1", slotId: "slot2" }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") } });
  await commandRealtimeLobby({ uid: "host", battleId, command: "set-ready", input: { requestId: "ready-host-1", ready: true }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:02.000Z") } });
  const started = await commandRealtimeLobby({ uid: "guest", battleId, command: "set-ready", input: { requestId: "ready-guest-1", ready: true }, deps: { ...harness.deps, now: new Date("2026-07-30T00:00:03.000Z") } });
  return { battleId, started };
}

test("양쪽 준비가 모이면 같은 transaction에서 mvp-2 snapshot과 1라운드를 고정한다", async () => {
  const harness = createHarness();
  const { started } = await startBattle(harness);
  assert.equal(started.battle.status, "selecting");
  assert.equal(started.battle.round, 1);
  assert.equal(started.battle.rulesVersion, "mvp-2");
  assert.equal(started.battle.selectionOpensAt.toISOString(), "2026-07-30T00:00:03.000Z");
  assert.deepEqual(started.battle.currentHp, { host: 13, guest: 13 });
  assert.equal(started.battle.participants.host.stage, "Adult");
  assert.equal(started.battle.participants.guest.stage, "Adult");
});

test("서로 다른 성장 단계도 참가하고 배틀을 시작할 수 있다", async () => {
  const harness = createHarness();
  harness.store.set("users/guest/slots/slot2", { selectedDigimon: "WarGreymon", name: "워그레이몬", stage: "Ultimate", attribute: "Vaccine", power: 80, version: "Ver.1", digimonStats: {} });

  const { started } = await startBattle(harness);

  assert.equal(started.battle.participants.host.stage, "Adult");
  assert.equal(started.battle.participants.guest.stage, "Ultimate");
  assert.deepEqual(started.battle.currentHp, { host: 13, guest: 19 });
});

test("방 생성 목록 정보에는 테이머명만 저장하고 디지몬 정보는 저장하지 않는다", async () => {
  const harness = createHarness();
  const created = await createRealtimeBattle({ uid: "host", slotId: "slot1", requestId: "create-blind", deps: harness.deps });

  assert.deepEqual(created.battle.listing, { ownerDisplayName: "호스트 테이머" });
});

test("마감 전에는 마지막 선택만 secret에 저장하고 마감 시 public 라운드를 판정한다", async () => {
  const harness = createHarness();
  const { battleId, started } = await startBattle(harness);
  harness.writes.length = 0;
  const first = await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "host-action-1", round: 1, expectedStateVersion: started.battle.stateVersion, action: "attack", selectionRevision: 1 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:04.000Z") },
  });
  assert.equal(first.status, "accepted");
  assert.deepEqual(harness.writes.map((write) => write.path), [`realtimeArenaBattleSecrets/${battleId}`]);
  harness.writes.length = 0;
  const second = await commandRealtimeRound({
    uid: "guest", battleId, command: "submit-action",
    input: { requestId: "guest-action-1", round: 1, expectedStateVersion: started.battle.stateVersion, action: "special_attack", selectionRevision: 1 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:05.000Z") },
  });
  assert.equal(second.status, "accepted");
  assert.deepEqual(harness.writes.map((write) => write.path), [`realtimeArenaBattleSecrets/${battleId}`]);

  await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "host-action-2", round: 1, expectedStateVersion: started.battle.stateVersion, action: "guard", selectionRevision: 2 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:06.000Z") },
  });
  harness.writes.length = 0;
  const resolved = await commandRealtimeRound({
    uid: "host", battleId, command: "restore", input: { requestId: "restore-deadline" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:11.000Z") },
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.battle.round, 2);
  assert.equal(resolved.battle.resolvedRounds[0].hostAction, "guard");
  assert.equal(resolved.battle.resolvedRounds[0].guestAction, "special_attack");
  assert.equal(resolved.battle.presentationEndsAt.toISOString(), "2026-07-30T00:00:13.200Z");
  assert.equal(resolved.battle.deadlineAt.toISOString(), "2026-07-30T00:00:20.200Z");
  assert.deepEqual(new Set(harness.writes.map((write) => write.path)), new Set([`realtimeArenaBattles/${battleId}`, `realtimeArenaBattleSecrets/${battleId}`]));
});

test("기한이 지난 restore는 양쪽 행동을 자동 선택하고 연출 뒤 새 7초 deadline을 연다", async () => {
  const harness = createHarness();
  const { battleId } = await startBattle(harness);
  const restored = await commandRealtimeRound({
    uid: "host", battleId, command: "restore", input: { requestId: "restore-1" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:10:00.000Z") },
  });
  assert.equal(restored.battle.round, 2);
  assert.equal(restored.battle.resolvedRounds.length, 1);
  assert.deepEqual(restored.battle.resolvedRounds[0].timeoutSides, ["host", "guest"]);
  assert.ok(["attack", "guard", "special_attack"].includes(restored.battle.resolvedRounds[0].hostAction));
  assert.ok(["attack", "guard", "special_attack"].includes(restored.battle.resolvedRounds[0].guestAction));
  assert.deepEqual(restored.battle.resolvedRounds[0].selectionSources, { host: "auto", guest: "auto" });
  assert.equal(restored.battle.deadlineAt.toISOString(), "2026-07-30T00:10:09.200Z");
});

test("늦게 도착한 낮은 selectionRevision은 최신 선택을 덮어쓰지 않는다", async () => {
  const harness = createHarness();
  const { battleId, started } = await startBattle(harness);
  await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "selection-new", round: 1, expectedStateVersion: started.battle.stateVersion, action: "guard", selectionRevision: 2 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:05.000Z") },
  });
  const stale = await commandRealtimeRound({
    uid: "host", battleId, command: "submit-action",
    input: { requestId: "selection-old", round: 1, expectedStateVersion: started.battle.stateVersion, action: "attack", selectionRevision: 1 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:06.000Z") },
  });
  const secret = harness.store.get(`realtimeArenaBattleSecrets/${battleId}`);
  assert.equal(stale.status, "stale");
  assert.equal(secret.roundSecrets["1"].hostSubmission.action, "guard");
  assert.equal(secret.roundSecrets["1"].hostSubmission.selectionRevision, 2);
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

test("CPU 배틀은 대기 없이 상대를 공개하고 즉시 1라운드를 시작한다", async () => {
  const harness = createHarness();
  const created = await createRealtimeCpuBattle({
    uid: "host",
    slotId: "slot1",
    requestId: "create-cpu",
    deps: { ...harness.deps, cpuSeed: "cpu-seed", now: new Date("2026-07-30T00:00:00.000Z") },
  });

  assert.equal(created.battle.mode, "cpu");
  assert.equal(created.battle.status, "selecting");
  assert.equal(created.battle.guestUid, null);
  assert.equal(created.battle.round, 1);
  assert.ok(created.battle.participants.guest.digimonName);
  assert.equal(created.role, "host");
});

test("CPU 생성과 행동 제출 재시도는 같은 상대와 판정 결과를 재생한다", async () => {
  const harness = createHarness();
  const deps = { ...harness.deps, cpuSeed: "cpu-seed", now: new Date("2026-07-30T00:00:00.000Z") };
  const created = await createRealtimeCpuBattle({ uid: "host", slotId: "slot1", requestId: "create-cpu-replay", deps });
  const replayedCreate = await createRealtimeCpuBattle({ uid: "host", slotId: "slot1", requestId: "create-cpu-replay", deps: { ...deps, cpuSeed: "different-seed" } });
  assert.equal(replayedCreate.replayed, true);
  assert.deepEqual(replayedCreate.battle.participants.guest, created.battle.participants.guest);

  const input = { requestId: "cpu-action-1", round: 1, expectedStateVersion: 1, action: "attack", selectionRevision: 1 };
  const accepted = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "submit-action", input,
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  const replayed = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "submit-action", input,
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:02.000Z") },
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(replayed.status, "replayed");
  const resolved = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "restore", input: { requestId: "cpu-resolve" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:08.000Z") },
  });
  assert.ok(["attack", "guard", "special_attack"].includes(resolved.resolvedRound.guestAction));
});

test("CPU 배틀 시간 초과는 사용자 행동을 자동 선택하고 CPU 행동은 정상 제출한다", async () => {
  const harness = createHarness();
  const created = await createRealtimeCpuBattle({
    uid: "host", slotId: "slot1", requestId: "create-cpu-timeout",
    deps: { ...harness.deps, cpuSeed: "cpu-timeout-seed", now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const restored = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "restore", input: { requestId: "restore-cpu" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:08.000Z") },
  });
  assert.ok(["attack", "guard", "special_attack"].includes(restored.resolvedRound.hostAction));
  assert.ok(["attack", "guard", "special_attack"].includes(restored.resolvedRound.guestAction));
  assert.deepEqual(restored.resolvedRound.timeoutSides, ["host"]);
  assert.deepEqual(restored.resolvedRound.selectionSources, { host: "auto", guest: "cpu" });
});

test("CPU 배틀 포기는 CPU 승리로 종료한다", async () => {
  const harness = createHarness();
  const created = await createRealtimeCpuBattle({
    uid: "host", slotId: "slot1", requestId: "create-cpu-forfeit",
    deps: { ...harness.deps, cpuSeed: "cpu-forfeit-seed", now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const forfeited = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "forfeit", input: { requestId: "forfeit-cpu" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  assert.deepEqual(forfeited.battle.result, { outcome: "guest_win", reason: "forfeit" });
});

test("CPU 배틀은 7라운드 판정으로 정상 종료한다", async () => {
  const harness = createHarness();
  const created = await createRealtimeCpuBattle({
    uid: "host", slotId: "slot1", requestId: "create-cpu-max-round",
    deps: { ...harness.deps, cpuSeed: "cpu-max-round-seed", now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const publicPath = `realtimeArenaBattles/${created.battle.battleId}`;
  const secretPath = `realtimeArenaBattleSecrets/${created.battle.battleId}`;
  harness.store.set(publicPath, { ...created.battle, round: 7, deadlineAt: new Date("2026-07-30T00:00:07.000Z") });
  const secret = harness.store.get(secretPath);
  harness.store.set(secretPath, {
    ...secret,
    roundSecrets: { "7": { hostSubmission: null, guestSubmission: null, resolved: false, resolvedAt: null, resolutionType: null, resultHash: null } },
  });

  await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "submit-action",
    input: { requestId: "cpu-max-round-action", round: 7, expectedStateVersion: 1, action: "guard", selectionRevision: 1 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  const resolved = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "restore", input: { requestId: "cpu-max-round-resolve" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:08.000Z") },
  });

  assert.equal(resolved.battle.status, "finished");
  assert.equal(resolved.battle.result.reason, "max_round");
});

test("CPU와 양쪽 HP가 동시에 0이 되면 동시 KO 무승부로 종료한다", async () => {
  const harness = createHarness();
  const requestId = "create-cpu-simultaneous-ko";
  const battleId = createRealtimeBattleId({ hostUid: "host", requestId });
  const cpuSeed = ["sim-seed-a", "sim-seed-b", "sim-seed-c", "sim-seed-d"].find((seed) => (
    selectRealtimeArenaCpuAction({
      seed,
      battleId,
      round: 1,
      currentHp: { host: 1, guest: 1 },
      participants: { host: { maxHp: 13 }, guest: { maxHp: 13 } },
    }) !== "guard"
  ));
  assert.ok(cpuSeed);
  const created = await createRealtimeCpuBattle({
    uid: "host", slotId: "slot1", requestId,
    deps: { ...harness.deps, cpuSeed, now: new Date("2026-07-30T00:00:00.000Z") },
  });
  const publicPath = `realtimeArenaBattles/${created.battle.battleId}`;
  harness.store.set(publicPath, { ...created.battle, currentHp: { host: 1, guest: 1 } });

  await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "submit-action",
    input: { requestId: "cpu-simultaneous-ko-action", round: 1, expectedStateVersion: 1, action: "special_attack", selectionRevision: 1 },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:01.000Z") },
  });
  const resolved = await commandRealtimeRound({
    uid: "host", battleId: created.battle.battleId, command: "restore", input: { requestId: "cpu-simultaneous-ko-resolve" },
    deps: { ...harness.deps, now: new Date("2026-07-30T00:00:08.000Z") },
  });

  assert.deepEqual(resolved.battle.result, { outcome: "draw", reason: "simultaneous_ko" });
});
