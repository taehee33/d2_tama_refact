"use strict";

const { verifyRequestUser } = require("../../../_lib/auth");
const {
  createCommunityPost,
  listCommunityPosts,
} = require("../../../_lib/community");
const { getFirebaseAdminDb } = require("../../../_lib/firebaseAdmin");
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

  try {
    const decodedToken = await verifyRequestUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const posts = await listCommunityPosts({ supabase });
      return sendJson(res, 200, { posts });
    }

    const input = await parseJsonBody(req);
    const post = await createCommunityPost({
      supabase,
      db: getFirebaseAdminDb(),
      uid: decodedToken.uid,
      decodedToken,
      input,
    });

    return sendJson(res, 201, { post });
  } catch (error) {
    return handleApiError(res, error);
  }
};
