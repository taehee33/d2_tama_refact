const { BOARD_ID_SHOWCASE, mapCommentRow, mapPostRow } = require("./community");

function assertSupabaseResult(result, fallbackMessage) {
  if (result.error) {
    const error = new Error(result.error.message || fallbackMessage);
    error.cause = result.error;
    throw error;
  }

  return result;
}

async function listShowcasePosts(supabase) {
  const result = await supabase
    .from("community_posts")
    .select("*")
    .eq("board_id", BOARD_ID_SHOWCASE)
    .order("created_at", { ascending: false });

  const { data } = assertSupabaseResult(result, "커뮤니티 글 목록을 불러오지 못했습니다.");
  return (data || []).map(mapPostRow);
}

async function getShowcasePostById(supabase, postId) {
  const result = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .eq("board_id", BOARD_ID_SHOWCASE)
    .maybeSingle();

  const { data } = assertSupabaseResult(result, "커뮤니티 글을 불러오지 못했습니다.");
  return mapPostRow(data);
}

async function getShowcasePostDetail(supabase, postId) {
  const [post, comments] = await Promise.all([
    getShowcasePostById(supabase, postId),
    listCommentsByPostId(supabase, postId),
  ]);

  return {
    post,
    comments,
  };
}

async function createShowcasePost(supabase, postInput) {
  const result = await supabase
    .from("community_posts")
    .insert({
      board_id: BOARD_ID_SHOWCASE,
      author_uid: postInput.authorUid,
      author_tamer_name: postInput.authorTamerName,
      slot_id: postInput.slotId,
      title: postInput.title,
      body: postInput.body,
      snapshot: postInput.snapshot,
      comment_count: 0,
    })
    .select("*")
    .single();

  const { data } = assertSupabaseResult(result, "커뮤니티 글을 생성하지 못했습니다.");
  return mapPostRow(data);
}

async function updateShowcasePost(supabase, postId, payload) {
  const result = await supabase
    .from("community_posts")
    .update({
      title: payload.title,
      body: payload.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("board_id", BOARD_ID_SHOWCASE)
    .select("*")
    .single();

  const { data } = assertSupabaseResult(result, "커뮤니티 글을 수정하지 못했습니다.");
  return mapPostRow(data);
}

async function deleteShowcasePost(supabase, postId) {
  const deleteComments = await supabase
    .from("community_post_comments")
    .delete()
    .eq("post_id", postId);

  assertSupabaseResult(deleteComments, "게시글 댓글을 정리하지 못했습니다.");

  const deletePost = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("board_id", BOARD_ID_SHOWCASE);

  assertSupabaseResult(deletePost, "게시글을 삭제하지 못했습니다.");
}

async function listCommentsByPostId(supabase, postId) {
  const result = await supabase
    .from("community_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const { data } = assertSupabaseResult(result, "댓글 목록을 불러오지 못했습니다.");
  return (data || []).map(mapCommentRow);
}

async function getCommentById(supabase, commentId) {
  const result = await supabase
    .from("community_post_comments")
    .select("*")
    .eq("id", commentId)
    .maybeSingle();

  const { data } = assertSupabaseResult(result, "댓글을 불러오지 못했습니다.");
  return mapCommentRow(data);
}

async function createComment(supabase, payload) {
  const result = await supabase
    .from("community_post_comments")
    .insert({
      post_id: payload.postId,
      author_uid: payload.authorUid,
      author_tamer_name: payload.authorTamerName,
      body: payload.body,
    })
    .select("*")
    .single();

  const { data } = assertSupabaseResult(result, "댓글을 작성하지 못했습니다.");
  return mapCommentRow(data);
}

async function updateComment(supabase, commentId, payload) {
  const result = await supabase
    .from("community_post_comments")
    .update({
      body: payload.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .select("*")
    .single();

  const { data } = assertSupabaseResult(result, "댓글을 수정하지 못했습니다.");
  return mapCommentRow(data);
}

async function deleteComment(supabase, commentId) {
  const result = await supabase
    .from("community_post_comments")
    .delete()
    .eq("id", commentId);

  assertSupabaseResult(result, "댓글을 삭제하지 못했습니다.");
}

async function syncCommentCount(supabase, postId) {
  const countResult = await supabase
    .from("community_post_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  assertSupabaseResult(countResult, "댓글 수를 집계하지 못했습니다.");

  const commentCount = countResult.count || 0;
  const updateResult = await supabase
    .from("community_posts")
    .update({
      comment_count: commentCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  assertSupabaseResult(updateResult, "댓글 수를 반영하지 못했습니다.");
  return commentCount;
}

module.exports = {
  createComment,
  createShowcasePost,
  deleteComment,
  deleteShowcasePost,
  getCommentById,
  getShowcasePostById,
  getShowcasePostDetail,
  listCommentsByPostId,
  listShowcasePosts,
  syncCommentCount,
  updateComment,
  updateShowcasePost,
};
