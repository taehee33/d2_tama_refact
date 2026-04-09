"use strict";

const { verifyRequestUser } = require("../../../_lib/auth");
const {
  deleteCommunityPost,
  getCommunityPostDetail,
  normalizeBoardId,
  updateCommunityPost,
} = require("../../../_lib/community");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("../../../_lib/http");
const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "PATCH", "DELETE"])) {
    return;
  }

  const boardId = Array.isArray(req.query.boardId) ? req.query.boardId[0] : req.query.boardId;
  const postId = Array.isArray(req.query.postId) ? req.query.postId[0] : req.query.postId;

  try {
    const decodedToken = await verifyRequestUser(req);
    const supabase = getSupabaseAdmin();
    const normalizedBoardId = normalizeBoardId(boardId);

    if (req.method === "GET") {
      const detail = await getCommunityPostDetail({
        supabase,
        boardId: normalizedBoardId,
        postId,
      });

      return sendJson(res, 200, detail);
    }

    if (req.method === "PATCH") {
      const input = await parseJsonBody(req);
      const post = await updateCommunityPost({
        supabase,
        boardId: normalizedBoardId,
        uid: decodedToken.uid,
        postId,
        input,
      });

      return sendJson(res, 200, { post });
    }

    const result = await deleteCommunityPost({
      supabase,
      boardId: normalizedBoardId,
      uid: decodedToken.uid,
      postId,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
};
