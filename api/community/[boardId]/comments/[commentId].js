"use strict";

const { verifyRequestUser } = require("../../../_lib/auth");
const {
  deleteCommunityComment,
  normalizeBoardId,
  updateCommunityComment,
} = require("../../../_lib/community");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("../../../_lib/http");
const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["PATCH", "DELETE"])) {
    return;
  }

  const boardId = Array.isArray(req.query.boardId) ? req.query.boardId[0] : req.query.boardId;
  const commentId = Array.isArray(req.query.commentId)
    ? req.query.commentId[0]
    : req.query.commentId;

  try {
    const decodedToken = await verifyRequestUser(req);
    const normalizedBoardId = normalizeBoardId(boardId);

    if (req.method === "PATCH") {
      const input = await parseJsonBody(req);
      const result = await updateCommunityComment({
        supabase: getSupabaseAdmin(),
        boardId: normalizedBoardId,
        uid: decodedToken.uid,
        commentId,
        input,
      });

      return sendJson(res, 200, result);
    }

    const result = await deleteCommunityComment({
      supabase: getSupabaseAdmin(),
      boardId: normalizedBoardId,
      uid: decodedToken.uid,
      commentId,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
};
