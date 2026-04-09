"use strict";

const { verifyRequestUser } = require("../../../_lib/auth");
const {
  createCommunityPost,
  listCommunityPosts,
  normalizeBoardId,
} = require("../../../_lib/community");
const {
  allowMethods,
  handleApiError,
  parseJsonBody,
  sendJson,
} = require("../../../_lib/http");
const { getSupabaseAdmin } = require("../../../_lib/supabaseAdmin");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  const boardId = Array.isArray(req.query.boardId) ? req.query.boardId[0] : req.query.boardId;

  try {
    const decodedToken = await verifyRequestUser(req);
    const supabase = getSupabaseAdmin();
    const normalizedBoardId = normalizeBoardId(boardId);

    if (req.method === "GET") {
      const category = Array.isArray(req.query.category)
        ? req.query.category[0]
        : req.query.category;
      const posts = await listCommunityPosts({
        supabase,
        boardId: normalizedBoardId,
        category,
      });

      return sendJson(res, 200, { posts });
    }

    const input = await parseJsonBody(req);
    const post = await createCommunityPost({
      supabase,
      boardId: normalizedBoardId,
      uid: decodedToken.uid,
      decodedToken,
      input,
    });

    return sendJson(res, 201, { post });
  } catch (error) {
    return handleApiError(res, error);
  }
};
