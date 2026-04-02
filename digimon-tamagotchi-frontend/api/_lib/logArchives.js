"use strict";

const ARENA_BATTLE_ARCHIVE_TABLE = "arena_battle_log_archives";
const JOGRESS_ARCHIVE_TABLE = "jogress_log_archives";

function normalizeString(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeArchiveId(value) {
  return normalizeString(value);
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new TypeError(`${fieldName} 값을 확인해 주세요.`);
  }

  return normalized;
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  throw new TypeError("isOnline 값을 확인해 주세요.");
}

function compactJsonValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => compactJsonValue(item));
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        result[key] = compactJsonValue(item);
      }
    }

    return result;
  }

  return value;
}

function normalizeArchivePayload(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("payload 값을 확인해 주세요.");
  }

  return compactJsonValue(value);
}

function normalizeReplayLogs(value) {
  if (!Array.isArray(value)) {
    throw new TypeError("replayLogs 값을 확인해 주세요.");
  }

  return compactJsonValue(value);
}

function buildArenaBattleArchiveRecord(input, ownerUid) {
  const id = normalizeRequiredString(input.id ?? input.archiveId ?? input.archive_id, "archive id");
  const userUid = normalizeRequiredString(ownerUid ?? input.userUid, "userUid");

  return {
    id,
    user_uid: userUid,
    attacker_uid: normalizeOptionalString(input.attackerUid),
    attacker_name: normalizeOptionalString(input.attackerName),
    attacker_digimon_name: normalizeOptionalString(input.attackerDigimonName),
    defender_uid: normalizeOptionalString(input.defenderUid),
    defender_name: normalizeOptionalString(input.defenderName),
    defender_digimon_name: normalizeOptionalString(input.defenderDigimonName),
    my_entry_id: normalizeOptionalString(input.myEntryId),
    defender_entry_id: normalizeOptionalString(input.defenderEntryId),
    winner_uid: normalizeOptionalString(input.winnerUid),
    summary: normalizeOptionalString(input.summary),
    replay_logs: normalizeReplayLogs(input.replayLogs),
    payload: normalizeArchivePayload(input.payload),
  };
}

function buildJogressArchiveRecord(input, ownerUid) {
  const id = normalizeRequiredString(input.id ?? input.archiveId ?? input.archive_id, "archive id");
  const hostUid = normalizeRequiredString(ownerUid ?? input.hostUid, "hostUid");

  return {
    id,
    user_uid: hostUid,
    host_uid: hostUid,
    host_tamer_name: normalizeOptionalString(input.hostTamerName),
    host_slot_id: normalizeOptionalString(input.hostSlotId),
    host_digimon_name: normalizeOptionalString(input.hostDigimonName),
    host_slot_version: normalizeOptionalString(input.hostSlotVersion),
    guest_uid: normalizeOptionalString(input.guestUid),
    guest_tamer_name: normalizeOptionalString(input.guestTamerName),
    guest_slot_id: normalizeOptionalString(input.guestSlotId),
    guest_digimon_name: normalizeOptionalString(input.guestDigimonName),
    guest_slot_version: normalizeOptionalString(input.guestSlotVersion),
    target_id: normalizeOptionalString(input.targetId),
    target_name: normalizeOptionalString(input.targetName),
    is_online: normalizeOptionalBoolean(input.isOnline),
    payload: normalizeArchivePayload(input.payload),
  };
}

function mapArenaBattleArchiveRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    replayLogs: Array.isArray(row.replay_logs) ? row.replay_logs : [],
    payload: row.payload || {},
  };
}

function mapJogressArchiveRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
  };
}

module.exports = {
  ARENA_BATTLE_ARCHIVE_TABLE,
  JOGRESS_ARCHIVE_TABLE,
  buildArenaBattleArchiveRecord,
  buildJogressArchiveRecord,
  compactJsonValue,
  mapArenaBattleArchiveRow,
  mapJogressArchiveRow,
  normalizeArchiveId,
  normalizeOptionalBoolean,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeString,
};
