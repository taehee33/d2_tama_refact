"use strict";

const BOARD_ID = "showcase";
const POSTS_TABLE = "community_posts";
const COMMENTS_TABLE = "community_post_comments";
const MAX_POST_TITLE_LENGTH = 80;
const MAX_POST_BODY_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;

const stageTranslations = {
  Digitama: "디지타마",
  "Baby I": "유년기 I",
  "Baby II": "유년기 II",
  Baby1: "유년기 I",
  Baby2: "유년기 II",
  Child: "성장기",
  Adult: "성숙기",
  Perfect: "완전체",
  Ultimate: "궁극체",
  "Super Ultimate": "초궁극체",
  SuperUltimate: "초궁극체",
  Ohakadamon: "묘지몬",
};

function createCommunityError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlotId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const numericValue = trimmedValue.startsWith("slot") ? trimmedValue.slice(4) : trimmedValue;
    const parsedValue = Number.parseInt(numericValue, 10);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  throw createCommunityError(400, "올바른 슬롯 번호를 선택해 주세요.");
}

function translateStageLabel(stage) {
  if (!stage) {
    return "단계 정보 없음";
  }

  return stageTranslations[stage] || stage;
}

function validatePostInput(input = {}) {
  const slotId = normalizeSlotId(input.slotId);
  const title = normalizeString(input.title);
  const body = normalizeString(input.body);

  if (!title) {
    throw createCommunityError(400, "게시글 제목을 입력해 주세요.");
  }

  if (title.length > MAX_POST_TITLE_LENGTH) {
    throw createCommunityError(400, `게시글 제목은 ${MAX_POST_TITLE_LENGTH}자 이하로 입력해 주세요.`);
  }

  if (body.length > MAX_POST_BODY_LENGTH) {
    throw createCommunityError(400, `게시글 본문은 ${MAX_POST_BODY_LENGTH}자 이하로 입력해 주세요.`);
  }

  return {
    slotId,
    title,
    body,
  };
}

function validateCommentInput(input = {}) {
  const body = normalizeString(input.body);

  if (!body) {
    throw createCommunityError(400, "댓글 내용을 입력해 주세요.");
  }

  if (body.length > MAX_COMMENT_LENGTH) {
    throw createCommunityError(400, `댓글은 ${MAX_COMMENT_LENGTH}자 이하로 입력해 주세요.`);
  }

  return { body };
}

function roundWinRate(totalBattles, totalBattlesWon) {
  if (!totalBattles) {
    return 0;
  }

  return Math.round((totalBattlesWon / totalBattles) * 100);
}

function buildCommunitySnapshot(slotData, slotId) {
  const digimonStats = slotData?.digimonStats || {};
  const totalBattles = Number(digimonStats.totalBattles || 0);
  const totalBattlesWon = Number(digimonStats.totalBattlesWon || 0);
  const selectedDigimon = slotData?.selectedDigimon || digimonStats.selectedDigimon || "Digitama";
  const digimonDisplayName =
    normalizeString(slotData?.digimonDisplayName) ||
    normalizeString(slotData?.digimonNickname) ||
    normalizeString(selectedDigimon) ||
    "디지몬";

  return {
    slotId: String(slotId),
    slotName: normalizeString(slotData?.slotName) || `슬롯${slotId}`,
    selectedDigimon,
    digimonDisplayName,
    stageLabel: translateStageLabel(digimonStats.evolutionStage || slotData?.evolutionStage),
    version: normalizeString(slotData?.version) || "Ver.1",
    device: normalizeString(slotData?.device) || "Digital Monster Color 25th",
    weight: Number(digimonStats.weight || 0),
    careMistakes: Number(digimonStats.careMistakes || 0),
    totalBattles,
    totalBattlesWon,
    winRate: roundWinRate(totalBattles, totalBattlesWon),
  };
}

function resolveStageLabel(stage) {
  return translateStageLabel(stage);
}

function validatePostPayload(input = {}, { requireSlotId = true } = {}) {
  const errors = [];
  const title = normalizeString(input.title);
  const body = normalizeString(input.body);
  const rawSlotId = normalizeString(input.slotId);

  if (requireSlotId && !rawSlotId) {
    errors.push("슬롯을 선택해 주세요.");
  }

  if (!title) {
    errors.push("제목을 입력해 주세요.");
  } else if (title.length > MAX_POST_TITLE_LENGTH) {
    errors.push(`제목은 ${MAX_POST_TITLE_LENGTH}자 이하로 입력해 주세요.`);
  }

  if (body.length > MAX_POST_BODY_LENGTH) {
    errors.push(`내용은 ${MAX_POST_BODY_LENGTH}자 이하로 입력해 주세요.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      slotId: rawSlotId,
      title,
      body,
    },
  };
}

function validateCommentPayload(input = {}) {
  const body = normalizeString(input.body);
  const errors = [];

  if (!body) {
    errors.push("댓글 내용을 입력해 주세요.");
  } else if (body.length > MAX_COMMENT_LENGTH) {
    errors.push(`댓글은 ${MAX_COMMENT_LENGTH}자 이하로 입력해 주세요.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: { body },
  };
}

function mapCommentRow(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorUid: row.author_uid,
    authorTamerName: row.author_tamer_name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPostRow(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    authorUid: row.author_uid,
    authorTamerName: row.author_tamer_name,
    slotId: row.slot_id,
    title: row.title,
    body: row.body,
    snapshot: row.snapshot || null,
    commentCount: Number(row.comment_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveAuthorTamerName(db, uid, decodedToken) {
  const userDoc = await db.doc(`users/${uid}`).get();
  const userData = userDoc.exists ? userDoc.data() || {} : {};
  const emailPrefix = decodedToken?.email ? decodedToken.email.split("@")[0] : "";

  return (
    normalizeString(userData.tamerName) ||
    normalizeString(userData.displayName) ||
    normalizeString(decodedToken?.name) ||
    normalizeString(emailPrefix) ||
    `Trainer_${uid.slice(0, 6)}`
  );
}

async function loadUserSlotSnapshot(db, uid, slotId) {
  const slotDoc = await db.doc(`users/${uid}/slots/slot${slotId}`).get();

  if (!slotDoc.exists) {
    throw createCommunityError(404, "선택한 슬롯을 찾을 수 없습니다.");
  }

  return buildCommunitySnapshot(slotDoc.data() || {}, slotId);
}

async function recalculateCommentCount(supabase, postId) {
  const { count, error } = await supabase
    .from(COMMENTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) {
    throw error;
  }

  const nextCommentCount = Number(count || 0);
  const { error: updateError } = await supabase
    .from(POSTS_TABLE)
    .update({
      comment_count: nextCommentCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) {
    throw updateError;
  }

  return nextCommentCount;
}

async function getPostRowOrThrow(supabase, postId) {
  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("*")
    .eq("id", postId)
    .eq("board_id", BOARD_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createCommunityError(404, "게시글을 찾을 수 없습니다.");
  }

  return data;
}

async function listCommunityPosts({ supabase, limit = 24 }) {
  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("*")
    .eq("board_id", BOARD_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map(mapPostRow);
}

async function getCommunityPostDetail({ supabase, postId }) {
  const postRow = await getPostRowOrThrow(supabase, postId);
  const { data: commentRows, error: commentsError } = await supabase
    .from(COMMENTS_TABLE)
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    throw commentsError;
  }

  return {
    post: mapPostRow(postRow),
    comments: (commentRows || []).map(mapCommentRow),
  };
}

async function createCommunityPost({ supabase, db, uid, decodedToken, input }) {
  const { slotId, title, body } = validatePostInput(input);
  const [authorTamerName, snapshot] = await Promise.all([
    resolveAuthorTamerName(db, uid, decodedToken),
    loadUserSlotSnapshot(db, uid, slotId),
  ]);

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .insert({
      board_id: BOARD_ID,
      author_uid: uid,
      author_tamer_name: authorTamerName,
      slot_id: slotId,
      title,
      body,
      snapshot,
      comment_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...mapPostRow(data),
    comments: [],
  };
}

async function updateCommunityPost({ supabase, uid, postId, input }) {
  const postRow = await getPostRowOrThrow(supabase, postId);

  if (postRow.author_uid !== uid) {
    throw createCommunityError(403, "본인 게시글만 수정할 수 있습니다.");
  }

  const { title, body } = validatePostInput({
    ...input,
    slotId: postRow.slot_id,
  });

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .update({
      title,
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPostRow(data);
}

async function deleteCommunityPost({ supabase, uid, postId }) {
  const postRow = await getPostRowOrThrow(supabase, postId);

  if (postRow.author_uid !== uid) {
    throw createCommunityError(403, "본인 게시글만 삭제할 수 있습니다.");
  }

  const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", postId);

  if (error) {
    throw error;
  }

  return {
    deletedPostId: postId,
  };
}

async function createCommunityComment({ supabase, db, uid, decodedToken, postId, input }) {
  await getPostRowOrThrow(supabase, postId);
  const { body } = validateCommentInput(input);
  const authorTamerName = await resolveAuthorTamerName(db, uid, decodedToken);

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .insert({
      post_id: postId,
      author_uid: uid,
      author_tamer_name: authorTamerName,
      body,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const commentCount = await recalculateCommentCount(supabase, postId);

  return {
    comment: mapCommentRow(data),
    commentCount,
  };
}

async function updateCommunityComment({ supabase, uid, commentId, input }) {
  const { body } = validateCommentInput(input);
  const { data: commentRow, error: loadError } = await supabase
    .from(COMMENTS_TABLE)
    .select("*")
    .eq("id", commentId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!commentRow) {
    throw createCommunityError(404, "댓글을 찾을 수 없습니다.");
  }

  if (commentRow.author_uid !== uid) {
    throw createCommunityError(403, "본인 댓글만 수정할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    comment: mapCommentRow(data),
  };
}

async function deleteCommunityComment({ supabase, uid, commentId }) {
  const { data: commentRow, error: loadError } = await supabase
    .from(COMMENTS_TABLE)
    .select("*")
    .eq("id", commentId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!commentRow) {
    throw createCommunityError(404, "댓글을 찾을 수 없습니다.");
  }

  if (commentRow.author_uid !== uid) {
    throw createCommunityError(403, "본인 댓글만 삭제할 수 있습니다.");
  }

  const postId = commentRow.post_id;
  const { error } = await supabase.from(COMMENTS_TABLE).delete().eq("id", commentId);

  if (error) {
    throw error;
  }

  const commentCount = await recalculateCommentCount(supabase, postId);

  return {
    deletedCommentId: commentId,
    postId,
    commentCount,
  };
}

module.exports = {
  BOARD_ID,
  BOARD_ID_SHOWCASE: BOARD_ID,
  COMMENTS_TABLE,
  POSTS_TABLE,
  buildCommunitySnapshot,
  createCommunityComment,
  createCommunityError,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityPostDetail,
  listCommunityPosts,
  mapCommentRow,
  mapPostRow,
  normalizeSlotId,
  resolveStageLabel,
  translateStageLabel,
  updateCommunityComment,
  updateCommunityPost,
  validateCommentPayload,
  validateCommentInput,
  validatePostPayload,
  validatePostInput,
};
