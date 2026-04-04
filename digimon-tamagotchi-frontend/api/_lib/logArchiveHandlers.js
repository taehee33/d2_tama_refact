"use strict";

const { randomUUID } = require("crypto");
const { verifyRequestUser } = require("./auth");
const { createCommunityError } = require("./community");
const { getSupabaseAdmin } = require("./supabaseAdmin");
const {
  ARENA_BATTLE_ARCHIVE_TABLE,
  JOGRESS_ARCHIVE_TABLE,
  buildArenaBattleArchiveRecord,
  buildJogressArchiveRecord,
  compactJsonValue,
  mapArenaBattleArchiveRow,
  mapJogressArchiveRow,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeArchiveId,
} = require("./logArchives");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("./http");

const LOG_ARCHIVE_MONITOR_TABLE = "log_archive_monitor_events";
const ARCHIVE_MONITOR_SOURCES = Object.freeze([
  "arena_archive_post",
  "arena_replay_get",
  "jogress_archive_post",
]);
const ARCHIVE_MONITOR_OUTCOMES = Object.freeze([
  "success",
  "bad_request",
  "forbidden",
  "not_found",
  "error",
]);
const DEFAULT_MONITOR_HOURS = 24;
const DEFAULT_MONITOR_LIMIT = 50;
const MAX_MONITOR_HOURS = 168;
const MAX_MONITOR_LIMIT = 200;

function resolveSupabaseClient(deps) {
  return deps.getSupabaseAdminClient ? deps.getSupabaseAdminClient() : getSupabaseAdmin();
}

function tryResolveSupabaseClient(deps) {
  try {
    return resolveSupabaseClient(deps);
  } catch (error) {
    console.error("[archive-monitor] supabase client 초기화 실패:", error);
    return null;
  }
}

function requireArchiveId(value) {
  const archiveId = normalizeArchiveId(value);

  if (!archiveId) {
    throw createCommunityError(400, "archiveId 값을 확인해 주세요.");
  }

  return archiveId;
}

function createOwnershipError(message = "접근 권한이 없습니다.") {
  return createCommunityError(403, message);
}

function toValidationError(error) {
  if (error instanceof TypeError) {
    return createCommunityError(400, error.message);
  }

  return error;
}

function normalizeMonitorSource(source) {
  const normalized = normalizeOptionalString(source);
  if (!normalized) {
    return null;
  }

  if (!ARCHIVE_MONITOR_SOURCES.includes(normalized)) {
    throw new TypeError("source 값을 확인해 주세요.");
  }

  return normalized;
}

function normalizeMonitorOutcome(outcome) {
  const normalized = normalizeOptionalString(outcome);
  if (!normalized) {
    return null;
  }

  if (!ARCHIVE_MONITOR_OUTCOMES.includes(normalized)) {
    throw new TypeError("outcome 값을 확인해 주세요.");
  }

  return normalized;
}

function normalizeMonitorHours(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MONITOR_HOURS;
  }

  return Math.min(MAX_MONITOR_HOURS, Math.max(1, parsed));
}

function normalizeMonitorLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MONITOR_LIMIT;
  }

  return Math.min(MAX_MONITOR_LIMIT, Math.max(1, parsed));
}

function resolveArchiveErrorStatus(error) {
  if (error?.status) {
    return Number.isFinite(Number(error.status)) ? Number(error.status) : 500;
  }

  if (error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error") {
    return 401;
  }

  return 500;
}

function classifyArchiveMonitorOutcome(error) {
  const statusCode = resolveArchiveErrorStatus(error);

  if (statusCode === 400) {
    return "bad_request";
  }

  if (statusCode === 401 || statusCode === 403) {
    return "forbidden";
  }

  if (statusCode === 404) {
    return "not_found";
  }

  return "error";
}

function createArchiveMonitorRequestId() {
  return randomUUID();
}

function createArchiveMonitorEventId() {
  return randomUUID();
}

function normalizeOwnerUids(ownerUids) {
  if (!Array.isArray(ownerUids)) {
    return [];
  }

  return [...new Set(ownerUids.map((value) => normalizeOptionalString(value)).filter(Boolean))];
}

function normalizeMonitorMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return compactJsonValue(metadata);
}

function toIsoTimestamp(value, fallback = new Date()) {
  const candidate = value instanceof Date ? value : new Date(value || fallback);

  if (!Number.isNaN(candidate.getTime())) {
    return candidate.toISOString();
  }

  return fallback.toISOString();
}

function buildArchiveMonitorEventRecord(input = {}) {
  const source = normalizeRequiredString(input.source, "source");
  const outcome = normalizeRequiredString(input.outcome, "outcome");

  if (!ARCHIVE_MONITOR_SOURCES.includes(source)) {
    throw new TypeError("source 값을 확인해 주세요.");
  }

  if (!ARCHIVE_MONITOR_OUTCOMES.includes(outcome)) {
    throw new TypeError("outcome 값을 확인해 주세요.");
  }

  return {
    id: createArchiveMonitorEventId(),
    request_id: normalizeRequiredString(
      input.requestId || input.request_id || createArchiveMonitorRequestId(),
      "requestId"
    ),
    source,
    outcome,
    status_code: Number.isFinite(Number(input.statusCode))
      ? Number(input.statusCode)
      : resolveArchiveErrorStatus(input.error),
    archive_id: normalizeOptionalString(input.archiveId),
    actor_uid: normalizeOptionalString(input.actorUid),
    owner_uids: normalizeOwnerUids(input.ownerUids),
    error_code: normalizeOptionalString(input.errorCode || input.error?.code),
    error_message: normalizeOptionalString(input.errorMessage || input.error?.message),
    metadata: normalizeMonitorMetadata(input.metadata),
    created_at: toIsoTimestamp(input.createdAt),
  };
}

function mapArchiveMonitorRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || null,
    requestId: row.request_id || null,
    source: row.source || null,
    outcome: row.outcome || null,
    statusCode: Number.isFinite(Number(row.status_code)) ? Number(row.status_code) : null,
    archiveId: row.archive_id || null,
    actorUid: row.actor_uid || null,
    ownerUids: Array.isArray(row.owner_uids) ? row.owner_uids : [],
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
  };
}

async function insertArchiveMonitorEvent({ supabase, record }) {
  if (!supabase) {
    return record;
  }

  const { error } = await supabase.from(LOG_ARCHIVE_MONITOR_TABLE).insert(record);

  if (error) {
    throw error;
  }

  return record;
}

async function recordArchiveMonitorEventBestEffort({ supabase, ...input }) {
  const record = buildArchiveMonitorEventRecord(input);
  const consoleMethod = record.outcome === "success" ? console.info : console.warn;

  consoleMethod("[archive-monitor]", {
    requestId: record.request_id,
    source: record.source,
    outcome: record.outcome,
    statusCode: record.status_code,
    archiveId: record.archive_id,
    actorUid: record.actor_uid,
    errorCode: record.error_code,
    errorMessage: record.error_message,
  });

  try {
    await insertArchiveMonitorEvent({ supabase, record });
  } catch (error) {
    console.error("[archive-monitor] event 저장 실패:", error);
  }

  return record;
}

function applyArchiveMonitorFilters(queryBuilder, { source, outcome, cutoffIso }) {
  let query = queryBuilder.gte("created_at", cutoffIso);

  if (source) {
    query = query.eq("source", source);
  }

  if (outcome) {
    query = query.eq("outcome", outcome);
  }

  return query;
}

async function listArchiveMonitorEvents({ supabase, hours, limit, source, outcome }) {
  const normalizedHours = normalizeMonitorHours(hours);
  const normalizedLimit = normalizeMonitorLimit(limit);
  const normalizedSource = normalizeMonitorSource(source);
  const normalizedOutcome = normalizeMonitorOutcome(outcome);
  const cutoffIso = new Date(Date.now() - normalizedHours * 60 * 60 * 1000).toISOString();

  let query = supabase.from(LOG_ARCHIVE_MONITOR_TABLE).select("*");
  query = applyArchiveMonitorFilters(query, {
    source: normalizedSource,
    outcome: normalizedOutcome,
    cutoffIso,
  });
  query = query.order("created_at", { ascending: false }).limit(normalizedLimit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapArchiveMonitorRow(row));
}

async function countArchiveMonitorEvents({ supabase, hours, source, outcome, excludeOutcome }) {
  const normalizedHours = normalizeMonitorHours(hours);
  const normalizedSource = normalizeMonitorSource(source);
  const normalizedOutcome = normalizeMonitorOutcome(outcome);
  const normalizedExcludeOutcome = normalizeMonitorOutcome(excludeOutcome);
  const cutoffIso = new Date(Date.now() - normalizedHours * 60 * 60 * 1000).toISOString();

  let query = supabase.from(LOG_ARCHIVE_MONITOR_TABLE).select("id", { count: "exact", head: true });
  query = query.gte("created_at", cutoffIso);

  if (normalizedSource) {
    query = query.eq("source", normalizedSource);
  }

  if (normalizedOutcome) {
    query = query.eq("outcome", normalizedOutcome);
  }

  if (normalizedExcludeOutcome) {
    query = query.neq("outcome", normalizedExcludeOutcome);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return Number.isFinite(count) ? count : 0;
}

async function fetchLatestArchiveMonitorTimestamp({
  supabase,
  hours,
  source,
  outcome,
  excludeOutcome,
}) {
  const normalizedHours = normalizeMonitorHours(hours);
  const normalizedSource = normalizeMonitorSource(source);
  const normalizedOutcome = normalizeMonitorOutcome(outcome);
  const normalizedExcludeOutcome = normalizeMonitorOutcome(excludeOutcome);
  const cutoffIso = new Date(Date.now() - normalizedHours * 60 * 60 * 1000).toISOString();

  let query = supabase.from(LOG_ARCHIVE_MONITOR_TABLE).select("created_at").gte("created_at", cutoffIso);

  if (normalizedSource) {
    query = query.eq("source", normalizedSource);
  }

  if (normalizedOutcome) {
    query = query.eq("outcome", normalizedOutcome);
  }

  if (normalizedExcludeOutcome) {
    query = query.neq("outcome", normalizedExcludeOutcome);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data[0]?.created_at ? data[0].created_at : null;
}

async function getArchiveMonitoringSnapshot({ supabase, hours, limit, source, outcome }) {
  const normalizedHours = normalizeMonitorHours(hours);
  const normalizedLimit = normalizeMonitorLimit(limit);
  const normalizedSource = normalizeMonitorSource(source);
  const normalizedOutcome = normalizeMonitorOutcome(outcome);
  const sources = normalizedSource ? [normalizedSource] : [...ARCHIVE_MONITOR_SOURCES];
  const summary = {};

  const events = await listArchiveMonitorEvents({
    supabase,
    hours: normalizedHours,
    limit: normalizedLimit,
    source: normalizedSource,
    outcome: normalizedOutcome,
  });

  for (const sourceKey of sources) {
    const counts = {};

    for (const outcomeKey of ARCHIVE_MONITOR_OUTCOMES) {
      if (normalizedOutcome && normalizedOutcome !== outcomeKey) {
        counts[outcomeKey] = 0;
        continue;
      }

      counts[outcomeKey] = await countArchiveMonitorEvents({
        supabase,
        hours: normalizedHours,
        source: sourceKey,
        outcome: outcomeKey,
      });
    }

    summary[sourceKey] = {
      counts,
      totalCount: Object.values(counts).reduce((acc, value) => acc + value, 0),
      failureCount: Object.entries(counts)
        .filter(([key]) => key !== "success")
        .reduce((acc, [, value]) => acc + value, 0),
      lastSuccessAt: normalizedOutcome && normalizedOutcome !== "success"
        ? null
        : await fetchLatestArchiveMonitorTimestamp({
            supabase,
            hours: normalizedHours,
            source: sourceKey,
            outcome: "success",
          }),
      lastFailureAt: normalizedOutcome === "success"
        ? null
        : await fetchLatestArchiveMonitorTimestamp({
            supabase,
            hours: normalizedHours,
            source: sourceKey,
            excludeOutcome: "success",
          }),
    };
  }

  return {
    summary: {
      windowHours: normalizedHours,
      limit: normalizedLimit,
      sourceFilter: normalizedSource,
      outcomeFilter: normalizedOutcome,
      generatedAt: new Date().toISOString(),
      sources: summary,
    },
    events,
  };
}

async function upsertArchiveRow({ supabase, table, record }) {
  const { data, error } = await supabase
    .from(table)
    .upsert(record, {
      onConflict: "id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchArchiveRowById({ supabase, table, archiveId }) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", archiveId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function createArenaBattleArchivePostHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function arenaBattleArchivePostHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    const requestId = createArchiveMonitorRequestId();
    const monitorSupabase = tryResolveSupabaseClient(deps);
    let decodedToken = null;
    let archiveId = null;

    try {
      decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      const input = await parseJsonBody(req);
      const userUid = requireArchiveId(input.userUid);
      archiveId = normalizeArchiveId(input.id ?? input.archiveId ?? input.archive_id);

      if (userUid !== decodedToken.uid) {
        throw createOwnershipError("자신의 배틀 archive만 저장할 수 있습니다.");
      }

      const record = buildArenaBattleArchiveRecord(input, decodedToken.uid);
      const row = await upsertArchiveRow({
        supabase,
        table: ARENA_BATTLE_ARCHIVE_TABLE,
        record,
      });

      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase || supabase,
        requestId,
        source: "arena_archive_post",
        outcome: "success",
        statusCode: 201,
        archiveId: row.id,
        actorUid: decodedToken.uid,
        ownerUids: [row.user_uid, row.attacker_uid, row.defender_uid],
        metadata: {
          method: req.method,
        },
      });

      sendJson(res, 201, {
        archive: mapArenaBattleArchiveRow(row),
      });
    } catch (error) {
      const normalizedError = toValidationError(error);
      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase,
        requestId,
        source: "arena_archive_post",
        outcome: classifyArchiveMonitorOutcome(normalizedError),
        statusCode: resolveArchiveErrorStatus(normalizedError),
        archiveId,
        actorUid: decodedToken?.uid || null,
        ownerUids: [],
        error: normalizedError,
        metadata: {
          method: req.method,
        },
      });
      handleApiError(res, normalizedError);
    }
  };
}

function createArenaBattleReplayGetHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function arenaBattleReplayGetHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) {
      return;
    }

    const requestId = createArchiveMonitorRequestId();
    const monitorSupabase = tryResolveSupabaseClient(deps);
    let decodedToken = null;
    let archiveId = null;
    let ownerUids = [];

    try {
      decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      archiveId = requireArchiveId(req.query?.archiveId ?? req.query?.id);
      const row = await fetchArchiveRowById({
        supabase,
        table: ARENA_BATTLE_ARCHIVE_TABLE,
        archiveId,
      });

      if (!row) {
        throw createCommunityError(404, "배틀 다시보기를 찾을 수 없습니다.");
      }

      ownerUids = [row.user_uid, row.attacker_uid, row.defender_uid].filter(Boolean);
      if (!ownerUids.includes(decodedToken.uid)) {
        throw createOwnershipError("배틀 다시보기를 조회할 권한이 없습니다.");
      }

      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase || supabase,
        requestId,
        source: "arena_replay_get",
        outcome: "success",
        statusCode: 200,
        archiveId: row.id,
        actorUid: decodedToken.uid,
        ownerUids,
        metadata: {
          method: req.method,
        },
      });

      sendJson(res, 200, {
        archive: mapArenaBattleArchiveRow(row),
      });
    } catch (error) {
      const normalizedError = toValidationError(error);
      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase,
        requestId,
        source: "arena_replay_get",
        outcome: classifyArchiveMonitorOutcome(normalizedError),
        statusCode: resolveArchiveErrorStatus(normalizedError),
        archiveId,
        actorUid: decodedToken?.uid || null,
        ownerUids,
        error: normalizedError,
        metadata: {
          method: req.method,
        },
      });
      handleApiError(res, normalizedError);
    }
  };
}

function createJogressArchivePostHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function jogressArchivePostHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    const requestId = createArchiveMonitorRequestId();
    const monitorSupabase = tryResolveSupabaseClient(deps);
    let decodedToken = null;
    let archiveId = null;

    try {
      decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      const input = await parseJsonBody(req);
      const hostUid = requireArchiveId(input.hostUid);
      archiveId = normalizeArchiveId(input.id ?? input.archiveId ?? input.archive_id);

      if (hostUid !== decodedToken.uid) {
        throw createOwnershipError("자신의 조그레스 archive만 저장할 수 있습니다.");
      }

      const record = buildJogressArchiveRecord(input, decodedToken.uid);
      const row = await upsertArchiveRow({
        supabase,
        table: JOGRESS_ARCHIVE_TABLE,
        record,
      });

      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase || supabase,
        requestId,
        source: "jogress_archive_post",
        outcome: "success",
        statusCode: 201,
        archiveId: row.id,
        actorUid: decodedToken.uid,
        ownerUids: [row.user_uid, row.host_uid, row.guest_uid],
        metadata: {
          method: req.method,
        },
      });

      sendJson(res, 201, {
        archive: mapJogressArchiveRow(row),
      });
    } catch (error) {
      const normalizedError = toValidationError(error);
      await recordArchiveMonitorEventBestEffort({
        supabase: monitorSupabase,
        requestId,
        source: "jogress_archive_post",
        outcome: classifyArchiveMonitorOutcome(normalizedError),
        statusCode: resolveArchiveErrorStatus(normalizedError),
        archiveId,
        actorUid: decodedToken?.uid || null,
        ownerUids: [],
        error: normalizedError,
        metadata: {
          method: req.method,
        },
      });
      handleApiError(res, normalizedError);
    }
  };
}

module.exports = {
  ARCHIVE_MONITOR_OUTCOMES,
  ARCHIVE_MONITOR_SOURCES,
  LOG_ARCHIVE_MONITOR_TABLE,
  buildArchiveMonitorEventRecord,
  classifyArchiveMonitorOutcome,
  createArenaBattleArchivePostHandler,
  createArenaBattleReplayGetHandler,
  createArchiveMonitorRequestId,
  createJogressArchivePostHandler,
  fetchArchiveRowById,
  getArchiveMonitoringSnapshot,
  mapArchiveMonitorRow,
  normalizeMonitorHours,
  normalizeMonitorLimit,
  normalizeMonitorOutcome,
  normalizeMonitorSource,
  recordArchiveMonitorEventBestEffort,
  requireArchiveId,
  resolveArchiveErrorStatus,
  resolveSupabaseClient,
  tryResolveSupabaseClient,
  upsertArchiveRow,
};
