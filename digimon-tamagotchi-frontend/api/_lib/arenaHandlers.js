"use strict";

const { assertArenaAdmin, verifyRequestUser } = require("./auth");
const { createCommunityError } = require("./community");
const {
  commitWrites,
  createSetWrite,
  createUpdateWrite,
  getDocument,
  listDocuments,
} = require("./firestoreAdmin");
const { allowMethods, handleApiError, parseJsonBody, sendJson } = require("./http");
const { getArchiveMonitoringSnapshot, upsertArchiveRow } = require("./logArchiveHandlers");
const { getSupabaseAdmin } = require("./supabaseAdmin");
const { ARENA_BATTLE_ARCHIVE_TABLE, buildArenaBattleArchiveRecord } = require("./logArchives");

const ARENA_CONFIG_PATH = "game_settings/arena_config";
const ARENA_ARCHIVE_COLLECTION = "season_archives";
const ARENA_ENTRY_COLLECTION = "arena_entries";
const ARENA_BATTLE_LOG_COLLECTION = "arena_battle_logs";
const MAX_ARENA_RESET_ENTRIES = 450;

function resolveSupabaseClient(deps) {
  return deps.getSupabaseAdminClient ? deps.getSupabaseAdminClient() : getSupabaseAdmin();
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createArenaAdminError(message = "아레나 관리자 권한이 없습니다.") {
  return createCommunityError(403, message);
}

function createArenaValidationError(message) {
  return createCommunityError(400, message);
}

function ensureSeasonConfigInput(input = {}) {
  const currentSeasonId = normalizeInteger(input.currentSeasonId, 0);

  if (currentSeasonId <= 0) {
    throw createArenaValidationError("현재 시즌 ID를 확인해 주세요.");
  }

  return {
    currentSeasonId,
    seasonName: normalizeString(input.seasonName, `Season ${currentSeasonId}`),
    seasonDuration: normalizeString(input.seasonDuration),
  };
}

function normalizeArenaRecord(record = {}, currentSeasonId = 0) {
  const seasonId = normalizeInteger(record.seasonId, currentSeasonId);

  return {
    wins: normalizeInteger(record.wins, 0),
    losses: normalizeInteger(record.losses, 0),
    seasonWins: normalizeInteger(record.seasonWins, 0),
    seasonLosses: normalizeInteger(record.seasonLosses, 0),
    seasonId,
  };
}

function sortArenaEntries(entries = [], mode = "season") {
  const sorted = [...entries];

  sorted.sort((left, right) => {
    const leftRecord = normalizeArenaRecord(left.record || left.data?.record || {}, left.seasonId || 0);
    const rightRecord = normalizeArenaRecord(right.record || right.data?.record || {}, right.seasonId || 0);
    const leftWins = mode === "all" ? leftRecord.wins : leftRecord.seasonWins;
    const rightWins = mode === "all" ? rightRecord.wins : rightRecord.seasonWins;
    const leftLosses = mode === "all" ? leftRecord.losses : leftRecord.seasonLosses;
    const rightLosses = mode === "all" ? rightRecord.losses : rightRecord.seasonLosses;

    if (rightWins !== leftWins) {
      return rightWins - leftWins;
    }

    if (leftLosses !== rightLosses) {
      return leftLosses - rightLosses;
    }

    const leftName = normalizeString(left.tamerName || left.trainerName || left.data?.tamerName, "");
    const rightName = normalizeString(right.tamerName || right.trainerName || right.data?.tamerName, "");
    return leftName.localeCompare(rightName, "ko");
  });

  return sorted;
}

function buildArchivedArenaEntry(entryDocument, seasonId, archivedAt) {
  const entry = entryDocument?.data || {};
  const digimonSnapshot = entry.digimonSnapshot && typeof entry.digimonSnapshot === "object"
    ? { ...entry.digimonSnapshot }
    : {};

  return {
    id: entryDocument.id,
    userId: normalizeString(entry.userId) || null,
    tamerName: normalizeString(entry.tamerName || entry.trainerName, "Unknown"),
    digimonSnapshot: {
      digimonId: normalizeString(digimonSnapshot.digimonId || digimonSnapshot.digimonName, "Unknown"),
      digimonName: normalizeString(digimonSnapshot.digimonName, "Unknown"),
      digimonNickname: normalizeString(digimonSnapshot.digimonNickname) || null,
      slotId: digimonSnapshot.slotId ?? null,
      slotName: normalizeString(digimonSnapshot.slotName) || null,
      stage: normalizeString(digimonSnapshot.stage, "Unknown"),
      sprite: normalizeInteger(digimonSnapshot.sprite, 0),
      slotVersion: normalizeString(digimonSnapshot.slotVersion, "Ver.1"),
      spriteBasePath: normalizeString(digimonSnapshot.spriteBasePath) || null,
    },
    record: normalizeArenaRecord(entry.record || {}, seasonId),
    archivedAt,
  };
}

function createArenaArchiveId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `arena_${crypto.randomUUID()}`;
  }

  return `arena_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildArenaBattleSummary({
  archiveId,
  archiveStatus,
  attackerUid,
  attackerName,
  attackerDigimonName,
  defenderUid,
  defenderName,
  defenderDigimonName,
  myEntryId,
  defenderEntryId,
  winnerUid,
  summary,
  occurredAt,
}) {
  return {
    archiveId,
    archiveStatus,
    attackerId: attackerUid,
    attackerName,
    attackerDigimonName,
    defenderId: defenderUid,
    defenderName,
    defenderDigimonName,
    myEntryId,
    defenderEntryId,
    winnerId: winnerUid,
    logSummary: summary,
    timestamp: occurredAt,
  };
}

function buildArenaBattleArchiveInput({
  archiveId,
  currentUser,
  attackerEntry,
  defenderEntry,
  myEntryId,
  defenderEntryId,
  battleResult,
  currentSeasonId,
}) {
  const attackerName = normalizeString(
    attackerEntry.tamerName || attackerEntry.trainerName || currentUser.name,
    `테이머-${currentUser.uid.slice(0, 6)}`
  );
  const defenderName = normalizeString(
    defenderEntry.tamerName || defenderEntry.trainerName,
    `테이머-${String(defenderEntryId).slice(0, 6)}`
  );
  const attackerDigimonName = normalizeString(attackerEntry.digimonSnapshot?.digimonName, "Unknown");
  const defenderDigimonName = normalizeString(defenderEntry.digimonSnapshot?.digimonName, "Unknown");
  const replayLogs = Array.isArray(battleResult.logs) ? battleResult.logs : [];
  const attackerUid = normalizeString(attackerEntry.userId || currentUser.uid, currentUser.uid);
  const defenderUid = normalizeString(defenderEntry.userId);
  const winnerUid = battleResult.win ? attackerUid : defenderUid;
  const summary = battleResult.win
    ? `${attackerName}의 ${attackerDigimonName}이(가) ${defenderName}의 ${defenderDigimonName}을(를) 쓰러뜨렸습니다.`
    : `${defenderName}의 ${defenderDigimonName}이(가) ${attackerName}의 ${attackerDigimonName}을(를) 쓰러뜨렸습니다.`;

  return {
    attackerDigimonName,
    attackerName,
    attackerUid,
    defenderDigimonName,
    defenderName,
    defenderUid,
    replayLogs,
    summary,
    winnerUid,
    record: buildArenaBattleArchiveRecord(
      {
        id: archiveId,
        userUid: attackerUid,
        attackerUid,
        attackerName,
        attackerDigimonName,
        defenderUid,
        defenderName,
        defenderDigimonName,
        myEntryId,
        defenderEntryId,
        winnerUid,
        summary,
        replayLogs,
        payload: {
          battleType: "arena",
          currentSeasonId,
          result: {
            win: Boolean(battleResult.win),
            logs: replayLogs,
          },
        },
      },
      attackerUid
    ),
  };
}

function createArenaAdminConfigHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const commit = deps.commitWrites || commitWrites;
  const getDocumentByPath = deps.getDocument || getDocument;
  const getMonitoringSnapshot =
    deps.getArchiveMonitoringSnapshot || getArchiveMonitoringSnapshot;

  return async function arenaAdminConfigHandler(req, res) {
    if (!allowMethods(req, res, ["GET", "PUT"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      assertArenaAdmin(decodedToken);

      if (req.method === "GET") {
        const snapshot = await getMonitoringSnapshot({
          supabase: resolveSupabaseClient(deps),
          hours: req.query?.hours,
          limit: req.query?.limit,
          source: normalizeString(req.query?.source) || undefined,
          outcome: normalizeString(req.query?.outcome) || undefined,
        });

        sendJson(res, 200, snapshot);
        return;
      }

      const input = ensureSeasonConfigInput(await parseJsonBody(req));
      const now = new Date();
      const existingConfig = await getDocumentByPath(ARENA_CONFIG_PATH);

      await commit([
        createSetWrite(ARENA_CONFIG_PATH, {
          ...(existingConfig?.data || {}),
          ...input,
          updatedAt: now,
          updatedBy: decodedToken.uid,
        }),
      ]);

      sendJson(res, 200, {
        config: input,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        handleApiError(res, createArenaValidationError(error.message));
        return;
      }

      handleApiError(res, error);
    }
  };
}

function createArenaSeasonEndHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const commit = deps.commitWrites || commitWrites;
  const getDocumentByPath = deps.getDocument || getDocument;
  const listCollectionDocuments = deps.listDocuments || listDocuments;

  return async function arenaSeasonEndHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      assertArenaAdmin(decodedToken);
      const input = ensureSeasonConfigInput(await parseJsonBody(req));
      const configDocument = await getDocumentByPath(ARENA_CONFIG_PATH);
      const configData = configDocument?.data || {};
      const currentSeasonId = normalizeInteger(configData.currentSeasonId, input.currentSeasonId);

      if (currentSeasonId !== input.currentSeasonId) {
        throw createArenaValidationError("시즌 정보가 갱신되었습니다. 현재 아레나 화면을 새로고침한 뒤 다시 시도해 주세요.");
      }

      const archiveId = `season_${currentSeasonId}`;
      const existingArchive = await getDocumentByPath(`${ARENA_ARCHIVE_COLLECTION}/${archiveId}`);
      if (existingArchive?.data) {
        throw createArenaValidationError("이미 종료된 시즌입니다. 중복 아카이브를 만들 수 없습니다.");
      }

      const allEntries = await listCollectionDocuments(ARENA_ENTRY_COLLECTION);
      if (allEntries.length > MAX_ARENA_RESET_ENTRIES) {
        throw createArenaValidationError(
          `현재 엔트리가 ${allEntries.length}건이라 원자적 시즌 종료 한도를 넘었습니다. 운영자에게 수동 정리를 요청해 주세요.`
        );
      }

      const archivedAt = new Date();
      const currentSeasonEntries = sortArenaEntries(
        allEntries
          .filter((entryDocument) => {
            const record = normalizeArenaRecord(entryDocument.data?.record || {}, currentSeasonId);
            return record.seasonId === currentSeasonId;
          })
          .map((entryDocument) => buildArchivedArenaEntry(entryDocument, currentSeasonId, archivedAt)),
        "season"
      );

      const nextSeasonId = currentSeasonId + 1;
      const nextConfig = {
        currentSeasonId: nextSeasonId,
        seasonName: `Season ${nextSeasonId}`,
        seasonDuration: input.seasonDuration,
      };

      const writes = [
        createSetWrite(`${ARENA_ARCHIVE_COLLECTION}/${archiveId}`, {
          seasonId: currentSeasonId,
          seasonName: input.seasonName,
          seasonDuration: input.seasonDuration,
          entries: currentSeasonEntries,
          entryCount: currentSeasonEntries.length,
          createdAt: archivedAt,
          updatedAt: archivedAt,
          archivedBy: decodedToken.uid,
          isDeleted: false,
        }),
        createSetWrite(ARENA_CONFIG_PATH, {
          ...nextConfig,
          updatedAt: archivedAt,
          updatedBy: decodedToken.uid,
          lastArchivedSeasonId: currentSeasonId,
        }),
      ];

      allEntries.forEach((entryDocument) => {
        const nextRecord = normalizeArenaRecord(entryDocument.data?.record || {}, nextSeasonId);
        nextRecord.seasonId = nextSeasonId;
        nextRecord.seasonWins = 0;
        nextRecord.seasonLosses = 0;

        writes.push(
          createUpdateWrite(
            `${ARENA_ENTRY_COLLECTION}/${entryDocument.id}`,
            {
              record: nextRecord,
              updatedAt: archivedAt,
            },
            [
              "record.wins",
              "record.losses",
              "record.seasonWins",
              "record.seasonLosses",
              "record.seasonId",
              "updatedAt",
            ]
          )
        );
      });

      await commit(writes);

      sendJson(res, 200, {
        season: {
          archiveId,
          archivedEntryCount: currentSeasonEntries.length,
          currentSeasonId: nextConfig.currentSeasonId,
          seasonName: nextConfig.seasonName,
          seasonDuration: nextConfig.seasonDuration,
        },
      });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createArenaArchiveDeleteHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const commit = deps.commitWrites || commitWrites;
  const getDocumentByPath = deps.getDocument || getDocument;

  return async function arenaArchiveDeleteHandler(req, res) {
    if (!allowMethods(req, res, ["DELETE"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      assertArenaAdmin(decodedToken);
      const archiveId = normalizeString(req.query?.archiveId || req.query?.id);

      if (!archiveId) {
        throw createArenaValidationError("삭제할 아카이브 ID를 확인해 주세요.");
      }

      const archiveDocument = await getDocumentByPath(`${ARENA_ARCHIVE_COLLECTION}/${archiveId}`);
      if (!archiveDocument) {
        throw createCommunityError(404, "아카이브를 찾을 수 없습니다.");
      }

      const deletedAt = new Date();
      await commit([
        createUpdateWrite(
          `${ARENA_ARCHIVE_COLLECTION}/${archiveId}`,
          {
            isDeleted: true,
            deletedAt,
            deletedBy: decodedToken.uid,
            updatedAt: deletedAt,
          },
          ["isDeleted", "deletedAt", "deletedBy", "updatedAt"]
        ),
      ]);

      sendJson(res, 200, {
        archive: {
          id: archiveId,
          isDeleted: true,
        },
      });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createArenaArchiveMonitoringHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const getMonitoringSnapshot =
    deps.getArchiveMonitoringSnapshot || getArchiveMonitoringSnapshot;

  return async function arenaArchiveMonitoringHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      assertArenaAdmin(decodedToken);

      const snapshot = await getMonitoringSnapshot({
        supabase: resolveSupabaseClient(deps),
        hours: req.query?.hours,
        limit: req.query?.limit,
        source: normalizeString(req.query?.source) || undefined,
        outcome: normalizeString(req.query?.outcome) || undefined,
      });

      sendJson(res, 200, snapshot);
    } catch (error) {
      if (error instanceof TypeError) {
        handleApiError(res, createArenaValidationError(error.message));
        return;
      }

      handleApiError(res, error);
    }
  };
}

function createArenaBattleCompleteHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const commit = deps.commitWrites || commitWrites;
  const getDocumentByPath = deps.getDocument || getDocument;
  const upsertArchive = deps.upsertArchiveRow || upsertArchiveRow;

  return async function arenaBattleCompleteHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      const input = await parseJsonBody(req);
      const myEntryId = normalizeString(input.myEntryId);
      const defenderEntryId = normalizeString(input.defenderEntryId);
      const currentSeasonId = normalizeInteger(input.currentSeasonId, 0);
      const battleResult = input.battleResult && typeof input.battleResult === "object" ? input.battleResult : null;

      if (!myEntryId || !defenderEntryId) {
        throw createArenaValidationError("아레나 엔트리 정보가 부족합니다. 현재 디지몬을 먼저 등록해 주세요.");
      }

      if (!battleResult || typeof battleResult.win !== "boolean") {
        throw createArenaValidationError("배틀 결과를 확인할 수 없습니다.");
      }

      if (currentSeasonId <= 0) {
        throw createArenaValidationError("현재 시즌 정보를 확인해 주세요.");
      }

      const [myEntryDocument, defenderEntryDocument] = await Promise.all([
        getDocumentByPath(`${ARENA_ENTRY_COLLECTION}/${myEntryId}`),
        getDocumentByPath(`${ARENA_ENTRY_COLLECTION}/${defenderEntryId}`),
      ]);

      if (!myEntryDocument || !defenderEntryDocument) {
        throw createCommunityError(404, "아레나 엔트리를 찾을 수 없습니다.");
      }

      const myEntry = myEntryDocument.data || {};
      const defenderEntry = defenderEntryDocument.data || {};

      if (normalizeString(myEntry.userId) !== decodedToken.uid) {
        throw createCommunityError(403, "자신의 아레나 엔트리만 배틀에 사용할 수 있습니다.");
      }

      if (normalizeString(defenderEntry.userId) === decodedToken.uid) {
        throw createArenaValidationError("같은 사용자의 엔트리와는 배틀할 수 없습니다.");
      }

      const myRecord = normalizeArenaRecord(myEntry.record || {}, currentSeasonId);
      const defenderRecord = normalizeArenaRecord(defenderEntry.record || {}, currentSeasonId);

      if (battleResult.win) {
        myRecord.wins += 1;
        myRecord.seasonWins += 1;
        defenderRecord.losses += 1;
        defenderRecord.seasonLosses += 1;
      } else {
        myRecord.losses += 1;
        myRecord.seasonLosses += 1;
        defenderRecord.wins += 1;
        defenderRecord.seasonWins += 1;
      }

      myRecord.seasonId = currentSeasonId;
      defenderRecord.seasonId = currentSeasonId;

      const occurredAt = new Date();
      const archiveId = normalizeString(input.archiveId, createArenaArchiveId());
      const archiveInput = buildArenaBattleArchiveInput({
        archiveId,
        currentUser: decodedToken,
        attackerEntry: myEntry,
        defenderEntry,
        myEntryId,
        defenderEntryId,
        battleResult,
        currentSeasonId,
      });

      const supabase = resolveSupabaseClient(deps);
      await upsertArchive({
        supabase,
        table: ARENA_BATTLE_ARCHIVE_TABLE,
        record: archiveInput.record,
      });

      await commit([
        createUpdateWrite(
          `${ARENA_ENTRY_COLLECTION}/${myEntryId}`,
          {
            record: myRecord,
            updatedAt: occurredAt,
          },
          [
            "record.wins",
            "record.losses",
            "record.seasonWins",
            "record.seasonLosses",
            "record.seasonId",
            "updatedAt",
          ]
        ),
        createUpdateWrite(
          `${ARENA_ENTRY_COLLECTION}/${defenderEntryId}`,
          {
            record: defenderRecord,
            updatedAt: occurredAt,
          },
          [
            "record.wins",
            "record.losses",
            "record.seasonWins",
            "record.seasonLosses",
            "record.seasonId",
            "updatedAt",
          ]
        ),
        createSetWrite(
          `${ARENA_BATTLE_LOG_COLLECTION}/${archiveId}`,
          buildArenaBattleSummary({
            archiveId,
            archiveStatus: "ready",
            attackerUid: archiveInput.attackerUid,
            attackerName: archiveInput.attackerName,
            attackerDigimonName: archiveInput.attackerDigimonName,
            defenderUid: archiveInput.defenderUid,
            defenderName: archiveInput.defenderName,
            defenderDigimonName: archiveInput.defenderDigimonName,
            myEntryId,
            defenderEntryId,
            winnerUid: archiveInput.winnerUid,
            summary: archiveInput.summary,
            occurredAt,
          })
        ),
      ]);

      sendJson(res, 200, {
        battle: {
          archiveId,
          archiveStatus: "ready",
          defenderEntryId,
          myEntryId,
          winnerUid: archiveInput.winnerUid,
        },
      });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = {
  buildArchivedArenaEntry,
  buildArenaBattleArchiveInput,
  createArenaAdminConfigHandler,
  createArenaArchiveDeleteHandler,
  createArenaArchiveMonitoringHandler,
  createArenaBattleCompleteHandler,
  createArenaSeasonEndHandler,
  ensureSeasonConfigInput,
  normalizeArenaRecord,
  sortArenaEntries,
};
