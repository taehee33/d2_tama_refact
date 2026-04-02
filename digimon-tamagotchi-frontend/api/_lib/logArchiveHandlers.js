"use strict";

const { verifyRequestUser } = require("./auth");
const { createCommunityError } = require("./community");
const { getSupabaseAdmin } = require("./supabaseAdmin");
const {
  ARENA_BATTLE_ARCHIVE_TABLE,
  JOGRESS_ARCHIVE_TABLE,
  buildArenaBattleArchiveRecord,
  buildJogressArchiveRecord,
  mapArenaBattleArchiveRow,
  mapJogressArchiveRow,
  normalizeArchiveId,
} = require("./logArchives");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("./http");

function resolveSupabaseClient(deps) {
  return deps.getSupabaseAdminClient ? deps.getSupabaseAdminClient() : getSupabaseAdmin();
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

    try {
      const decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      const input = await parseJsonBody(req);
      const userUid = requireArchiveId(input.userUid);

      if (userUid !== decodedToken.uid) {
        throw createOwnershipError("자신의 배틀 archive만 저장할 수 있습니다.");
      }

      const record = buildArenaBattleArchiveRecord(input, decodedToken.uid);
      const row = await upsertArchiveRow({
        supabase,
        table: ARENA_BATTLE_ARCHIVE_TABLE,
        record,
      });

      sendJson(res, 201, {
        archive: mapArenaBattleArchiveRow(row),
      });
    } catch (error) {
      handleApiError(res, toValidationError(error));
    }
  };
}

function createArenaBattleReplayGetHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function arenaBattleReplayGetHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      const archiveId = requireArchiveId(req.query?.archiveId ?? req.query?.id);
      const row = await fetchArchiveRowById({
        supabase,
        table: ARENA_BATTLE_ARCHIVE_TABLE,
        archiveId,
      });

      if (!row) {
        throw createCommunityError(404, "배틀 다시보기를 찾을 수 없습니다.");
      }

      const ownerUids = [row.user_uid, row.attacker_uid, row.defender_uid].filter(Boolean);
      if (!ownerUids.includes(decodedToken.uid)) {
        throw createOwnershipError("배틀 다시보기를 조회할 권한이 없습니다.");
      }

      sendJson(res, 200, {
        archive: mapArenaBattleArchiveRow(row),
      });
    } catch (error) {
      handleApiError(res, toValidationError(error));
    }
  };
}

function createJogressArchivePostHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function jogressArchivePostHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      const supabase = resolveSupabaseClient(deps);
      const input = await parseJsonBody(req);
      const hostUid = requireArchiveId(input.hostUid);

      if (hostUid !== decodedToken.uid) {
        throw createOwnershipError("자신의 조그레스 archive만 저장할 수 있습니다.");
      }

      const record = buildJogressArchiveRecord(input, decodedToken.uid);
      const row = await upsertArchiveRow({
        supabase,
        table: JOGRESS_ARCHIVE_TABLE,
        record,
      });

      sendJson(res, 201, {
        archive: mapJogressArchiveRow(row),
      });
    } catch (error) {
      handleApiError(res, toValidationError(error));
    }
  };
}

module.exports = {
  createArenaBattleArchivePostHandler,
  createArenaBattleReplayGetHandler,
  createJogressArchivePostHandler,
  fetchArchiveRowById,
  requireArchiveId,
  resolveSupabaseClient,
  upsertArchiveRow,
};
