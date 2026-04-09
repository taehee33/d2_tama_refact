"use strict";

const { verifyRequestUser } = require("../../../../../_lib/auth");
const {
  createCommunityComment,
  normalizeBoardId,
} = require("../../../../../_lib/community");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("../../../../../_lib/http");
const { getSupabaseAdmin } = require("../../../../../_lib/supabaseAdmin");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  const boardId = Array.isArray(req.query.boardId) ? req.query.boardId[0] : req.query.boardId;
  const postId = Array.isArray(req.query.postId) ? req.query.postId[0] : req.query.postId;

  try {
    const decodedToken = await verifyRequestUser(req);
    const input = await parseJsonBody(req);
    const result = await createCommunityComment({
      supabase: getSupabaseAdmin(),
      boardId: normalizeBoardId(boardId),
      uid: decodedToken.uid,
      decodedToken,
      postId,
      input,
    });

    return sendJson(res, 201, result);
  } catch (error) {
    return handleApiError(res, error);
  }
};
