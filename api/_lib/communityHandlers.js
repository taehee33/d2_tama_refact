const {
  BOARD_ID_SHOWCASE,
  buildCommunitySnapshot,
  validateCommentPayload,
  validatePostPayload,
} = require("./community");
const { getBearerToken, methodNotAllowed, parseJsonBody, sendError, sendJson } = require("./http");

async function authenticateRequest(req, res, verifyFirebaseToken) {
  const token = getBearerToken(req);

  if (!token) {
    sendError(res, 401, "unauthorized", "로그인이 필요합니다.");
    return null;
  }

  try {
    return await verifyFirebaseToken(token);
  } catch (error) {
    sendError(res, 401, "invalid_token", "유효한 로그인 토큰이 아닙니다.");
    return null;
  }
}

function createPostsCollectionHandler(deps) {
  const {
    verifyFirebaseToken,
    getUserProfile,
    getUserSlot,
    getSupabaseAdminClient,
    listShowcasePosts,
    createShowcasePost,
  } = deps;

  return async function postsCollectionHandler(req, res) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      methodNotAllowed(res, ["GET", "POST", "OPTIONS"]);
      return;
    }

    const decodedToken = await authenticateRequest(req, res, verifyFirebaseToken);
    if (!decodedToken) {
      return;
    }

    const supabase = getSupabaseAdminClient();

    try {
      if (req.method === "GET") {
        const posts = await listShowcasePosts(supabase);
        sendJson(res, 200, {
          boardId: BOARD_ID_SHOWCASE,
          posts,
        });
        return;
      }

      const payload = await parseJsonBody(req);
      const validation = validatePostPayload(payload);

      if (!validation.isValid) {
        sendError(res, 400, "invalid_post_payload", "게시글 입력값을 확인해 주세요.", {
          details: validation.errors,
        });
        return;
      }

      const slot = await getUserSlot(decodedToken.uid, validation.value.slotId);
      if (!slot) {
        sendError(res, 403, "slot_not_owned", "자신의 슬롯만 게시할 수 있습니다.");
        return;
      }

      const profile = await getUserProfile(decodedToken.uid, decodedToken);
      const post = await createShowcasePost(supabase, {
        authorUid: decodedToken.uid,
        authorTamerName: profile.tamerName,
        slotId: validation.value.slotId,
        title: validation.value.title,
        body: validation.value.body,
        snapshot: buildCommunitySnapshot(slot, validation.value.slotId),
      });

      sendJson(res, 201, { post });
    } catch (error) {
      console.error("[community/posts]", error);
      sendError(res, 500, "community_posts_failed", "커뮤니티 글을 처리하지 못했습니다.");
    }
  };
}

function createPostItemHandler(deps) {
  const {
    verifyFirebaseToken,
    getSupabaseAdminClient,
    getShowcasePostById,
    getShowcasePostDetail,
    updateShowcasePost,
    deleteShowcasePost,
  } = deps;

  return async function postItemHandler(req, res) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!["GET", "PATCH", "DELETE"].includes(req.method)) {
      methodNotAllowed(res, ["GET", "PATCH", "DELETE", "OPTIONS"]);
      return;
    }

    const decodedToken = await authenticateRequest(req, res, verifyFirebaseToken);
    if (!decodedToken) {
      return;
    }

    const postId = req.query?.postId;
    const supabase = getSupabaseAdminClient();

    try {
      const existingPost = await getShowcasePostById(supabase, postId);

      if (!existingPost) {
        sendError(res, 404, "post_not_found", "게시글을 찾을 수 없습니다.");
        return;
      }

      if (req.method === "GET") {
        const detail = await getShowcasePostDetail(supabase, postId);
        sendJson(res, 200, detail);
        return;
      }

      if (existingPost.authorUid !== decodedToken.uid) {
        sendError(res, 403, "forbidden", "작성자만 수정하거나 삭제할 수 있습니다.");
        return;
      }

      if (req.method === "PATCH") {
        const payload = await parseJsonBody(req);
        const validation = validatePostPayload(payload, { requireSlotId: false });

        if (!validation.isValid) {
          sendError(res, 400, "invalid_post_payload", "게시글 입력값을 확인해 주세요.", {
            details: validation.errors,
          });
          return;
        }

        const post = await updateShowcasePost(supabase, postId, validation.value);
        sendJson(res, 200, { post });
        return;
      }

      await deleteShowcasePost(supabase, postId);
      sendJson(res, 200, { success: true, postId });
    } catch (error) {
      console.error("[community/post-item]", error);
      sendError(res, 500, "community_post_item_failed", "게시글을 처리하지 못했습니다.");
    }
  };
}

function createPostCommentsHandler(deps) {
  const {
    verifyFirebaseToken,
    getUserProfile,
    getSupabaseAdminClient,
    getShowcasePostById,
    createComment,
    syncCommentCount,
  } = deps;

  return async function postCommentsHandler(req, res) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      methodNotAllowed(res, ["POST", "OPTIONS"]);
      return;
    }

    const decodedToken = await authenticateRequest(req, res, verifyFirebaseToken);
    if (!decodedToken) {
      return;
    }

    const postId = req.query?.postId;
    const supabase = getSupabaseAdminClient();

    try {
      const existingPost = await getShowcasePostById(supabase, postId);
      if (!existingPost) {
        sendError(res, 404, "post_not_found", "게시글을 찾을 수 없습니다.");
        return;
      }

      const payload = await parseJsonBody(req);
      const validation = validateCommentPayload(payload);
      if (!validation.isValid) {
        sendError(res, 400, "invalid_comment_payload", "댓글 입력값을 확인해 주세요.", {
          details: validation.errors,
        });
        return;
      }

      const profile = await getUserProfile(decodedToken.uid, decodedToken);
      const comment = await createComment(supabase, {
        postId,
        authorUid: decodedToken.uid,
        authorTamerName: profile.tamerName,
        body: validation.value.body,
      });

      const commentCount = await syncCommentCount(supabase, postId);
      sendJson(res, 201, {
        comment,
        commentCount,
      });
    } catch (error) {
      console.error("[community/post-comments]", error);
      sendError(res, 500, "community_comment_create_failed", "댓글을 처리하지 못했습니다.");
    }
  };
}

function createCommentItemHandler(deps) {
  const {
    verifyFirebaseToken,
    getSupabaseAdminClient,
    getCommentById,
    updateComment,
    deleteComment,
    syncCommentCount,
  } = deps;

  return async function commentItemHandler(req, res) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!["PATCH", "DELETE"].includes(req.method)) {
      methodNotAllowed(res, ["PATCH", "DELETE", "OPTIONS"]);
      return;
    }

    const decodedToken = await authenticateRequest(req, res, verifyFirebaseToken);
    if (!decodedToken) {
      return;
    }

    const commentId = req.query?.commentId;
    const supabase = getSupabaseAdminClient();

    try {
      const existingComment = await getCommentById(supabase, commentId);
      if (!existingComment) {
        sendError(res, 404, "comment_not_found", "댓글을 찾을 수 없습니다.");
        return;
      }

      if (existingComment.authorUid !== decodedToken.uid) {
        sendError(res, 403, "forbidden", "작성자만 댓글을 수정하거나 삭제할 수 있습니다.");
        return;
      }

      if (req.method === "PATCH") {
        const payload = await parseJsonBody(req);
        const validation = validateCommentPayload(payload);
        if (!validation.isValid) {
          sendError(res, 400, "invalid_comment_payload", "댓글 입력값을 확인해 주세요.", {
            details: validation.errors,
          });
          return;
        }

        const comment = await updateComment(supabase, commentId, validation.value);
        sendJson(res, 200, { comment });
        return;
      }

      await deleteComment(supabase, commentId);
      const commentCount = await syncCommentCount(supabase, existingComment.postId);
      sendJson(res, 200, {
        success: true,
        commentId,
        postId: existingComment.postId,
        commentCount,
      });
    } catch (error) {
      console.error("[community/comment-item]", error);
      sendError(res, 500, "community_comment_item_failed", "댓글을 처리하지 못했습니다.");
    }
  };
}

module.exports = {
  createCommentItemHandler,
  createPostCommentsHandler,
  createPostItemHandler,
  createPostsCollectionHandler,
};
