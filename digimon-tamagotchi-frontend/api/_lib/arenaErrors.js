"use strict";

const ARENA_ERROR_STATUS = Object.freeze({
  ARENA_AUTH_REQUIRED: 401,
  ARENA_FORBIDDEN: 403,
  ARENA_NOT_FOUND: 404,
  ARENA_IDEMPOTENCY_CONFLICT: 409,
  ARENA_GHOST_LIMIT_REACHED: 409,
  ARENA_GHOST_ALREADY_REGISTERED: 409,
  ARENA_GHOST_SYNC_PENDING: 409,
  ARENA_GHOST_FORBIDDEN: 403,
  ARENA_GHOST_NOT_FOUND: 404,
  ARENA_SLOT_NOT_FOUND: 404,
  ARENA_CLIENT_UPGRADE_REQUIRED: 426,
  ARENA_INVALID_REQUEST: 400,
  ARENA_SLOT_DEAD: 422,
  ARENA_SLOT_STARTER: 422,
  ARENA_COMBAT_IDENTITY_STALE: 422,
  ARENA_SOURCE_READ_UNAVAILABLE: 503,
  ARENA_SLOT_PROJECTION_UNAVAILABLE: 503,
  ARENA_MAINTENANCE: 503,
  ARENA_REPLAY_TOO_LARGE: 422,
});

class ArenaError extends Error {
  constructor(code, message, details = null, status = null, options = {}) {
    super(message || "아레나 요청을 처리하지 못했습니다.");
    this.name = "ArenaError";
    this.code = code || "ARENA_INTERNAL_ERROR";
    this.status = status || ARENA_ERROR_STATUS[this.code] || 500;
    this.details = details;
    this.retryable = options.retryable === true;
    this.requestId = options.requestId || null;
  }
}

function isArenaError(error) {
  return error instanceof ArenaError || error?.name === "ArenaError";
}

function toArenaErrorPayload(error) {
  const normalized = isArenaError(error)
    ? error
    : new ArenaError("ARENA_INTERNAL_ERROR", "아레나 요청을 처리하지 못했습니다.");
  return {
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
    ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
  };
}

module.exports = {
  ARENA_ERROR_STATUS,
  ArenaError,
  isArenaError,
  toArenaErrorPayload,
};
