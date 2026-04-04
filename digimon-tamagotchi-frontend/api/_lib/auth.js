"use strict";

const { verifyFirebaseIdToken } = require("./firebaseAdmin");
const { createCommunityError } = require("./community");
const { getBearerToken } = require("./http");

async function verifyRequestUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    throw createCommunityError(401, "로그인이 필요한 커뮤니티 기능입니다.");
  }

  try {
    return await verifyFirebaseIdToken(token);
  } catch (error) {
    throw createCommunityError(401, "로그인 인증이 만료되었거나 올바르지 않습니다.");
  }
}

function normalizeCommaSeparatedList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isArenaAdmin(decodedToken) {
  if (!decodedToken) {
    return false;
  }

  const adminUids = normalizeCommaSeparatedList(process.env.ARENA_ADMIN_UIDS);
  const adminEmails = normalizeCommaSeparatedList(process.env.ARENA_ADMIN_EMAILS);
  const uid = typeof decodedToken.uid === "string" ? decodedToken.uid.trim().toLowerCase() : "";
  const email = typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : "";

  return adminUids.includes(uid) || (email ? adminEmails.includes(email) : false);
}

function assertArenaAdmin(decodedToken) {
  if (!isArenaAdmin(decodedToken)) {
    throw createCommunityError(403, "아레나 관리자 권한이 없습니다.");
  }

  return decodedToken;
}

module.exports = {
  assertArenaAdmin,
  isArenaAdmin,
  verifyRequestUser,
};
