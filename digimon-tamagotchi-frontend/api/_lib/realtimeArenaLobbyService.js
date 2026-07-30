"use strict";

const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore } = require("./arenaTransactions");
const { projectRealtimeArenaSlot } = require("./realtimeArenaSlotProjection");
const {
  DEFAULT_REALTIME_ARENA_RULES_VERSION,
  createRealtimeArenaRulesSnapshot,
} = require("../_generated/gameProjection.cjs");
const {
  REALTIME_ARENA_SCHEMA_VERSION,
  assertParticipant,
  buildParticipantSnapshot,
  createRealtimeBattleId,
  createRequestHash,
  getRole,
  normalizeRequestId,
  normalizeSlotId,
} = require("./realtimeArenaDomain");

const WAITING_LIFETIME_MS = 15 * 60 * 1000;
const ACTIVE_LIFETIME_MS = 24 * 60 * 60 * 1000;

function getRunner(db, deps) {
  return deps.runTransaction || ((callback) => db.runTransaction(callback));
}

function toTimestamp(date) {
  return new Date(date.getTime());
}

async function createRealtimeBattle({ uid, slotId, requestId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  const canonicalSlotId = normalizeSlotId(slotId);
  const canonicalRequestId = normalizeRequestId(requestId);
  const battleId = createRealtimeBattleId({ hostUid: uid, requestId: canonicalRequestId });
  const requestHash = createRequestHash({ command: "create", slotId: canonicalSlotId });
  return getRunner(db, deps)(async (transaction) => {
    const publicRef = db.doc(`realtimeArenaBattles/${battleId}`);
    const secretRef = db.doc(`realtimeArenaBattleSecrets/${battleId}`);
    const slotRef = db.doc(`users/${uid}/slots/${canonicalSlotId}`);
    const [publicSnapshot, secretSnapshot, slotSnapshot] = await transaction.getAll(publicRef, secretRef, slotRef);
    if (publicSnapshot.exists) {
      if (secretSnapshot.data()?.createRequestHash !== requestHash || publicSnapshot.data()?.hostUid !== uid) {
        throw new ArenaError("ARENA_IDEMPOTENCY_CONFLICT", "같은 requestId가 다른 방 생성 요청에 사용되었습니다.");
      }
      return { battle: publicSnapshot.data(), role: "host", replayed: true };
    }
    const validationRules = createRealtimeArenaRulesSnapshot();
    const projected = projectRealtimeArenaSlot(slotSnapshot, now, validationRules, { requireCombatIdentity: false }, deps);
    const hostPreview = buildParticipantSnapshot(projected, validationRules);
    const publicData = {
      schemaVersion: REALTIME_ARENA_SCHEMA_VERSION,
      battleId,
      status: "waiting",
      hostUid: uid,
      guestUid: null,
      listing: {
        hostDigimonName: hostPreview.public.digimonName,
        stage: hostPreview.public.stage,
        version: hostPreview.public.version,
        spriteBasePath: hostPreview.public.spriteBasePath,
        sprite: hostPreview.public.sprite,
      },
      lobby: { host: { ready: false }, guest: null },
      rulesVersion: null,
      rulesSnapshot: null,
      rulesSnapshotHash: null,
      participants: null,
      round: 0,
      maxRounds: 7,
      stateVersion: 1,
      deadlineAt: null,
      currentHp: null,
      timeoutStreaks: { host: 0, guest: 0 },
      resolvedRounds: [],
      result: null,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
      startedAt: null,
      finishedAt: null,
      expiresAt: toTimestamp(new Date(now.getTime() + WAITING_LIFETIME_MS)),
    };
    const secretData = {
      schemaVersion: REALTIME_ARENA_SCHEMA_VERSION,
      battleId,
      secretVersion: 1,
      createRequestId: canonicalRequestId,
      createRequestHash: requestHash,
      participants: { host: { uid, slotId: canonicalSlotId, digimonInstanceId: null, combatRevision: null, powerBreakdown: null, capturedAt: null }, guest: null },
      rulesVersion: null,
      rulesSnapshotHash: null,
      roundSecrets: {},
      latestCommandReceipts: { host: {}, guest: {} },
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
    };
    transaction.create(publicRef, publicData);
    transaction.create(secretRef, secretData);
    return { battle: publicData, role: "host", replayed: false };
  });
}

function assertWaiting(battle) {
  if (battle.status !== "waiting") throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "대기 중인 방에서만 사용할 수 있는 명령입니다.");
}

async function commandRealtimeLobby({ uid, battleId, command, input, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  return getRunner(db, deps)(async (transaction) => {
    const publicRef = db.doc(`realtimeArenaBattles/${battleId}`);
    const secretRef = db.doc(`realtimeArenaBattleSecrets/${battleId}`);
    const [publicSnapshot, secretSnapshot] = await transaction.getAll(publicRef, secretRef);
    if (!publicSnapshot.exists || !secretSnapshot.exists) throw new ArenaError("ARENA_REALTIME_BATTLE_NOT_FOUND", "실시간 배틀 방을 찾을 수 없습니다.");
    const battle = publicSnapshot.data();
    const secret = secretSnapshot.data();
    const nowTimestamp = toTimestamp(now);
    const expiresAtMs = typeof battle.expiresAt?.toMillis === "function"
      ? battle.expiresAt.toMillis()
      : new Date(battle.expiresAt).getTime();
    const currentRole = getRole(battle, uid);
    if (expiresAtMs <= now.getTime()) {
      if (!currentRole) throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "만료된 실시간 배틀 방입니다.");
      const expiredBattle = { ...battle, status: "expired", stateVersion: Number(battle.stateVersion) + 1, deadlineAt: null, updatedAt: nowTimestamp, finishedAt: nowTimestamp };
      transaction.set(publicRef, expiredBattle);
      return { battle: expiredBattle, secret, role: currentRole, status: "resolved", replayed: false };
    }
    let nextBattle = { ...battle };
    let nextSecret = { ...secret };
    let role = getRole(battle, uid);
    const requestId = normalizeRequestId(input.requestId);
    const requestHash = createRequestHash({
      command,
      battleId,
      ...(command === "join" ? { slotId: normalizeSlotId(input.slotId) } : {}),
      ...(command === "set-ready" ? { ready: input.ready } : {}),
    });
    const receiptRole = (role ? [role] : ["host", "guest"]).find((candidateRole) => {
      const receipt = secret.latestCommandReceipts?.[candidateRole]?.[command];
      return receipt?.requestId === requestId && receipt?.uid === uid;
    });
    const previousReceipt = receiptRole
      ? secret.latestCommandReceipts?.[receiptRole]?.[command]
      : null;
    if (previousReceipt?.requestId === requestId) {
      if (previousReceipt.requestHash !== requestHash) throw new ArenaError("ARENA_IDEMPOTENCY_CONFLICT", "같은 requestId가 다른 명령에 사용되었습니다.");
      return { battle, secret, role: receiptRole, replayed: true };
    }
    assertWaiting(battle);

    if (command === "join") {
      if (role === "host") throw new ArenaError("ARENA_REALTIME_FORBIDDEN", "호스트는 자신의 방에 게스트로 참가할 수 없습니다.");
      if (battle.guestUid && battle.guestUid !== uid) throw new ArenaError("ARENA_REALTIME_LOBBY_FULL", "이미 다른 게스트가 참가한 방입니다.");
      const slotId = normalizeSlotId(input.slotId);
      const rulesForValidation = createRealtimeArenaRulesSnapshot();
      const [slotSnapshot, hostSlotSnapshot] = await transaction.getAll(
        db.doc(`users/${uid}/slots/${slotId}`),
        db.doc(`users/${secret.participants.host.uid}/slots/${secret.participants.host.slotId}`)
      );
      const guestProjected = projectRealtimeArenaSlot(slotSnapshot, now, rulesForValidation, { requireCombatIdentity: false }, deps);
      const hostProjected = projectRealtimeArenaSlot(hostSlotSnapshot, now, rulesForValidation, { requireCombatIdentity: false }, deps);
      const guestPreview = buildParticipantSnapshot(guestProjected, rulesForValidation);
      const hostPreview = buildParticipantSnapshot(hostProjected, rulesForValidation);
      if (guestPreview.public.stage !== hostPreview.public.stage) throw new ArenaError("ARENA_REALTIME_STAGE_MISMATCH", "같은 단계의 디지몬 방에만 참가할 수 있습니다.");
      role = "guest";
      nextBattle = { ...battle, guestUid: uid, lobby: { host: { ready: false }, guest: { ready: false } } };
      nextSecret = { ...secret, participants: { ...secret.participants, guest: { uid, slotId, digimonInstanceId: null, combatRevision: null, powerBreakdown: null, capturedAt: null } } };
    } else {
      role = assertParticipant(battle, uid);
      if (command === "leave") {
        if (role !== "guest") throw new ArenaError("ARENA_REALTIME_FORBIDDEN", "게스트만 방에서 나갈 수 있습니다.");
        nextBattle = { ...battle, guestUid: null, lobby: { host: { ready: false }, guest: null } };
        nextSecret = { ...secret, participants: { ...secret.participants, guest: null } };
      } else if (command === "cancel") {
        if (role !== "host") throw new ArenaError("ARENA_REALTIME_FORBIDDEN", "호스트만 방을 취소할 수 있습니다.");
        nextBattle = { ...battle, status: "cancelled", deadlineAt: null, finishedAt: nowTimestamp };
      } else if (command === "set-ready") {
        if (typeof input.ready !== "boolean") throw new ArenaError("ARENA_INVALID_REQUEST", "ready 값이 올바르지 않습니다.");
        if (!battle.guestUid || !battle.lobby.guest) throw new ArenaError("ARENA_REALTIME_STATE_CONFLICT", "게스트가 참가한 뒤 준비할 수 있습니다.");
        nextBattle = { ...battle, lobby: { ...battle.lobby, [role]: { ready: input.ready } } };
        if (nextBattle.lobby.host.ready && nextBattle.lobby.guest.ready) {
          const hostPrivate = secret.participants.host;
          const guestPrivate = secret.participants.guest;
          const projectionAsOf = now;
          const [hostSlot, guestSlot] = await transaction.getAll(
            db.doc(`users/${hostPrivate.uid}/slots/${hostPrivate.slotId}`),
            db.doc(`users/${guestPrivate.uid}/slots/${guestPrivate.slotId}`)
          );
          const rulesVersion = DEFAULT_REALTIME_ARENA_RULES_VERSION;
          const rulesSnapshot = createRealtimeArenaRulesSnapshot(rulesVersion);
          const rulesSnapshotHash = createRequestHash({ rulesVersion, rulesSnapshot });
          const hostProjected = projectRealtimeArenaSlot(hostSlot, now, rulesSnapshot, { projectionAsOf, requireCombatIdentity: false }, deps);
          const guestProjected = projectRealtimeArenaSlot(guestSlot, now, rulesSnapshot, { projectionAsOf, requireCombatIdentity: false }, deps);
          const host = buildParticipantSnapshot(hostProjected, rulesSnapshot);
          const guest = buildParticipantSnapshot(guestProjected, rulesSnapshot);
          if (host.public.stage !== guest.public.stage) throw new ArenaError("ARENA_REALTIME_STAGE_MISMATCH", "같은 단계의 디지몬끼리만 실시간 배틀을 시작할 수 있습니다.");
          nextBattle = {
            ...nextBattle,
            status: "selecting",
            rulesVersion,
            rulesSnapshot,
            rulesSnapshotHash,
            participants: { host: host.public, guest: guest.public },
            round: 1,
            maxRounds: rulesSnapshot.maxRounds,
            deadlineAt: toTimestamp(new Date(now.getTime() + rulesSnapshot.selectionWindowMs)),
            currentHp: { host: host.public.maxHp, guest: guest.public.maxHp },
            timeoutStreaks: { host: 0, guest: 0 },
            startedAt: nowTimestamp,
            expiresAt: toTimestamp(new Date(now.getTime() + ACTIVE_LIFETIME_MS)),
          };
          nextSecret = {
            ...nextSecret,
            rulesVersion,
            rulesSnapshotHash,
            participants: {
              host: { ...hostPrivate, ...host.secret, capturedAt: nowTimestamp },
              guest: { ...guestPrivate, ...guest.secret, capturedAt: nowTimestamp },
            },
            roundSecrets: { "1": { hostSubmission: null, guestSubmission: null, resolved: false, resolvedAt: null, resolutionType: null, resultHash: null } },
          };
        }
      } else {
        throw new ArenaError("ARENA_INVALID_REQUEST", "지원하지 않는 로비 명령입니다.");
      }
    }
    nextBattle = { ...nextBattle, stateVersion: Number(battle.stateVersion) + 1, updatedAt: nowTimestamp };
    nextSecret = {
      ...nextSecret,
      secretVersion: Number(secret.secretVersion) + 1,
      latestCommandReceipts: {
        ...(nextSecret.latestCommandReceipts || {}),
        [role]: {
          ...(nextSecret.latestCommandReceipts?.[role] || {}),
          [command]: { uid, requestId, requestHash, stateVersion: nextBattle.stateVersion },
        },
      },
      updatedAt: nowTimestamp,
    };
    transaction.set(publicRef, nextBattle);
    transaction.set(secretRef, nextSecret);
    return { battle: nextBattle, role, replayed: false };
  });
}

module.exports = { ACTIVE_LIFETIME_MS, WAITING_LIFETIME_MS, commandRealtimeLobby, createRealtimeBattle };
