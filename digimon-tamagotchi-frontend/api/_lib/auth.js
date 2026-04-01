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

module.exports = {
  verifyRequestUser,
};
