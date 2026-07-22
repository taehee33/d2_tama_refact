"use strict";

const { getSupabaseAdmin } = require("./supabaseAdmin");
const { ARENA_BATTLE_ARCHIVE_TABLE } = require("./logArchives");
const { applyRecordDelta, createEmptyCombatRecord } = require("./arenaDomain");
const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore } = require("./arenaTransactions");
const { projectSlotForUrgentCare } = require("./urgentCareProjection");

const MIRROR_MAX_ATTEMPTS = 5;
const ARCHIVE_MAX_ATTEMPTS = 8;
const ARCHIVE_LEASE_MS = 2 * 60 * 1000;
const READY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const READY_CLEANUP_LIMIT = 50;
const DEFAULT_BATCH_SIZE = 20;

function asMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedError(error) {
  return {
    code: String(error?.code || "ARENA_JOB_ERROR").slice(0, 80),
    message: String(error?.message || "작업 처리 실패").slice(0, 300),
  };
}

function nextAttemptDate(now, attempts) {
  return new Date(now.getTime() + Math.min(60, 2 ** Math.max(0, attempts)) * 60 * 1000);
}

async function selectDueJobs({ db, collection, now, limit }) {
  const snapshot = await db.collection(collection)
    .where("status", "==", "pending")
    .where("nextAttemptAt", "<=", now)
    .orderBy("nextAttemptAt", "asc")
    .limit(limit)
    .get();
  return snapshot.docs;
}

function projectFrozenEvidenceV1(job) {
  const result = job.projectionEvidenceAtBattle?.projectionResult;
  if (result && ["linked", "not_linked", "deferred"].includes(result)) return { status: result };
  const input = job.projectionEvidenceAtBattle?.projectionInput;
  if (!input?.slot) return { status: "deferred", code: "SUPPORTED_SCHEMA_REPAIR_PENDING" };
  try {
    const projected = projectSlotForUrgentCare(input.slot, asMillis(job.battleOccurredAt));
    if (projected.status !== "projected" || !projected.stats) {
      return { status: "deferred", code: "PROJECTOR_DEPENDENCY_UNAVAILABLE" };
    }
    const linked =
      projected.stats.isDead !== true &&
      input.slot.digimonInstanceId === input.expectedDigimonInstanceId &&
      input.slot.combatRevision === input.expectedCombatRevision &&
      input.slot.selectedDigimon === input.expectedDigimonId;
    return { status: linked ? "linked" : "not_linked" };
  } catch (error) {
    return { status: "deferred", code: "PROJECTOR_DEPENDENCY_UNAVAILABLE" };
  }
}

const MIRROR_PROJECTOR_REGISTRY = Object.freeze({ 1: projectFrozenEvidenceV1 });

function defaultMirrorProjector(job) {
  const projector = MIRROR_PROJECTOR_REGISTRY[Number(job.projectionVersionAtBattle || 1)];
  if (!projector) return { status: "deferred", code: "SUPPORTED_SCHEMA_REPAIR_PENDING" };
  return projector(job);
}

async function finalizeMirrorJob({ db, jobSnapshot, projectionResult, now, maxAttempts }) {
  const generation = {
    attempts: Number(jobSnapshot.data()?.attempts || 0),
    nextAttemptAt: asMillis(jobSnapshot.data()?.nextAttemptAt),
  };
  return db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(jobSnapshot.ref);
    if (!currentSnapshot.exists) return { status: "missing" };
    const job = currentSnapshot.data() || {};
    if (
      job.status !== "pending" ||
      Number(job.attempts || 0) !== generation.attempts ||
      asMillis(job.nextAttemptAt) !== generation.nextAttemptAt
    ) return { status: "generation_changed" };
    const ghostRef = db.doc(`arena_ghosts/${job.ghostId}`);
    const ghostSnapshot = await transaction.get(ghostRef);
    const terminal = projectionResult.status === "linked" || projectionResult.status === "not_linked";
    const nextAttempts = generation.attempts + 1;
    if (!terminal && nextAttempts < maxAttempts) {
      transaction.update(jobSnapshot.ref, {
        attempts: nextAttempts,
        nextAttemptAt: nextAttemptDate(now, nextAttempts),
        lastAttemptAt: now,
        lastErrorCode: projectionResult.code || "PROJECTOR_DEPENDENCY_UNAVAILABLE",
        lastErrorMessage: "배틀 시점 projection을 아직 확정하지 못했습니다.",
        updatedAt: now,
      });
      return { status: "pending" };
    }
    const finalStatus = projectionResult.status === "linked"
      ? "applied"
      : projectionResult.status === "not_linked" ? "skipped_not_linked" : "skipped_unverifiable";
    if (projectionResult.status === "linked") {
      const recordRef = db.doc(`arena_combat_records/${job.targetCombatIdentityId}`);
      const recordSnapshot = await transaction.get(recordRef);
      if (!recordSnapshot.exists) {
        throw new ArenaError("ARENA_INVARIANT_VIOLATION", "mirror 대상 전투 기록이 없습니다.");
      }
      transaction.update(recordRef, {
        ...applyRecordDelta(recordSnapshot.data() || createEmptyCombatRecord(), job.recordDelta),
        updatedAt: now,
      });
      if (ghostSnapshot.exists) {
        transaction.update(ghostRef, {
          formRecordMirror: applyRecordDelta(ghostSnapshot.data()?.formRecordMirror || createEmptyCombatRecord(), job.recordDelta),
          pendingMirrorCount: Math.max(0, Number(ghostSnapshot.data()?.pendingMirrorCount || 0) - 1),
          updatedAt: now,
        });
      }
    } else if (ghostSnapshot.exists) {
      transaction.update(ghostRef, {
        pendingMirrorCount: Math.max(0, Number(ghostSnapshot.data()?.pendingMirrorCount || 0) - 1),
        updatedAt: now,
      });
    }
    transaction.update(jobSnapshot.ref, {
      status: finalStatus,
      attempts: nextAttempts,
      lastAttemptAt: now,
      lastErrorCode: projectionResult.code || null,
      lastErrorMessage: null,
      updatedAt: now,
    });
    return { status: finalStatus };
  });
}

async function runMirrorJobs({ deps = {}, limit = DEFAULT_BATCH_SIZE } = {}) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  const projector = deps.projector || defaultMirrorProjector;
  const jobs = deps.jobs || await selectDueJobs({ db, collection: "arena_mirror_outbox", now, limit });
  const results = [];
  for (const jobSnapshot of jobs) {
    let projectionResult;
    try {
      projectionResult = await projector(jobSnapshot.data() || {});
    } catch (error) {
      projectionResult = { status: "deferred", ...boundedError(error) };
    }
    results.push(await finalizeMirrorJob({
      db, jobSnapshot, projectionResult, now,
      maxAttempts: deps.maxAttempts || MIRROR_MAX_ATTEMPTS,
    }));
  }
  return { selected: jobs.length, results };
}

async function writeArchiveInsertOnce({ payload, payloadHash, deps = {} }) {
  if (deps.archiveWriter) return deps.archiveWriter({ payload, payloadHash });
  const supabase = deps.supabase || getSupabaseAdmin();
  const battleId = payload.battleId;
  const { data: existing, error: readError } = await supabase
    .from(ARENA_BATTLE_ARCHIVE_TABLE)
    .select("id,payload_hash")
    .eq("id", battleId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    if (existing.payload_hash !== payloadHash) {
      const error = new Error("동일 archiveId에 다른 payload hash가 존재합니다.");
      error.code = "ARENA_ARCHIVE_HASH_CONFLICT";
      throw error;
    }
    return { inserted: false };
  }
  const response = payload.responsePayload?.battle || {};
  const { error } = await supabase.from(ARENA_BATTLE_ARCHIVE_TABLE).insert({
    id: battleId,
    user_uid: payload.attackerUid,
    attacker_uid: payload.attackerUid,
    attacker_digimon_name: response.attacker?.digimonName || null,
    defender_uid: payload.defenderUid,
    defender_digimon_name: response.defenderGhost?.snapshot?.digimonName || null,
    winner_uid: response.result?.attackerWon ? payload.attackerUid : payload.defenderUid,
    summary: `${response.attacker?.digimonName || "공격자"} vs ${response.defenderGhost?.snapshot?.digimonName || "방어자"}`,
    replay_logs: response.replay || [],
    payload,
    payload_hash: payloadHash,
    schema_version: payload.schemaVersion,
    season_id_at_battle: payload.seasonIdAtBattle,
    battle_rules_version: payload.battleRulesVersion,
  });
  if (error) throw error;
  return { inserted: true };
}

async function claimArchiveJob({ db, jobRef, now }) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return null;
    const job = snapshot.data() || {};
    const duePending = job.status === "pending" && asMillis(job.nextAttemptAt) <= now.getTime();
    const expiredLease = job.status === "processing" && asMillis(job.leaseExpiresAt) <= now.getTime();
    if (!duePending && !expiredLease) return null;
    const claimToken = `${Number(job.attempts || 0) + 1}:${now.getTime()}`;
    transaction.update(jobRef, {
      status: "processing",
      attempts: Number(job.attempts || 0) + 1,
      claimToken,
      leaseExpiresAt: new Date(now.getTime() + ARCHIVE_LEASE_MS),
      updatedAt: now,
    });
    return { ...job, attempts: Number(job.attempts || 0) + 1, claimToken };
  });
}

async function finalizeArchiveJob({ db, jobRef, claim, now, error = null, maxAttempts }) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return { status: "missing" };
    const job = snapshot.data() || {};
    if (job.status !== "processing" || job.claimToken !== claim.claimToken) {
      return { status: "claim_changed" };
    }
    if (!error) {
      transaction.update(jobRef, {
        status: "ready", payload: null, leaseExpiresAt: null, claimToken: null,
        readyAt: now, purgeAfter: new Date(now.getTime() + READY_RETENTION_MS),
        lastErrorCode: null, updatedAt: now,
      });
      transaction.update(db.doc(`arena_battle_logs/${job.battleId}`), {
        archiveStatus: "ready", updatedAt: now,
      });
      return { status: "ready" };
    }
    const normalizedError = boundedError(error);
    const exhausted = Number(job.attempts || 0) >= maxAttempts;
    transaction.update(jobRef, {
      status: exhausted ? "failed" : "pending",
      nextAttemptAt: exhausted ? job.nextAttemptAt : nextAttemptDate(now, Number(job.attempts || 0)),
      leaseExpiresAt: null, claimToken: null,
      lastErrorCode: normalizedError.code, lastErrorMessage: normalizedError.message,
      updatedAt: now,
    });
    if (exhausted) transaction.update(db.doc(`arena_battle_logs/${job.battleId}`), { archiveStatus: "failed", updatedAt: now });
    return { status: exhausted ? "failed" : "pending" };
  });
}

async function cleanupReadyArchiveJobs({ db, now, limit = READY_CLEANUP_LIMIT }) {
  const snapshot = await db.collection("arena_archive_outbox")
    .where("purgeAfter", "<=", now)
    .orderBy("purgeAfter", "asc")
    .limit(limit)
    .get();
  const expiredReadyJobs = snapshot.docs.filter((document) => document.data()?.status === "ready");
  if (expiredReadyJobs.length === 0) {
    return { selected: snapshot.docs.length, deleted: 0 };
  }
  const batch = db.batch();
  for (const document of expiredReadyJobs) batch.delete(document.ref);
  await batch.commit();
  return { selected: snapshot.docs.length, deleted: expiredReadyJobs.length };
}

async function runArchiveJobs({ deps = {}, limit = DEFAULT_BATCH_SIZE } = {}) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  let jobs = deps.jobs;
  if (!jobs) {
    const pending = await selectDueJobs({ db, collection: "arena_archive_outbox", now, limit });
    const remaining = Math.max(0, limit - pending.length);
    const expiredDocs = remaining > 0
      ? (await db.collection("arena_archive_outbox")
          .where("status", "==", "processing")
          .where("leaseExpiresAt", "<=", now)
          .orderBy("leaseExpiresAt", "asc").limit(remaining).get()).docs
      : [];
    jobs = [...pending, ...expiredDocs];
  }
  const results = [];
  for (const jobSnapshot of jobs) {
    const claim = await claimArchiveJob({ db, jobRef: jobSnapshot.ref, now });
    if (!claim) continue;
    let error = null;
    try {
      await writeArchiveInsertOnce({ payload: claim.payload, payloadHash: claim.payloadHash, deps });
    } catch (caught) {
      error = caught;
    }
    results.push(await finalizeArchiveJob({
      db, jobRef: jobSnapshot.ref, claim, now, error,
      maxAttempts: deps.maxAttempts || ARCHIVE_MAX_ATTEMPTS,
    }));
  }
  const cleanup = deps.cleanupReadyArchiveJobs
    ? await deps.cleanupReadyArchiveJobs({ db, now, limit: READY_CLEANUP_LIMIT })
    : deps.jobs
      ? { selected: 0, deleted: 0, skipped: true }
      : await cleanupReadyArchiveJobs({ db, now, limit: READY_CLEANUP_LIMIT });
  return { selected: jobs.length, results, cleanup };
}

module.exports = {
  ARCHIVE_LEASE_MS,
  ARCHIVE_MAX_ATTEMPTS,
  MIRROR_MAX_ATTEMPTS,
  MIRROR_PROJECTOR_REGISTRY,
  READY_CLEANUP_LIMIT,
  claimArchiveJob,
  cleanupReadyArchiveJobs,
  finalizeArchiveJob,
  finalizeMirrorJob,
  runArchiveJobs,
  runMirrorJobs,
  projectFrozenEvidenceV1,
  writeArchiveInsertOnce,
};
