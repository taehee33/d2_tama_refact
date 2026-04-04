"use strict";

const { fetchUserProfile, fetchUserSlot } = require("./firebaseAdmin");

const BOARD_ID = "showcase";
const POSTS_TABLE = "community_posts";
const COMMENTS_TABLE = "community_post_comments";
const PREVIEW_COMMENT_LIMIT = 3;
const MAX_POST_TITLE_LENGTH = 80;
const MAX_POST_BODY_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;
const DEFAULT_BACKGROUND_SETTINGS = {
  selectedId: "default",
  mode: "0",
};
const DEFAULT_SPRITE_BASE_PATH = "/images";
const V2_SPRITE_BASE_PATH = "/Ver2_Mod_Kor";
const BACKGROUND_SPRITES = {
  default: [162, 163, 164],
  desert: [165, 166, 167],
  forest: [168, 169, 170],
  mountain: [171, 172, 173],
  ocean: [174, 175, 176],
  fileisland: [177, 178, 179],
};

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

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function resolveBooleanFlag(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return Boolean(value);
    }
  }

  return false;
}

function normalizeTimestamp(value, fallback = new Date()) {
  const source = value !== undefined && value !== null ? value : fallback;
  const date = source instanceof Date ? source : new Date(source);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  const fallbackDate = fallback instanceof Date ? fallback : new Date(fallback);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate.toISOString();
  }

  return new Date().toISOString();
}

function normalizeBackgroundSettings(backgroundSettings) {
  if (!backgroundSettings || typeof backgroundSettings !== "object") {
    return DEFAULT_BACKGROUND_SETTINGS;
  }

  return {
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...backgroundSettings,
  };
}

function getTimeBasedSpriteIndex(currentTime = new Date()) {
  const date = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const hour = safeDate.getHours();

  if (hour >= 7 && hour < 18) return 0;
  if ((hour >= 5 && hour < 7) || (hour >= 18 && hour < 20)) return 1;
  return 2;
}

function resolveBackgroundNumber(backgroundSettings, currentTime) {
  const settings = normalizeBackgroundSettings(backgroundSettings);
  const sprites = BACKGROUND_SPRITES[settings.selectedId] || BACKGROUND_SPRITES.default;
  const mode = normalizeString(settings.mode) || "0";
  const timeSource = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const safeTimeSource = Number.isNaN(timeSource.getTime()) ? new Date() : timeSource;

  let spriteIndex;
  if (mode === "auto") {
    spriteIndex = getTimeBasedSpriteIndex(safeTimeSource);
  } else {
    spriteIndex = Number.parseInt(mode, 10);
  }

  if (!Number.isInteger(spriteIndex) || spriteIndex < 0 || spriteIndex >= sprites.length) {
    spriteIndex = 0;
  }

  return sprites[spriteIndex];
}

function resolveSpriteBasePath(slotData) {
  const explicitBasePath =
    normalizeString(slotData?.spriteBasePath) || normalizeString(slotData?.digimonStats?.spriteBasePath);

  if (explicitBasePath) {
    return explicitBasePath;
  }

  return normalizeString(slotData?.version) === "Ver.2"
    ? V2_SPRITE_BASE_PATH
    : DEFAULT_SPRITE_BASE_PATH;
}

function resolveSpriteNumber(slotData) {
  return normalizeInteger(
    slotData?.sprite ?? slotData?.digimonStats?.sprite ?? slotData?.spriteNumber,
    0
  );
}

function resolveSleepStatus(slotData, digimonStats) {
  const explicitStatus = normalizeString(slotData?.sleepStatus) || normalizeString(digimonStats?.sleepStatus);

  if (explicitStatus) {
    return explicitStatus;
  }

  if (slotData?.isLightsOn === false || digimonStats?.isLightsOn === false) {
    return "SLEEPING";
  }

  return "AWAKE";
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

function buildCommunitySnapshot(slotData, slotId, options = {}) {
  const digimonStats = slotData?.digimonStats || {};
  const totalBattles = Number(digimonStats.totalBattles || 0);
  const totalBattlesWon = Number(digimonStats.totalBattlesWon || 0);
  const selectedDigimon = slotData?.selectedDigimon || digimonStats.selectedDigimon || "Digitama";
  const recordedAt = normalizeTimestamp(
    options.recordedAt || slotData?.recordedAt || slotData?.updatedAt || slotData?.createdAt
  );
  const currentTime = options.currentTime || recordedAt;
  const digimonDisplayName =
    normalizeString(slotData?.digimonDisplayName) ||
    normalizeString(slotData?.digimonNickname) ||
    normalizeString(selectedDigimon) ||
    "디지몬";
  const spriteBasePath = resolveSpriteBasePath(slotData);
  const spriteNumber = resolveSpriteNumber(slotData);

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
    spriteBasePath,
    spriteNumber,
    backgroundNumber: resolveBackgroundNumber(slotData?.backgroundSettings, currentTime),
    isLightsOn: resolveBooleanFlag(slotData?.isLightsOn, digimonStats?.isLightsOn, true),
    sleepStatus: resolveSleepStatus(slotData, digimonStats),
    poopCount: normalizeInteger(slotData?.poopCount ?? digimonStats.poopCount, 0),
    isFrozen: resolveBooleanFlag(slotData?.isFrozen, digimonStats?.isFrozen, false),
    isDead: resolveBooleanFlag(slotData?.isDead, digimonStats?.isDead, false),
    isInjured: resolveBooleanFlag(slotData?.isInjured, digimonStats?.isInjured, false),
    recordedAt,
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

function buildPreviewCommentsByPostId(rows = [], limit = PREVIEW_COMMENT_LIMIT) {
  return rows.reduce((accumulator, row) => {
    const postId = row.post_id;

    if (!postId) {
      return accumulator;
    }

    const nextComments = accumulator[postId] || [];
    if (nextComments.length >= limit) {
      return accumulator;
    }

    accumulator[postId] = [...nextComments, mapCommentRow(row)];
    return accumulator;
  }, {});
}

async function listPreviewCommentsByPostId(supabase, postIds = []) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .select("*")
    .in("post_id", postIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return buildPreviewCommentsByPostId(data || []);
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

function getFallbackAuthorTamerName(uid, decodedToken) {
  const emailPrefix = decodedToken?.email ? decodedToken.email.split("@")[0] : "";

  return (
    normalizeString(decodedToken?.name) ||
    normalizeString(emailPrefix) ||
    `Trainer_${uid.slice(0, 6)}`
  );
}

async function resolveAuthorTamerName(uid, decodedToken) {
  const fallbackName = getFallbackAuthorTamerName(uid, decodedToken);

  try {
    const userData = (await fetchUserProfile(uid, decodedToken.idToken)) || {};

    return (
      normalizeString(userData.tamerName) ||
      normalizeString(userData.displayName) ||
      fallbackName
    );
  } catch (error) {
    console.warn("[community-api] author profile fallback", {
      uid,
      message: error?.message || String(error),
    });

    return fallbackName;
  }
}

async function loadUserSlotSnapshot(uid, slotId, decodedToken, options = {}) {
  const slotData = await fetchUserSlot(uid, slotId, decodedToken.idToken);

  if (!slotData) {
    throw createCommunityError(404, "선택한 슬롯을 찾을 수 없습니다.");
  }

  return buildCommunitySnapshot(slotData, slotId, options);
}

function buildCommunitySnapshotFromPreview(previewSnapshot, slotId, options = {}) {
  if (!previewSnapshot || typeof previewSnapshot !== "object") {
    throw createCommunityError(500, "슬롯 상태 스냅샷을 준비하지 못했습니다.");
  }

  const previewSlotId = normalizeSlotId(previewSnapshot.slotId || slotId);
  if (previewSlotId !== slotId) {
    throw createCommunityError(400, "선택한 슬롯 정보가 올바르지 않습니다.");
  }

  const visual =
    previewSnapshot.visual && typeof previewSnapshot.visual === "object"
      ? previewSnapshot.visual
      : {};
  const version = normalizeString(previewSnapshot.version) || "Ver.1";
  const totalBattles = normalizeInteger(previewSnapshot.totalBattles, 0);
  const totalBattlesWon = normalizeInteger(previewSnapshot.totalBattlesWon, 0);
  const recordedAt = normalizeTimestamp(
    options.recordedAt || previewSnapshot.recordedAt || visual.recordedAt
  );
  const currentTime = options.currentTime || recordedAt;
  const isLightsOn = resolveBooleanFlag(
    previewSnapshot.isLightsOn,
    visual.isLightsOn,
    true
  );
  const backgroundNumber =
    normalizeInteger(
      previewSnapshot.backgroundNumber ?? visual.backgroundNumber,
      resolveBackgroundNumber(
        previewSnapshot.backgroundSettings || visual.backgroundSettings,
        currentTime
      )
    ) || 162;

  return {
    slotId: String(slotId),
    slotName: normalizeString(previewSnapshot.slotName) || `슬롯${slotId}`,
    selectedDigimon:
      normalizeString(previewSnapshot.selectedDigimon) || "Digitama",
    digimonDisplayName:
      normalizeString(previewSnapshot.digimonDisplayName) || "디지몬",
    stageLabel:
      translateStageLabel(
        normalizeString(previewSnapshot.stageLabel) || "단계 정보 없음"
      ),
    version,
    device:
      normalizeString(previewSnapshot.device) ||
      "Digital Monster Color 25th",
    weight: normalizeInteger(previewSnapshot.weight, 0),
    careMistakes: normalizeInteger(previewSnapshot.careMistakes, 0),
    totalBattles,
    totalBattlesWon,
    winRate:
      totalBattles > 0
        ? roundWinRate(totalBattles, totalBattlesWon)
        : normalizeInteger(previewSnapshot.winRate, 0),
    spriteBasePath:
      normalizeString(previewSnapshot.spriteBasePath) ||
      normalizeString(visual.spriteBasePath) ||
      (version === "Ver.2" ? V2_SPRITE_BASE_PATH : DEFAULT_SPRITE_BASE_PATH),
    spriteNumber: normalizeInteger(
      previewSnapshot.spriteNumber ?? visual.spriteNumber,
      0
    ),
    backgroundNumber,
    isLightsOn,
    sleepStatus:
      normalizeString(previewSnapshot.sleepStatus) ||
      normalizeString(visual.sleepStatus) ||
      (isLightsOn ? "AWAKE" : "SLEEPING"),
    poopCount: normalizeInteger(
      previewSnapshot.poopCount ?? visual.poopCount,
      0
    ),
    isFrozen: resolveBooleanFlag(
      previewSnapshot.isFrozen,
      visual.isFrozen,
      false
    ),
    isDead: resolveBooleanFlag(previewSnapshot.isDead, visual.isDead, false),
    isInjured: resolveBooleanFlag(
      previewSnapshot.isInjured,
      visual.isInjured,
      false
    ),
    recordedAt,
  };
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

  const rows = data || [];
  const previewCommentsByPostId = await listPreviewCommentsByPostId(
    supabase,
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    ...mapPostRow(row),
    previewComments: previewCommentsByPostId[row.id] || [],
  }));
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

async function createCommunityPost({
  supabase,
  uid,
  decodedToken,
  input,
  loadSlotSnapshot = loadUserSlotSnapshot,
  resolveAuthorName = resolveAuthorTamerName,
}) {
  const { slotId, title, body } = validatePostInput(input);
  const snapshotAt = new Date().toISOString();
  const authorTamerName = await resolveAuthorName(uid, decodedToken);
  let snapshot = null;

  try {
    snapshot = await loadSlotSnapshot(uid, slotId, decodedToken, {
      recordedAt: snapshotAt,
      currentTime: snapshotAt,
    });
  } catch (error) {
    console.warn("[community-api] slot snapshot fallback", {
      uid,
      slotId,
      message: error?.message || String(error),
    });

    snapshot = buildCommunitySnapshotFromPreview(input.snapshot, slotId, {
      recordedAt: snapshotAt,
      currentTime: snapshotAt,
    });
  }

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

async function createCommunityComment({ supabase, uid, decodedToken, postId, input }) {
  await getPostRowOrThrow(supabase, postId);
  const { body } = validateCommentInput(input);
  const authorTamerName = await resolveAuthorTamerName(uid, decodedToken);

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
  buildCommunitySnapshotFromPreview,
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
