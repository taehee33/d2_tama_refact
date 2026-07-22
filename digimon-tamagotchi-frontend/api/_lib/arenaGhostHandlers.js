"use strict";

const crypto = require("node:crypto");
const { FieldPath, Timestamp } = require("firebase-admin/firestore");
const { verifyRequestUser } = require("./auth");
const {
  ARENA_BATTLE_RULES_VERSION,
  ARENA_GHOST_SCHEMA_VERSION,
  ARENA_GHOST_SNAPSHOT_VERSION,
  ARENA_IDENTITY_SCHEMA_VERSION,
  assertArenaClientSchemaVersion,
  assertArenaMutationEnabled,
  buildGhostSnapshot,
  createCombatIdentityId,
  createEmptyCombatRecord,
  createRegistrationKey,
  normalizeGhostId,
  normalizeSlotId,
} = require("./arenaDomain");
const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore, runArenaTransaction } = require("./arenaTransactions");
const { allowMethods, handleApiError, parseJsonBody, sendJson } = require("./http");
const { projectSlotForUrgentCare } = require("./urgentCareProjection");
const {
  calculatePower,
  getDigimonEntryByVersion,
  isStarterDigimonId,
} = require("../_generated/gameProjection.cjs");

const ARENA_CONFIG_PATH = "game_settings/arena_config";
const GHOST_LIMIT = 3;
const DEFAULT_OPPONENT_LIMIT = 30;
const MAX_OPPONENT_LIMIT = 50;

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value) {
  return toDate(value)?.toISOString() || null;
}

function resolveProjectionTime(requestReceivedAt, snapshot) {
  const requestMs = requestReceivedAt.getTime();
  const updateMs = toDate(snapshot?.updateTime)?.getTime() || 0;
  return new Date(Math.max(requestMs, updateMs));
}

function projectArenaSlot(slotSnapshot, requestReceivedAt) {
  if (!slotSnapshot?.exists) {
    throw new ArenaError("ARENA_SLOT_NOT_FOUND", "아레나에 사용할 슬롯을 찾을 수 없습니다.");
  }
  const slot = slotSnapshot.data() || {};
  const projectionAsOf = resolveProjectionTime(requestReceivedAt, slotSnapshot);
  const projection = projectSlotForUrgentCare(slot, projectionAsOf.getTime());
  if (projection.status !== "projected" || !projection.stats) {
    throw new ArenaError(
      "ARENA_SLOT_PROJECTION_UNAVAILABLE",
      "현재 디지몬 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      null,
      null,
      { retryable: true }
    );
  }
  if (projection.stats.isDead === true) {
    throw new ArenaError("ARENA_SLOT_DEAD", "사망한 디지몬은 Ghost로 등록할 수 없습니다.");
  }
  if (isStarterDigimonId(slot.selectedDigimon)) {
    throw new ArenaError("ARENA_SLOT_STARTER", "디지타마는 Ghost로 등록할 수 없습니다.");
  }
  if (
    slot.arenaIdentitySchemaVersion !== ARENA_IDENTITY_SCHEMA_VERSION ||
    typeof slot.digimonInstanceId !== "string" ||
    !slot.digimonInstanceId.trim() ||
    !Number.isInteger(slot.combatRevision) ||
    slot.combatRevision < 1
  ) {
    throw new ArenaError(
      "ARENA_COMBAT_IDENTITY_STALE",
      "현재 슬롯의 아레나 identity를 갱신한 뒤 다시 시도해 주세요."
    );
  }
  const digimon = getDigimonEntryByVersion(slot.version || "Ver.1", slot.selectedDigimon);
  if (!digimon) {
    throw new ArenaError(
      "ARENA_COMBAT_IDENTITY_STALE",
      "현재 형태와 지원 데이터가 일치하지 않습니다."
    );
  }
  const powerResult = calculatePower(projection.stats, digimon, true);
  return {
    slot,
    projectedStats: projection.stats,
    digimon,
    power: Number(powerResult?.power || 0),
    powerDetails: powerResult?.details || {},
    projectionAsOf,
  };
}

function getClientSchemaVersion(req) {
  return req.headers?.["x-arena-client-schema-version"] ||
    req.headers?.["X-Arena-Client-Schema-Version"] ||
    null;
}

function assertOnlyKeys(input, allowedKeys) {
  const unknownKeys = Object.keys(input || {}).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "허용되지 않은 요청 필드가 있습니다.", {
      fields: unknownKeys,
    });
  }
}

function normalizeGhostHandlerError(error) {
  if (error instanceof ArenaError) return error;
  if (
    error?.status === 401 ||
    error?.code === "auth/id-token-expired" ||
    error?.code === "auth/argument-error"
  ) {
    return new ArenaError("ARENA_AUTH_REQUIRED", "로그인 인증이 필요하거나 만료되었습니다.");
  }
  return error;
}

function normalizeOwnerGhostIds(ownerData = {}) {
  return Array.isArray(ownerData.ghostIds)
    ? ownerData.ghostIds.filter((id) => typeof id === "string" && id.trim())
    : [];
}

function buildCombatRecordDocument({ ownerUid, identity, digimonId, now }) {
  return {
    schemaVersion: 1,
    ownerUid,
    combatIdentityId: identity.combatIdentityId,
    digimonInstanceId: identity.digimonInstanceId,
    combatRevision: identity.combatRevision,
    digimonIdAtRevision: digimonId,
    ...createEmptyCombatRecord(),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCombatRecord(data = {}) {
  return {
    attackWins: Number(data.attackWins || 0),
    attackLosses: Number(data.attackLosses || 0),
    defenseWins: Number(data.defenseWins || 0),
    defenseLosses: Number(data.defenseLosses || 0),
  };
}

function classifyGhostLinkStatus(ghost, sourceSlotSnapshot) {
  if (!ghost?.sourceDigimonInstanceId || !ghost?.sourceCombatRevision) return "legacy";
  if (!sourceSlotSnapshot) return "unknown";
  if (!sourceSlotSnapshot.exists) return "source_missing";
  const source = sourceSlotSnapshot.data() || {};
  if (source.digimonStats?.isDead === true || source.isDead === true) return "dead";
  if (source.digimonInstanceId !== ghost.sourceDigimonInstanceId) return "dead";
  if (source.combatRevision !== ghost.sourceCombatRevision) return "evolved";
  if (source.selectedDigimon !== ghost.snapshot?.digimonId) return "unknown";
  return "linked";
}

function buildOwnerGhostDto(ghost, sourceSlotSnapshot) {
  return {
    ghostId: ghost.ghostId,
    status: ghost.status,
    snapshot: {
      ...ghost.snapshot,
      capturedAt: toIsoString(ghost.snapshot?.capturedAt),
    },
    sourceSlotId: ghost.sourceSlotId || null,
    formRecordMirror: normalizeCombatRecord(ghost.formRecordMirror),
    ownDefenseRecord: {
      wins: Number(ghost.ownDefenseRecord?.wins || 0),
      losses: Number(ghost.ownDefenseRecord?.losses || 0),
    },
    pendingMirrorCount: Number(ghost.pendingMirrorCount || 0),
    legacyRecord: ghost.legacyRecord || null,
    linkStatus: classifyGhostLinkStatus(ghost, sourceSlotSnapshot),
    registeredAt: toIsoString(ghost.registeredAt),
  };
}

function buildOpponentGhostDto(ghost, ownerDisplayName) {
  return {
    ghostId: ghost.ghostId,
    ownerDisplayName,
    status: ghost.status,
    snapshot: {
      gameVersion: ghost.snapshot?.gameVersion || null,
      digimonId: ghost.snapshot?.digimonId || null,
      digimonName: ghost.snapshot?.digimonName || null,
      stage: ghost.snapshot?.stage || null,
      attribute: ghost.snapshot?.attribute || null,
      spriteBasePath: ghost.snapshot?.spriteBasePath || "",
      sprite: ghost.snapshot?.sprite ?? 0,
      attackSprite: ghost.snapshot?.attackSprite ?? 0,
      combatPowerAtCapture: Number(ghost.snapshot?.combatPowerAtCapture || 0),
      ageAtCapture: Number(ghost.snapshot?.ageAtCapture || 0),
      weightAtCapture: Number(ghost.snapshot?.weightAtCapture || 0),
      capturedAt: toIsoString(ghost.snapshot?.capturedAt),
    },
    ownDefenseRecord: {
      wins: Number(ghost.ownDefenseRecord?.wins || 0),
      losses: Number(ghost.ownDefenseRecord?.losses || 0),
    },
    canBattle: ghost.status === "active",
    registeredAt: toIsoString(ghost.registeredAt),
  };
}

async function registerArenaGhost({ uid, slotId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => runArenaTransaction(callback));
  const requestReceivedAt = deps.requestReceivedAt || new Date();
  const ghostId = `ghost_${(deps.randomUUID || crypto.randomUUID)()}`;
  const canonicalSlotId = normalizeSlotId(slotId);

  return transact(async (transaction) => {
    const configRef = db.doc(ARENA_CONFIG_PATH);
    const slotRef = db.doc(`users/${uid}/slots/${canonicalSlotId}`);
    const ownerRef = db.doc(`arena_ghost_owners/${uid}`);
    const [configSnapshot, slotSnapshot, ownerSnapshot] = await transaction.getAll(
      configRef,
      slotRef,
      ownerRef
    );
    const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
    assertArenaMutationEnabled(config);
    const projected = (deps.projectSlot || projectArenaSlot)(slotSnapshot, requestReceivedAt);
    const combatIdentityId = createCombatIdentityId({
      ownerUid: uid,
      digimonInstanceId: projected.slot.digimonInstanceId,
      combatRevision: projected.slot.combatRevision,
    });
    const registrationKey = createRegistrationKey({ ownerUid: uid, combatIdentityId });
    const registrationRef = db.doc(`arena_ghost_registrations/${registrationKey}`);
    const recordRef = db.doc(`arena_combat_records/${combatIdentityId}`);
    const [registrationSnapshot, recordSnapshot] = await transaction.getAll(
      registrationRef,
      recordRef
    );

    if (registrationSnapshot.exists) {
      throw new ArenaError(
        "ARENA_GHOST_ALREADY_REGISTERED",
        "이 현재 형태는 이미 Ghost로 등록되어 있습니다.",
        { existingGhostId: registrationSnapshot.data()?.ghostId || null }
      );
    }
    const ghostIds = normalizeOwnerGhostIds(ownerSnapshot.exists ? ownerSnapshot.data() : {});
    if (ghostIds.length >= GHOST_LIMIT) {
      throw new ArenaError(
        "ARENA_GHOST_LIMIT_REACHED",
        "등록할 수 있는 Ghost는 최대 3마리입니다.",
        { limit: GHOST_LIMIT }
      );
    }
    const existingRecord = recordSnapshot.exists
      ? recordSnapshot.data() || {}
      : buildCombatRecordDocument({
          ownerUid: uid,
          identity: {
            combatIdentityId,
            digimonInstanceId: projected.slot.digimonInstanceId,
            combatRevision: projected.slot.combatRevision,
          },
          digimonId: projected.slot.selectedDigimon,
          now: requestReceivedAt,
        });
    if (
      recordSnapshot.exists &&
      existingRecord.digimonIdAtRevision !== projected.slot.selectedDigimon
    ) {
      throw new ArenaError(
        "ARENA_COMBAT_IDENTITY_STALE",
        "현재 형태와 아레나 전적 identity가 일치하지 않습니다."
      );
    }

    const snapshot = buildGhostSnapshot({
      slot: { ...projected.slot, digimonStats: projected.projectedStats },
      digimon: projected.digimon,
      combatPowerAtCapture: projected.power,
      capturedAt: requestReceivedAt,
    });
    const ghost = {
      schemaVersion: ARENA_GHOST_SCHEMA_VERSION,
      ghostId,
      ownerUid: uid,
      status: "active",
      sourceSlotId: canonicalSlotId,
      sourceDigimonInstanceId: projected.slot.digimonInstanceId,
      sourceCombatRevision: projected.slot.combatRevision,
      sourceCombatIdentityId: combatIdentityId,
      snapshotVersion: ARENA_GHOST_SNAPSHOT_VERSION,
      snapshotBattleRulesVersion: ARENA_BATTLE_RULES_VERSION,
      snapshot,
      formRecordMirror: normalizeCombatRecord(existingRecord),
      ownDefenseRecord: { wins: 0, losses: 0 },
      pendingMirrorCount: 0,
      legacyRecord: null,
      registeredAt: requestReceivedAt,
      updatedAt: requestReceivedAt,
    };

    if (!recordSnapshot.exists) transaction.create(recordRef, existingRecord);
    transaction.create(db.doc(`arena_ghosts/${ghostId}`), ghost);
    transaction.set(ownerRef, {
      schemaVersion: 1,
      ghostIds: [...ghostIds, ghostId],
      updatedAt: requestReceivedAt,
    });
    transaction.create(registrationRef, {
      ownerUid: uid,
      combatIdentityId,
      ghostId,
      createdAt: requestReceivedAt,
    });

    return {
      ghost: { ghostId, status: "active" },
      capacity: { used: ghostIds.length + 1, limit: GHOST_LIMIT },
    };
  });
}

async function deleteArenaGhost({ uid, ghostId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => runArenaTransaction(callback));
  const now = deps.now || new Date();
  const canonicalGhostId = normalizeGhostId(ghostId);

  return transact(async (transaction) => {
    const configRef = db.doc(ARENA_CONFIG_PATH);
    const ghostRef = db.doc(`arena_ghosts/${canonicalGhostId}`);
    const ownerRef = db.doc(`arena_ghost_owners/${uid}`);
    const [configSnapshot, ghostSnapshot, ownerSnapshot] = await transaction.getAll(
      configRef,
      ghostRef,
      ownerRef
    );
    assertArenaMutationEnabled(configSnapshot.exists ? configSnapshot.data() || {} : {});
    if (!ghostSnapshot.exists) {
      throw new ArenaError("ARENA_GHOST_NOT_FOUND", "삭제할 Ghost를 찾을 수 없습니다.");
    }
    const ghost = ghostSnapshot.data() || {};
    if (ghost.ownerUid !== uid) {
      throw new ArenaError("ARENA_GHOST_FORBIDDEN", "자신의 Ghost만 삭제할 수 있습니다.");
    }
    if (Number(ghost.pendingMirrorCount || 0) > 0) {
      throw new ArenaError(
        "ARENA_GHOST_SYNC_PENDING",
        "형태 전적 동기화가 끝난 뒤 Ghost를 삭제할 수 있습니다."
      );
    }
    const registrationRef = ghost.sourceCombatIdentityId
      ? db.doc(
          `arena_ghost_registrations/${createRegistrationKey({
            ownerUid: uid,
            combatIdentityId: ghost.sourceCombatIdentityId,
          })}`
        )
      : null;
    const registrationSnapshot = registrationRef
      ? await transaction.get(registrationRef)
      : null;
    if (
      registrationSnapshot?.exists &&
      registrationSnapshot.data()?.ghostId !== canonicalGhostId
    ) {
      throw new ArenaError(
        "ARENA_INVARIANT_VIOLATION",
        "Ghost registration lock이 다른 문서를 가리킵니다."
      );
    }

    const ghostIds = normalizeOwnerGhostIds(ownerSnapshot.exists ? ownerSnapshot.data() : {});
    const nextGhostIds = ghostIds.filter((id) => id !== canonicalGhostId);
    transaction.delete(ghostRef);
    if (registrationSnapshot?.exists) transaction.delete(registrationRef);
    transaction.set(ownerRef, {
      schemaVersion: 1,
      ghostIds: nextGhostIds,
      updatedAt: now,
    });
    return {
      deletedGhostId: canonicalGhostId,
      capacity: { used: nextGhostIds.length, limit: GHOST_LIMIT },
    };
  });
}

async function listOwnerGhosts({ uid, slotId = null, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const ownerSnapshot = await db.doc(`arena_ghost_owners/${uid}`).get();
  const ghostIds = normalizeOwnerGhostIds(ownerSnapshot.exists ? ownerSnapshot.data() : {});
  const ghostSnapshots = ghostIds.length
    ? await db.getAll(...ghostIds.map((id) => db.doc(`arena_ghosts/${id}`)))
    : [];
  const ghosts = ghostSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.data());
  const sourcePaths = [...new Set(
    ghosts
      .filter((ghost) => ghost.sourceSlotId)
      .map((ghost) => `users/${uid}/slots/${ghost.sourceSlotId}`)
  )];
  let sourceByPath = new Map();
  try {
    const sourceSnapshots = sourcePaths.length
      ? await db.getAll(...sourcePaths.map((sourcePath) => db.doc(sourcePath)))
      : [];
    sourceByPath = new Map(sourceSnapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
  } catch (error) {
    sourceByPath = new Map();
  }

  let currentFormRecord = null;
  let currentCombatIdentityId = null;
  if (slotId) {
    const canonicalSlotId = normalizeSlotId(slotId);
    const slotSnapshot = await db.doc(`users/${uid}/slots/${canonicalSlotId}`).get();
    if (slotSnapshot.exists) {
      const slot = slotSnapshot.data() || {};
      if (
        typeof slot.digimonInstanceId === "string" &&
        Number.isInteger(slot.combatRevision)
      ) {
        currentCombatIdentityId = createCombatIdentityId({
          ownerUid: uid,
          digimonInstanceId: slot.digimonInstanceId,
          combatRevision: slot.combatRevision,
        });
        const recordSnapshot = await db.doc(`arena_combat_records/${currentCombatIdentityId}`).get();
        currentFormRecord = recordSnapshot.exists
          ? normalizeCombatRecord(recordSnapshot.data())
          : createEmptyCombatRecord();
      }
    }
  }

  return {
    ghosts: ghosts.map((ghost) =>
      buildOwnerGhostDto(
        ghost,
        ghost.sourceSlotId
          ? sourceByPath.get(`users/${uid}/slots/${ghost.sourceSlotId}`) || null
          : null
      )
    ),
    capacity: { used: ghostIds.length, limit: GHOST_LIMIT },
    currentCombatIdentityId,
    currentFormRecord,
  };
}

function decodeOpponentCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Number.isFinite(Number(parsed.registeredAtMs)) || typeof parsed.ghostId !== "string") {
      throw new Error("invalid");
    }
    return { registeredAtMs: Number(parsed.registeredAtMs), ghostId: parsed.ghostId };
  } catch (error) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "상대 목록 cursor가 올바르지 않습니다.");
  }
}

function encodeOpponentCursor(ghost) {
  const registeredAtMs = toDate(ghost.registeredAt)?.getTime();
  if (!Number.isFinite(registeredAtMs)) return null;
  return Buffer.from(
    JSON.stringify({ registeredAtMs, ghostId: ghost.ghostId }),
    "utf8"
  ).toString("base64url");
}

async function listOpponentGhosts({ uid, limit = DEFAULT_OPPONENT_LIMIT, cursor = null, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const safeLimit = Math.max(1, Math.min(MAX_OPPONENT_LIMIT, Number(limit) || DEFAULT_OPPONENT_LIMIT));
  const decodedCursor = decodeOpponentCursor(cursor);
  let query = db.collection("arena_ghosts")
    .where("status", "==", "active")
    .orderBy("registeredAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  if (decodedCursor) {
    query = query.startAfter(Timestamp.fromMillis(decodedCursor.registeredAtMs), decodedCursor.ghostId);
  }
  const snapshots = await query.limit(safeLimit * 2).get();
  const rawGhosts = snapshots.docs.map((snapshot) => snapshot.data());
  const opponents = rawGhosts.filter((ghost) => ghost.ownerUid !== uid).slice(0, safeLimit);
  const ownerUids = [...new Set(opponents.map((ghost) => ghost.ownerUid).filter(Boolean))];
  const ownerSnapshots = ownerUids.length
    ? await db.getAll(...ownerUids.flatMap((ownerUid) => [
        db.doc(`users/${ownerUid}`),
        db.doc(`users/${ownerUid}/profile/main`),
      ]))
    : [];
  const ownerNames = new Map();
  for (let index = 0; index < ownerUids.length; index += 1) {
    const root = ownerSnapshots[index * 2]?.data?.() || {};
    const profile = ownerSnapshots[index * 2 + 1]?.data?.() || {};
    ownerNames.set(
      ownerUids[index],
      profile.tamerName || root.tamerName || root.displayName || `테이머_${ownerUids[index].slice(0, 6)}`
    );
  }
  const lastRawGhost = rawGhosts[rawGhosts.length - 1] || null;
  return {
    ghosts: opponents.map((ghost) =>
      buildOpponentGhostDto(ghost, ownerNames.get(ghost.ownerUid) || "알 수 없는 테이머")
    ),
    nextCursor: rawGhosts.length >= safeLimit * 2 && lastRawGhost
      ? encodeOpponentCursor(lastRawGhost)
      : null,
  };
}

async function assertRequestSchema(req, db) {
  const configSnapshot = await db.doc(ARENA_CONFIG_PATH).get();
  const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
  assertArenaClientSchemaVersion({
    requestVersion: getClientSchemaVersion(req),
    minimumVersion: Number(config.minArenaClientSchemaVersion || 2),
  });
}

function createArenaGhostCollectionHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function arenaGhostCollectionHandler(req, res) {
    if (!allowMethods(req, res, ["GET", "POST"])) return;
    try {
      const decodedToken = await verifyUser(req);
      const db = deps.db || getArenaFirestore();
      await assertRequestSchema(req, db);
      if (req.method === "GET") {
        const scope = req.query?.scope || "mine";
        if (scope === "mine") {
          sendJson(res, 200, await listOwnerGhosts({
            uid: decodedToken.uid,
            slotId: req.query?.slotId || null,
            deps: { ...deps, db },
          }));
          return;
        }
        if (scope === "opponents") {
          sendJson(res, 200, await listOpponentGhosts({
            uid: decodedToken.uid,
            limit: req.query?.limit,
            cursor: req.query?.cursor || null,
            deps: { ...deps, db },
          }));
          return;
        }
        throw new ArenaError("ARENA_INVALID_REQUEST", "Ghost 조회 scope가 올바르지 않습니다.");
      }

      const input = await parseJsonBody(req);
      assertOnlyKeys(input, ["slotId"]);
      const result = await registerArenaGhost({
        uid: decodedToken.uid,
        slotId: input.slotId,
        deps: { ...deps, db },
      });
      sendJson(res, 201, result);
    } catch (error) {
      handleApiError(res, normalizeGhostHandlerError(error));
    }
  };
}

function createArenaGhostItemHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function arenaGhostItemHandler(req, res) {
    if (!allowMethods(req, res, ["DELETE"])) return;
    try {
      const decodedToken = await verifyUser(req);
      const db = deps.db || getArenaFirestore();
      await assertRequestSchema(req, db);
      const result = await deleteArenaGhost({
        uid: decodedToken.uid,
        ghostId: req.query?.ghostId || req.query?.id,
        deps: { ...deps, db },
      });
      sendJson(res, 200, result);
    } catch (error) {
      handleApiError(res, normalizeGhostHandlerError(error));
    }
  };
}

module.exports = {
  GHOST_LIMIT,
  buildOpponentGhostDto,
  buildOwnerGhostDto,
  classifyGhostLinkStatus,
  createArenaGhostCollectionHandler,
  createArenaGhostItemHandler,
  deleteArenaGhost,
  listOpponentGhosts,
  listOwnerGhosts,
  projectArenaSlot,
  registerArenaGhost,
};
