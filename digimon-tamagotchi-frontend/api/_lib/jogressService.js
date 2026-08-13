"use strict";

const crypto = require("node:crypto");
const { getArenaFirestore, runArenaTransaction } = require("./arenaTransactions");
const {
  ACTIVE_JOGRESS_STATUSES,
  JOGRESS_ROOM_LIMIT,
  JOGRESS_ROOM_SCHEMA_VERSION,
  JogressError,
  assertExpectedRevision,
  assertUsableJogressSlot,
  buildEncyclopediaEntry,
  buildEvolutionLog,
  buildHostSnapshot,
  buildJogressEvolutionOutcome,
  buildLocalJogressEvolutionLog,
  buildLocalJogressPartnerDeathLog,
  buildLocalJogressPartnerOutcome,
  classifyRoomLink,
  createJogressRegistrationKey,
  createLocalJogressReceiptId,
  createLocalJogressRequestFingerprint,
  getRoomHostSnapshot,
  normalizeSlotId,
  resolveLocalJogressPair,
  resolveOnlineJogressPair,
} = require("./jogressDomain");

function roomRef(db, roomId) {
  return db.doc(`jogress_rooms/${roomId}`);
}

function ownerRef(db, uid) {
  return db.doc(`jogress_room_owners/${uid}`);
}

function registrationRef(db, key) {
  return db.doc(`jogress_room_registrations/${key}`);
}

function slotRef(db, uid, slotId) {
  return db.doc(`users/${uid}/slots/${normalizeSlotId(slotId)}`);
}

function encyclopediaRef(db, uid, version) {
  return db.doc(`users/${uid}/encyclopedia/${version}`);
}

function jogressLogRef(db, logId) {
  return db.doc(`jogress_logs/${logId}`);
}

function normalizeRoomIds(owner = {}) {
  return [...new Set((Array.isArray(owner.activeRoomIds) ? owner.activeRoomIds : [])
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => id.trim()))].slice(0, 20);
}

function slotNumber(canonicalSlotId) {
  return Number(String(canonicalSlotId).replace(/^slot/i, ""));
}

function roomDto(id, room) {
  const sourceSnapshot = getRoomHostSnapshot(room);
  const hostSnapshot = {
    slotId: sourceSnapshot.slotId,
    digimonId: sourceSnapshot.digimonId,
    version: sourceSnapshot.version,
    name: sourceSnapshot.name,
    nickname: sourceSnapshot.nickname,
    stage: sourceSnapshot.stage,
    sprite: sourceSnapshot.sprite,
    spriteBasePath: sourceSnapshot.spriteBasePath,
    registeredAt: sourceSnapshot.registeredAt,
  };
  return {
    id,
    schemaVersion: Number(room.schemaVersion || 1),
    status: room.status,
    hostUid: room.hostUid,
    hostSlotId: room.hostSlotId ?? hostSnapshot.slotId,
    hostDigimonId: room.hostDigimonId || hostSnapshot.digimonId,
    hostSlotVersion: room.hostSlotVersion || hostSnapshot.version,
    hostTamerName: room.hostTamerName || null,
    hostDigimonNickname: room.hostDigimonNickname || null,
    hostSnapshot,
    snapshotKind: room.snapshotKind || (room.hostSourceIdentityId ? "identity" : "legacyGhost"),
    linkStatus: room.linkStatus || "ghost",
    completionMode: room.completionMode || null,
    hostRevision: Number.isInteger(room.hostRevision) ? room.hostRevision : null,
    guestUid: room.guestUid || null,
    guestSlotId: room.guestSlotId ?? null,
    guestDigimonId: room.guestDigimonId || null,
    guestSlotVersion: room.guestSlotVersion || null,
    guestTamerName: room.guestTamerName || null,
    guestDigimonNickname: room.guestDigimonNickname || null,
    targetId: room.hostTargetId || room.targetId || null,
    hostTargetId: room.hostTargetId || room.targetId || null,
    guestTargetId: room.guestTargetId || null,
    createdAt: room.createdAt || null,
    updatedAt: room.updatedAt || null,
    completedAt: room.completedAt || null,
    consumedAt: room.consumedAt || null,
  };
}

function buildIdentityFields(prefix, identity) {
  return {
    [`${prefix}DigimonInstanceId`]: identity.digimonInstanceId,
    [`${prefix}CombatRevision`]: identity.combatRevision,
    [`${prefix}SourceIdentityId`]: identity.sourceIdentityId,
  };
}

async function createJogressRoom({ uid, displayName, slotId, expectedRevision, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  const randomUUID = deps.randomUUID || crypto.randomUUID;
  const canonicalSlotId = normalizeSlotId(slotId);

  return transact(async (transaction) => {
    const sourceRef = slotRef(db, uid, canonicalSlotId);
    const sourceOwnerRef = ownerRef(db, uid);
    const [sourceSnap, ownerSnap] = await transaction.getAll(sourceRef, sourceOwnerRef);
    const source = assertUsableJogressSlot(uid, sourceSnap);
    assertExpectedRevision(source.slot, expectedRevision);
    if (!(source.entry.evolutions || []).some((evolution) => evolution?.jogress)) {
      throw new JogressError("JOGRESS_PAIR_INVALID", "현재 디지몬은 조그레스 진화가 불가능합니다.", null, 422);
    }

    const existingIds = normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {});
    const existingRefs = existingIds.map((id) => roomRef(db, id));
    const indexedSnaps = existingRefs.length ? await transaction.getAll(...existingRefs) : [];
    const legacyQuerySnap = await transaction.get(db.collection("jogress_rooms").where("hostUid", "==", uid).limit(30));
    const existingSnaps = [...new Map(
      [...indexedSnaps, ...legacyQuerySnap.docs].map((snapshot) => [snapshot.id, snapshot])
    ).values()];
    const currentActiveIds = [];
    let existingCurrentRoom = null;
    for (const snap of existingSnaps) {
      if (!snap.exists) continue;
      const room = snap.data() || {};
      if (!ACTIVE_JOGRESS_STATUSES.has(room.status)) continue;
      currentActiveIds.push(snap.id);
      if (room.hostSourceIdentityId === source.identity.sourceIdentityId) {
        existingCurrentRoom = { id: snap.id, room };
      }
    }

    const registrationKey = createJogressRegistrationKey({
      ownerUid: uid,
      sourceIdentityId: source.identity.sourceIdentityId,
    });
    const regRef = registrationRef(db, registrationKey);
    const regSnap = await transaction.get(regRef);

    if (existingCurrentRoom || regSnap.exists) {
      const existingRoomId = existingCurrentRoom?.id || regSnap.data()?.roomId || null;
      if (!existingCurrentRoom) {
        throw new JogressError(
          "JOGRESS_ALREADY_REGISTERED",
          "현재 형태는 이미 조그레스 방에 등록되어 있습니다.",
          { roomId: existingRoomId },
          409
        );
      }
      const existingRoomData = existingCurrentRoom?.room || {};
      transaction.set(sourceOwnerRef, { schemaVersion: 1, activeRoomIds: currentActiveIds, updatedAt: now });
      return { room: roomDto(existingRoomId, { ...existingRoomData, linkStatus: "live" }), alreadyRegistered: true };
    }
    if (currentActiveIds.length >= JOGRESS_ROOM_LIMIT) {
      throw new JogressError(
        "JOGRESS_ROOM_LIMIT_REACHED",
        "진행 중인 조그레스 등록은 최대 3개입니다.",
        { limit: JOGRESS_ROOM_LIMIT },
        409
      );
    }

    const id = `jogress_${randomUUID()}`;
    const room = {
      schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
      hostUid: uid,
      hostSlotId: slotNumber(canonicalSlotId),
      hostDigimonId: source.slot.selectedDigimon,
      hostSlotVersion: source.version,
      hostTamerName: displayName || null,
      hostDigimonNickname: source.slot.digimonNickname || null,
      hostSnapshot: buildHostSnapshot({
        slot: source.slot,
        slotId: slotNumber(canonicalSlotId),
        version: source.version,
        entry: source.entry,
        identity: source.identity,
        now,
      }),
      snapshotKind: "identity",
      linkStatus: "live",
      completionMode: null,
      ...buildIdentityFields("host", source.identity),
      hostRevision: source.slot.revision,
      registrationKey,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    };
    transaction.create(roomRef(db, id), room);
    transaction.create(regRef, { ownerUid: uid, sourceIdentityId: source.identity.sourceIdentityId, roomId: id, createdAt: now });
    transaction.set(sourceOwnerRef, { schemaVersion: 1, activeRoomIds: [...currentActiveIds, id], updatedAt: now });
    return { room: roomDto(id, room), alreadyRegistered: false };
  });
}

async function completeGhostFallback(db, id, deps = {}) {
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  return transact(async (transaction) => {
    const targetRef = roomRef(db, id);
    const roomSnap = await transaction.get(targetRef);
    if (!roomSnap.exists) return null;
    const room = roomSnap.data() || {};
    if (room.status !== "paired") return room;
    const sourceRef = slotRef(db, room.hostUid, room.hostSlotId);
    const ownerDocumentRef = ownerRef(db, room.hostUid);
    const [sourceSnap, ownerSnap] = await transaction.getAll(sourceRef, ownerDocumentRef);
    const source = sourceSnap.exists ? sourceSnap.data() || {} : null;
    if (classifyRoomLink(room, source) === "live") return room;
    const update = {
      schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
      status: "completed",
      linkStatus: "ghost",
      completionMode: "ghostFallback",
      completedAt: now,
      updatedAt: now,
    };
    transaction.update(targetRef, update);
    if (room.registrationKey) transaction.delete(registrationRef(db, room.registrationKey));
    transaction.set(ownerDocumentRef, {
      schemaVersion: 1,
      activeRoomIds: normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {}).filter((roomId) => roomId !== id),
      updatedAt: now,
    });
    if (sourceSnap.exists && source?.jogressStatus?.roomId === id) {
      transaction.update(sourceRef, { jogressStatus: {}, updatedAt: now });
    }
    return { ...room, ...update };
  });
}

async function listJogressRooms({ uid, scope, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  let snapshots = [];
  if (scope === "mine") {
    const ownerSnap = await ownerRef(db, uid).get();
    const ids = normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {});
    const [indexedSnapshots, legacyQuery] = await Promise.all([
      ids.length ? db.getAll(...ids.map((id) => roomRef(db, id))) : [],
      db.collection("jogress_rooms").where("hostUid", "==", uid).limit(30).get(),
    ]);
    snapshots = [...new Map(
      [...indexedSnapshots, ...legacyQuery.docs].map((snapshot) => [snapshot.id, snapshot])
    ).values()];
  } else if (scope === "waiting") {
    const querySnap = await db.collection("jogress_rooms")
      .where("status", "==", "waiting")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    snapshots = querySnap.docs;
  } else {
    throw new JogressError("JOGRESS_PAIR_INVALID", "방 목록 범위가 올바르지 않습니다.", null, 400);
  }

  const active = snapshots.filter((snap) => snap.exists && ACTIVE_JOGRESS_STATUSES.has(snap.data()?.status));
  const sourceRefs = [...new Map(active.map((snap) => {
    const room = snap.data() || {};
    const ref = slotRef(db, room.hostUid, room.hostSlotId);
    return [ref.path, ref];
  })).values()];
  const sourceSnaps = sourceRefs.length ? await db.getAll(...sourceRefs) : [];
  const sourceByPath = new Map(sourceSnaps.map((snap) => [snap.ref.path, snap]));
  const currentRooms = [];
  for (const snap of active) {
    const room = snap.data() || {};
    const ref = slotRef(db, room.hostUid, room.hostSlotId);
    const sourceSnap = sourceByPath.get(ref.path);
    const source = sourceSnap?.exists ? sourceSnap.data() || {} : null;
    if (scope === "waiting" && room.hostUid === uid) continue;
    let projectedRoom = room;
    let linkStatus = classifyRoomLink(room, source);
    if (room.status === "paired" && linkStatus === "ghost") {
      projectedRoom = await completeGhostFallback(db, snap.id, { ...deps, now });
      if (!ACTIVE_JOGRESS_STATUSES.has(projectedRoom?.status)) {
        continue;
      }
      linkStatus = "ghost";
    }
    if (!projectedRoom) {
      continue;
    }
    currentRooms.push(roomDto(snap.id, {
      ...projectedRoom,
      linkStatus,
    }));
  }
  return {
    rooms: currentRooms,
    capacity: scope === "mine" ? { used: currentRooms.length, limit: JOGRESS_ROOM_LIMIT } : null,
  };
}

function buildLocalJogressDisplayName(slot, resultName) {
  const nickname = typeof slot?.digimonNickname === "string"
    ? slot.digimonNickname.trim()
    : "";
  return nickname ? `${nickname}(${resultName})` : resultName;
}

async function completeLocalJogress({
  uid,
  requestId,
  currentSlotId,
  partnerSlotId,
  expectedCurrentRevision,
  expectedPartnerRevision,
  deps = {},
}) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  const nowMs = now.getTime();
  const canonicalCurrentSlotId = normalizeSlotId(currentSlotId);
  const canonicalPartnerSlotId = normalizeSlotId(partnerSlotId);
  if (canonicalCurrentSlotId === canonicalPartnerSlotId) {
    throw new JogressError(
      "JOGRESS_PAIR_INVALID",
      "현재 슬롯과 파트너 슬롯은 달라야 합니다.",
      null,
      400
    );
  }

  const receiptId = createLocalJogressReceiptId({ uid, requestId });
  const requestFingerprint = createLocalJogressRequestFingerprint({
    uid,
    requestId,
    currentSlotId: canonicalCurrentSlotId,
    partnerSlotId: canonicalPartnerSlotId,
    expectedCurrentRevision,
    expectedPartnerRevision,
  });

  return transact(async (transaction) => {
    const receiptRef = jogressLogRef(db, receiptId);
    const receiptSnapshot = await transaction.get(receiptRef);
    if (receiptSnapshot.exists) {
      const receipt = receiptSnapshot.data() || {};
      if (receipt.requestFingerprint !== requestFingerprint) {
        throw new JogressError(
          "IDEMPOTENCY_KEY_REUSED",
          "같은 requestId가 다른 로컬 조그레스 요청에 사용되었습니다.",
          null,
          409
        );
      }
      if (!receipt.result) {
        throw new JogressError(
          "JOGRESS_STATE_CONFLICT",
          "기존 로컬 조그레스 결과를 복원할 수 없습니다.",
          null,
          409
        );
      }
      return { ...receipt.result, idempotent: true };
    }

    const currentRef = slotRef(db, uid, canonicalCurrentSlotId);
    const partnerRef = slotRef(db, uid, canonicalPartnerSlotId);
    const [currentSnapshot, partnerSnapshot] = await transaction.getAll(
      currentRef,
      partnerRef
    );
    const current = assertUsableJogressSlot(uid, currentSnapshot);
    const partner = assertUsableJogressSlot(uid, partnerSnapshot);
    assertExpectedRevision(current.slot, expectedCurrentRevision);
    assertExpectedRevision(partner.slot, expectedPartnerRevision);
    if (current.identity.sourceIdentityId === partner.identity.sourceIdentityId) {
      throw new JogressError(
        "JOGRESS_STATE_CONFLICT",
        "두 슬롯의 디지몬 Identity가 중복되어 조그레스할 수 없습니다.",
        null,
        409
      );
    }

    const pair = resolveLocalJogressPair({ current, partner });
    const currentOutcome = buildJogressEvolutionOutcome({
      slot: current.slot,
      version: current.version,
      targetId: pair.targetId,
      rawMap: current.dataMap,
      nowMs,
    });
    const partnerOutcome = buildLocalJogressPartnerOutcome({
      slot: partner.slot,
      version: partner.version,
      rawMap: partner.dataMap,
      nowMs,
    });
    const encyclopediaDocumentRef = encyclopediaRef(db, uid, current.version);
    const encyclopediaSnapshot = await transaction.get(encyclopediaDocumentRef);
    const encyclopedia = encyclopediaSnapshot.exists
      ? encyclopediaSnapshot.data() || {}
      : {};
    const resultName = pair.targetEntry?.name || pair.targetId;
    const currentEventId = `jogress:${receiptId}:current`;
    const partnerEventId = `jogress:${receiptId}:partner`;
    const activityLog = buildLocalJogressEvolutionLog({
      eventId: currentEventId,
      requestId,
      sourceId: current.slot.selectedDigimon,
      targetId: pair.targetId,
      resultName,
      nowMs,
      slot: current.slot,
    });
    const partnerActivityLog = buildLocalJogressPartnerDeathLog({
      eventId: partnerEventId,
      requestId,
      partnerId: partner.slot.selectedDigimon,
      nowMs,
      slot: partner.slot,
    });
    const result = {
      requestId,
      slotOutcome: {
        ...currentOutcome,
        resultName,
      },
      partnerOutcome,
      activityLog,
      partnerActivityLog,
    };

    transaction.update(currentRef, {
      selectedDigimon: currentOutcome.selectedDigimon,
      digimonDisplayName: buildLocalJogressDisplayName(current.slot, resultName),
      digimonStats: currentOutcome.digimonStats,
      revision: currentOutcome.revision,
      combatRevision: currentOutcome.combatRevision,
      lastSavedAt: nowMs,
      lastSavedAtServer: now,
      updatedAt: now,
    });
    transaction.update(partnerRef, {
      digimonStats: partnerOutcome.digimonStats,
      revision: partnerOutcome.revision,
      combatRevision: partnerOutcome.combatRevision,
      lastSavedAt: nowMs,
      lastSavedAtServer: now,
      updatedAt: now,
    });
    transaction.create(db.doc(`${currentRef.path}/logs/${currentEventId}`), activityLog);
    transaction.create(db.doc(`${partnerRef.path}/logs/${partnerEventId}`), partnerActivityLog);
    transaction.set(encyclopediaDocumentRef, {
      ...encyclopedia,
      [current.slot.selectedDigimon]: buildEncyclopediaEntry(
        encyclopedia[current.slot.selectedDigimon],
        current.slot.digimonStats,
        "evolution",
        nowMs
      ),
      [pair.targetId]: buildEncyclopediaEntry(
        encyclopedia[pair.targetId],
        currentOutcome.digimonStats,
        "discovery",
        nowMs
      ),
    });
    transaction.create(receiptRef, {
      schemaVersion: 1,
      action: "complete-local",
      requestId,
      requestFingerprint,
      createdByUid: uid,
      currentSlotId: slotNumber(canonicalCurrentSlotId),
      partnerSlotId: slotNumber(canonicalPartnerSlotId),
      revisionBefore: Number(current.slot.revision || 0),
      revisionAfter: currentOutcome.revision,
      partnerRevisionBefore: Number(partner.slot.revision || 0),
      partnerRevisionAfter: partnerOutcome.revision,
      resultId: pair.targetId,
      result,
      createdAt: now,
    });
    return { ...result, idempotent: false };
  });
}

async function joinJogressRoom({ uid, displayName, roomId, guestSlotId, expectedRevision, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  const nowMs = now.getTime();
  const canonicalGuestSlotId = normalizeSlotId(guestSlotId);
  const result = await transact(async (transaction) => {
    const targetRoomRef = roomRef(db, roomId);
    const guestRef = slotRef(db, uid, canonicalGuestSlotId);
    const [roomSnap, guestSnap] = await transaction.getAll(targetRoomRef, guestRef);
    if (!roomSnap.exists) throw new JogressError("JOGRESS_ROOM_NOT_FOUND", "조그레스 방을 찾을 수 없습니다.", null, 404);
    const room = roomSnap.data() || {};
    if (room.hostUid === uid) throw new JogressError("JOGRESS_FORBIDDEN", "자신의 방에는 참가할 수 없습니다.", null, 403);
    if (["paired", "completed"].includes(room.status) && room.guestUid === uid && String(room.guestSlotId) === String(slotNumber(canonicalGuestSlotId))) {
      return { room: roomDto(roomId, room), slotOutcome: room.guestSlotOutcome, idempotent: true };
    }
    if (room.status !== "waiting") throw new JogressError("JOGRESS_STATE_CONFLICT", "이미 참가자가 확정된 방입니다.", null, 409);
    const hostRef = slotRef(db, room.hostUid, room.hostSlotId);
    const ownerDocumentRef = ownerRef(db, room.hostUid);
    const [hostSnap, ownerSnap] = await transaction.getAll(hostRef, ownerDocumentRef);
    const hostSlot = hostSnap.exists ? hostSnap.data() || {} : null;
    const linkStatus = classifyRoomLink(room, hostSlot);
    const guest = assertUsableJogressSlot(uid, guestSnap);
    assertExpectedRevision(guest.slot, expectedRevision);
    const hostSnapshot = getRoomHostSnapshot(room);
    const pair = resolveOnlineJogressPair({
      hostVersion: hostSnapshot.version,
      hostDigimonId: hostSnapshot.digimonId,
      guestVersion: guest.version,
      guestDigimonId: guest.slot.selectedDigimon,
    });
    if (!pair.success) throw new JogressError("JOGRESS_PAIR_INVALID", pair.reason, null, 422);
    const guestOutcome = buildJogressEvolutionOutcome({
      slot: guest.slot,
      version: pair.guestVersion,
      targetId: pair.guestTargetId,
      rawMap: pair.guestMap,
      nowMs,
    });
    const encyclopediaDocumentRef = encyclopediaRef(db, uid, pair.guestVersion);
    const encyclopediaSnap = await transaction.get(encyclopediaDocumentRef);
    const encyclopedia = encyclopediaSnap.exists ? encyclopediaSnap.data() || {} : {};
    const nextEncyclopedia = {
      ...encyclopedia,
      [guest.slot.selectedDigimon]: buildEncyclopediaEntry(encyclopedia[guest.slot.selectedDigimon], guest.slot.digimonStats, "evolution", nowMs),
      [pair.guestTargetId]: buildEncyclopediaEntry(encyclopedia[pair.guestTargetId], guestOutcome.digimonStats, "discovery", nowMs),
    };
    const eventId = `jogress:${roomId}:guest`;
    transaction.update(guestRef, {
      selectedDigimon: guestOutcome.selectedDigimon,
      digimonStats: guestOutcome.digimonStats,
      revision: guestOutcome.revision,
      combatRevision: guestOutcome.combatRevision,
      lastSavedAt: nowMs,
      lastSavedAtServer: now,
      updatedAt: now,
    });
    transaction.set(db.doc(`${guestRef.path}/logs/${eventId}`), buildEvolutionLog({
      eventId,
      sourceId: guest.slot.selectedDigimon,
      targetId: pair.guestTargetId,
      resultName: guestOutcome.resultName,
      nowMs,
    }));
    transaction.set(encyclopediaDocumentRef, nextEncyclopedia);
    const roomUpdate = {
      schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
      status: linkStatus === "live" ? "paired" : "completed",
      linkStatus,
      completionMode: linkStatus === "live" ? null : "ghost",
      guestUid: uid,
      guestSlotId: slotNumber(canonicalGuestSlotId),
      guestDigimonId: guest.slot.selectedDigimon,
      guestSlotVersion: pair.guestVersion,
      guestTamerName: displayName || null,
      guestDigimonNickname: guest.slot.digimonNickname || null,
      ...buildIdentityFields("guest", guest.identity),
      hostTargetId: pair.hostTargetId,
      guestTargetId: pair.guestTargetId,
      targetId: pair.hostTargetId,
      guestSlotOutcome: guestOutcome,
      hostRevision: Number(hostSlot?.revision || room.hostRevision || 0),
      updatedAt: now,
    };
    if (linkStatus === "live") {
      transaction.update(hostRef, {
        jogressStatus: {
          canEvolve: true,
          roomId,
          hostRevision: Number(hostSlot.revision || 0),
          targetId: pair.hostTargetId,
          partnerUserId: uid,
          partnerSlotId: slotNumber(canonicalGuestSlotId),
          guestTamerName: displayName || null,
          guestDigimonId: guest.slot.selectedDigimon,
          guestDigimonName: guest.entry.name || guest.slot.selectedDigimon,
        },
        updatedAt: now,
      });
    } else {
      roomUpdate.completedAt = now;
      roomUpdate.consumedAt = now;
      if (room.registrationKey) transaction.delete(registrationRef(db, room.registrationKey));
      transaction.set(ownerDocumentRef, {
        schemaVersion: 1,
        activeRoomIds: normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {}).filter((id) => id !== roomId),
        updatedAt: now,
      });
    }
    transaction.update(targetRoomRef, roomUpdate);
    return { room: roomDto(roomId, { ...room, ...roomUpdate }), slotOutcome: guestOutcome, idempotent: false };
  });
  return result;
}

async function completeJogressRoom({ uid, roomId, expectedRevision, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  const nowMs = now.getTime();
  const result = await transact(async (transaction) => {
    const targetRoomRef = roomRef(db, roomId);
    const roomSnap = await transaction.get(targetRoomRef);
    if (!roomSnap.exists) throw new JogressError("JOGRESS_ROOM_NOT_FOUND", "조그레스 방을 찾을 수 없습니다.", null, 404);
    const room = roomSnap.data() || {};
    if (room.hostUid !== uid) throw new JogressError("JOGRESS_FORBIDDEN", "호스트만 진화를 완료할 수 있습니다.", null, 403);
    if (room.status === "completed") {
      return {
        room: roomDto(roomId, room),
        slotOutcome: room.hostSlotOutcome || room.guestSlotOutcome || null,
        idempotent: true,
      };
    }
    if (room.status !== "paired") throw new JogressError("JOGRESS_STATE_CONFLICT", "완료할 수 있는 조그레스 방이 아닙니다.", null, 409);
    const hostRef = slotRef(db, uid, room.hostSlotId);
    const ownerDocumentRef = ownerRef(db, uid);
    const encyclopediaDocumentRef = encyclopediaRef(db, uid, room.hostSlotVersion);
    const [hostSnap, ownerSnap, encyclopediaSnap] = await transaction.getAll(hostRef, ownerDocumentRef, encyclopediaDocumentRef);
    const hostSlot = hostSnap.exists ? hostSnap.data() || {} : null;
    if (classifyRoomLink(room, hostSlot) !== "live") {
      const roomUpdate = {
        schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
        status: "completed",
        linkStatus: "ghost",
        completionMode: "ghostFallback",
        completedAt: now,
        updatedAt: now,
      };
      transaction.update(targetRoomRef, roomUpdate);
      if (room.registrationKey) transaction.delete(registrationRef(db, room.registrationKey));
      transaction.set(ownerDocumentRef, {
        schemaVersion: 1,
        activeRoomIds: normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {}).filter((id) => id !== roomId),
        updatedAt: now,
      });
      if (hostSnap.exists && hostSlot?.jogressStatus?.roomId === roomId) {
        transaction.update(hostRef, { jogressStatus: {}, updatedAt: now });
      }
      return {
        room: roomDto(roomId, { ...room, ...roomUpdate }),
        slotOutcome: room.guestSlotOutcome || null,
        idempotent: false,
      };
    }
    const host = assertUsableJogressSlot(uid, hostSnap);
    assertExpectedRevision(host.slot, expectedRevision);
    const hostSnapshot = getRoomHostSnapshot(room);
    const pair = resolveOnlineJogressPair({
      hostVersion: hostSnapshot.version,
      hostDigimonId: hostSnapshot.digimonId,
      guestVersion: room.guestSlotVersion,
      guestDigimonId: room.guestDigimonId,
    });
    if (!pair.success) throw new JogressError("JOGRESS_PAIR_INVALID", pair.reason, null, 422);
    const hostOutcome = buildJogressEvolutionOutcome({ slot: host.slot, version: pair.hostVersion, targetId: pair.hostTargetId, rawMap: pair.hostMap, nowMs });
    const encyclopedia = encyclopediaSnap.exists ? encyclopediaSnap.data() || {} : {};
    transaction.update(hostRef, {
      selectedDigimon: hostOutcome.selectedDigimon,
      digimonStats: hostOutcome.digimonStats,
      jogressStatus: {},
      revision: hostOutcome.revision,
      combatRevision: hostOutcome.combatRevision,
      lastSavedAt: nowMs,
      lastSavedAtServer: now,
      updatedAt: now,
    });
    const eventId = `jogress:${roomId}:host`;
    transaction.set(db.doc(`${hostRef.path}/logs/${eventId}`), buildEvolutionLog({ eventId, sourceId: host.slot.selectedDigimon, targetId: pair.hostTargetId, resultName: hostOutcome.resultName, nowMs }));
    transaction.set(encyclopediaDocumentRef, {
      ...encyclopedia,
      [host.slot.selectedDigimon]: buildEncyclopediaEntry(encyclopedia[host.slot.selectedDigimon], host.slot.digimonStats, "evolution", nowMs),
      [pair.hostTargetId]: buildEncyclopediaEntry(encyclopedia[pair.hostTargetId], hostOutcome.digimonStats, "discovery", nowMs),
    });
    transaction.update(targetRoomRef, {
      schemaVersion: JOGRESS_ROOM_SCHEMA_VERSION,
      status: "completed",
      linkStatus: "live",
      completionMode: "live",
      hostSlotOutcome: hostOutcome,
      completedAt: now,
      updatedAt: now,
    });
    if (room.registrationKey) transaction.delete(registrationRef(db, room.registrationKey));
    transaction.set(ownerDocumentRef, {
      schemaVersion: 1,
      activeRoomIds: normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {}).filter((id) => id !== roomId),
      updatedAt: now,
    });
    return {
      room: roomDto(roomId, {
        ...room,
        status: "completed",
        linkStatus: "live",
        completionMode: "live",
        completedAt: now,
      }),
      slotOutcome: hostOutcome,
      idempotent: false,
    };
  });
  return result;
}

async function cancelJogressRoom({ uid, roomId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || runArenaTransaction;
  const now = deps.now || new Date();
  return transact(async (transaction) => {
    const targetRoomRef = roomRef(db, roomId);
    const ownerDocumentRef = ownerRef(db, uid);
    const [roomSnap, ownerSnap] = await transaction.getAll(targetRoomRef, ownerDocumentRef);
    if (!roomSnap.exists) throw new JogressError("JOGRESS_ROOM_NOT_FOUND", "조그레스 방을 찾을 수 없습니다.", null, 404);
    const room = roomSnap.data() || {};
    if (room.hostUid !== uid) throw new JogressError("JOGRESS_FORBIDDEN", "자신의 방만 취소할 수 있습니다.", null, 403);
    if (room.status === "cancelled") return { cancelledRoomId: roomId, idempotent: true };
    if (room.status !== "waiting") throw new JogressError("JOGRESS_STATE_CONFLICT", "대기 중인 방만 취소할 수 있습니다.", null, 409);
    transaction.update(targetRoomRef, { status: "cancelled", cancelledAt: now, updatedAt: now });
    if (room.registrationKey) transaction.delete(registrationRef(db, room.registrationKey));
    transaction.set(ownerDocumentRef, {
      schemaVersion: 1,
      activeRoomIds: normalizeRoomIds(ownerSnap.exists ? ownerSnap.data() : {}).filter((id) => id !== roomId),
      updatedAt: now,
    });
    return { cancelledRoomId: roomId, idempotent: false };
  });
}

module.exports = {
  cancelJogressRoom,
  completeLocalJogress,
  completeJogressRoom,
  createJogressRoom,
  joinJogressRoom,
  listJogressRooms,
  normalizeRoomIds,
  roomDto,
};
