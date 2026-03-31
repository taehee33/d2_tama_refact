"use strict";

const { verifyRequestUser } = require("../../../_lib/auth");
const {
  deleteCommunityComment,
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

  const commentId = Array.isArray(req.query.commentId)
    ? req.query.commentId[0]
    : req.query.commentId;

  try {
    const decodedToken = await verifyRequestUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "PATCH") {
      const input = await parseJsonBody(req);
      const result = await updateCommunityComment({
        supabase,
        uid: decodedToken.uid,
        commentId,
        input,
      });

      return sendJson(res, 200, result);
    }

    const result = await deleteCommunityComment({
      supabase,
      uid: decodedToken.uid,
      commentId,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
};
