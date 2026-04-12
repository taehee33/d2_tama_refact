"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_ID_FREE,
  BOARD_ID_NEWS,
  BOARD_ID_SUPPORT,
  buildCommunitySnapshot,
  buildCommunitySnapshotFromPreview,
  createCommunityPost,
  normalizeSlotId,
  translateStageLabel,
  validateCommentInput,
  validatePostInput,
} = require("../api/_lib/community");

function createSupabaseInsertStub() {
  const state = {
    insertedPayload: null,
    removedPaths: [],
    uploadedPaths: [],
  };

  const builder = {
    insert(payload) {
      state.insertedPayload = payload;
      return builder;
    },
    select() {
      return builder;
    },
    async single() {
      return {
        data: {
          id: "post-1",
          board_id: state.insertedPayload.board_id,
          category: state.insertedPayload.category,
          author_uid: state.insertedPayload.author_uid,
          author_tamer_name: state.insertedPayload.author_tamer_name,
          slot_id: state.insertedPayload.slot_id,
          title: state.insertedPayload.title,
          body: state.insertedPayload.body,
          snapshot: state.insertedPayload.snapshot,
          support_context: state.insertedPayload.support_context,
          news_context: state.insertedPayload.news_context,
          image_path: state.insertedPayload.image_path,
          comment_count: state.insertedPayload.comment_count,
          created_at: "2026-04-01T12:00:00.000Z",
          updated_at: "2026-04-01T12:00:00.000Z",
        },
        error: null,
      };
    },
  };

  return {
    state,
    supabase: {
      from(tableName) {
        assert.equal(tableName, "community_posts");
        return builder;
      },
      storage: {
        from(bucketName) {
          assert.equal(bucketName, "community-post-images");

          return {
            async upload(path) {
              state.uploadedPaths.push(path);
              return {
                data: { path },
                error: null,
              };
            },
            getPublicUrl(path) {
              return {
                data: {
                  publicUrl: `https://example.com/storage/${path}`,
                },
              };
            },
            async remove(paths) {
              state.removedPaths.push(...paths);
              return {
                data: paths,
                error: null,
              };
            },
          };
        },
      },
    },
  };
}

test("normalizeSlotId는 slot 접두사와 숫자 문자열을 모두 허용한다", () => {
  assert.equal(normalizeSlotId("slot7"), 7);
  assert.equal(normalizeSlotId("3"), 3);
  assert.equal(normalizeSlotId(2), 2);
});

test("buildCommunitySnapshot은 슬롯 문서에서 커뮤니티 스냅샷을 만든다", () => {
  const snapshot = buildCommunitySnapshot(
    {
      slotName: "슬롯1",
      selectedDigimon: "Koromon",
      digimonDisplayName: "코로몬",
      version: "Ver.2",
      device: "Digital Monster Color 25th",
      backgroundSettings: {
        selectedId: "forest",
        mode: "auto",
      },
      isLightsOn: false,
      sleepStatus: "SLEEPING",
      poopCount: 6,
      isFrozen: true,
      isDead: false,
      isInjured: true,
      sprite: 211,
      digimonStats: {
        evolutionStage: "Child",
        weight: 14,
        careMistakes: 2,
        totalBattles: 7,
        totalBattlesWon: 5,
        spriteBasePath: "/Ver2_Mod_Kor",
      },
    },
    1,
    {
      recordedAt: "2026-04-01T03:05:00.000Z",
      currentTime: "2026-04-01T03:05:00.000Z",
    }
  );

  assert.deepEqual(snapshot, {
    slotId: "1",
    slotName: "슬롯1",
    selectedDigimon: "Koromon",
    digimonDisplayName: "코로몬",
    stageLabel: "성장기",
    version: "Ver.2",
    device: "Digital Monster Color 25th",
    weight: 14,
    careMistakes: 2,
    totalBattles: 7,
    totalBattlesWon: 5,
    winRate: 71,
    spriteBasePath: "/Ver2_Mod_Kor",
    spriteNumber: 211,
    backgroundNumber: 168,
    isLightsOn: false,
    sleepStatus: "SLEEPING",
    poopCount: 6,
    isFrozen: true,
    isDead: false,
    isInjured: true,
    recordedAt: "2026-04-01T03:05:00.000Z",
  });
});

test("검증 헬퍼는 글/댓글 길이와 필수값을 확인한다", () => {
  assert.deepEqual(
    validatePostInput({
      slotId: "slot2",
      title: " 내 디지몬 근황 ",
      body: " 오늘 첫 완전체가 됐어요. ",
    }),
    {
      boardId: "showcase",
      slotId: 2,
      title: "내 디지몬 근황",
      body: "오늘 첫 완전체가 됐어요.",
    }
  );

  assert.deepEqual(
    validatePostInput(
      {
        category: "guide",
        title: " 자유게시판 공략 ",
        body: " 루틴 메모입니다. ",
      },
      { boardId: BOARD_ID_FREE }
    ),
    {
      boardId: "free",
      category: "guide",
      title: "자유게시판 공략",
      body: "루틴 메모입니다.",
      newsContext: null,
      supportContext: null,
    }
  );

  assert.deepEqual(
    validatePostInput(
      {
        category: "bug",
        title: " 버그 제보 ",
        body: " 저장 후 화면이 멈춥니다. ",
        supportContext: {
          slotNumber: " 1 ",
          screenPath: " /play/1 ",
          gameVersion: "Ver.2",
        },
      },
      { boardId: BOARD_ID_SUPPORT }
    ),
    {
      boardId: "support",
      category: "bug",
      title: "버그 제보",
      body: "저장 후 화면이 멈춥니다.",
      newsContext: null,
      supportContext: {
        slotNumber: "1",
        screenPath: "/play/1",
        gameVersion: "Ver.2",
      },
    }
  );

  assert.deepEqual(validateCommentInput({ body: " 축하합니다! " }), {
    body: "축하합니다!",
  });

  assert.equal(translateStageLabel("Baby1"), "유년기 I");
});

test("buildCommunitySnapshotFromPreview는 허용 필드만 정규화한다", () => {
  const snapshot = buildCommunitySnapshotFromPreview(
    {
      slotId: "2",
      slotName: "슬롯2",
      selectedDigimon: "Punimon",
      digimonDisplayName: "푸니몬",
      stageLabel: "유년기 I",
      version: "Ver.2",
      device: "Digital Monster Color 25th",
      weight: 5,
      careMistakes: 0,
      totalBattles: 0,
      totalBattlesWon: 0,
      visual: {
        spriteBasePath: "/Ver2_Mod_Kor",
        spriteNumber: 8,
        backgroundNumber: 168,
        isLightsOn: true,
        sleepStatus: "AWAKE",
        poopCount: 0,
        isFrozen: false,
        isDead: false,
        isInjured: false,
      },
    },
    2,
    {
      recordedAt: "2026-04-01T12:00:00.000Z",
      currentTime: "2026-04-01T12:00:00.000Z",
    }
  );

  assert.deepEqual(snapshot, {
    slotId: "2",
    slotName: "슬롯2",
    selectedDigimon: "Punimon",
    digimonDisplayName: "푸니몬",
    stageLabel: "유년기 I",
    version: "Ver.2",
    device: "Digital Monster Color 25th",
    weight: 5,
    careMistakes: 0,
    totalBattles: 0,
    totalBattlesWon: 0,
    winRate: 0,
    spriteBasePath: "/Ver2_Mod_Kor",
    spriteNumber: 8,
    backgroundNumber: 168,
    isLightsOn: true,
    sleepStatus: "AWAKE",
    poopCount: 0,
    isFrozen: false,
    isDead: false,
    isInjured: false,
    recordedAt: "2026-04-01T12:00:00.000Z",
  });
});

test("createCommunityPost는 서버 슬롯 재조회 성공 시 해당 스냅샷을 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();

  await createCommunityPost({
    supabase,
    uid: "user-1",
    decodedToken: {
      uid: "user-1",
      email: "han@example.com",
      name: "한솔",
      idToken: "token-123",
    },
    input: {
      slotId: "1",
      title: "서버 스냅샷 테스트",
      body: "본문",
    },
    resolveAuthorName: async () => "한솔",
    loadSlotSnapshot: async () => ({
      slotId: "1",
      slotName: "슬롯1",
      selectedDigimon: "Koromon",
      digimonDisplayName: "코로몬",
      stageLabel: "성장기",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      weight: 12,
      careMistakes: 1,
      totalBattles: 4,
      totalBattlesWon: 3,
      winRate: 75,
      spriteBasePath: "/images",
      spriteNumber: 6,
      backgroundNumber: 162,
      isLightsOn: true,
      sleepStatus: "AWAKE",
      poopCount: 0,
      isFrozen: false,
      isDead: false,
      isInjured: false,
      recordedAt: "2026-04-01T12:00:00.000Z",
    }),
  });

  assert.equal(state.insertedPayload.slot_id, 1);
  assert.equal(state.insertedPayload.author_tamer_name, "한솔");
  assert.equal(state.insertedPayload.snapshot.digimonDisplayName, "코로몬");
});

test("createCommunityPost는 재조회 실패 시 preview snapshot으로 폴백 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();

  await createCommunityPost({
    supabase,
    uid: "user-1",
    decodedToken: {
      uid: "user-1",
      email: "han@example.com",
      name: "한솔",
      idToken: "token-123",
    },
    input: {
      slotId: "2",
      title: "폴백 스냅샷 테스트",
      body: "본문",
      snapshot: {
        slotId: "2",
        slotName: "슬롯2",
        selectedDigimon: "Punimon",
        digimonDisplayName: "푸니몬",
        stageLabel: "유년기 I",
        version: "Ver.2",
        device: "Digital Monster Color 25th",
        weight: 5,
        careMistakes: 0,
        totalBattles: 0,
        totalBattlesWon: 0,
        visual: {
          spriteBasePath: "/Ver2_Mod_Kor",
          spriteNumber: 8,
          backgroundNumber: 168,
          isLightsOn: true,
          sleepStatus: "AWAKE",
          poopCount: 0,
          isFrozen: false,
          isDead: false,
          isInjured: false,
        },
      },
    },
    resolveAuthorName: async () => "한솔",
    loadSlotSnapshot: async () => {
      throw new Error("Firestore 문서를 불러오지 못했습니다.");
    },
  });

  assert.equal(state.insertedPayload.snapshot.slotName, "슬롯2");
  assert.equal(state.insertedPayload.snapshot.backgroundNumber, 168);
  assert.equal(state.insertedPayload.snapshot.spriteBasePath, "/Ver2_Mod_Kor");
});

test("createCommunityPost는 잘못된 preview snapshot이면 거부한다", async () => {
  const { supabase } = createSupabaseInsertStub();

  await assert.rejects(
    createCommunityPost({
      supabase,
      uid: "user-1",
      decodedToken: {
        uid: "user-1",
        email: "han@example.com",
        name: "한솔",
        idToken: "token-123",
      },
      input: {
        slotId: "2",
        title: "잘못된 스냅샷 테스트",
        body: "본문",
        snapshot: {
          slotId: "3",
          slotName: "슬롯3",
        },
      },
      resolveAuthorName: async () => "한솔",
      loadSlotSnapshot: async () => {
        throw new Error("Firestore 문서를 불러오지 못했습니다.");
      },
    }),
    /선택한 슬롯 정보가 올바르지 않습니다\./
  );
});

test("createCommunityPost는 자유게시판 글을 slot/snapshot 없이 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();

  await createCommunityPost({
    supabase,
    boardId: BOARD_ID_FREE,
    uid: "user-1",
    decodedToken: {
      uid: "user-1",
      email: "han@example.com",
      name: "한솔",
      idToken: "token-123",
    },
    input: {
      category: "guide",
      title: "공략 메모",
      body: "아침 루틴을 기록합니다.",
    },
    resolveAuthorName: async () => "한솔",
  });

  assert.equal(state.insertedPayload.board_id, "free");
  assert.equal(state.insertedPayload.category, "guide");
  assert.equal(state.insertedPayload.slot_id, null);
  assert.equal(state.insertedPayload.snapshot, null);
  assert.equal(state.insertedPayload.image_path, null);
});

test("createCommunityPost는 자유게시판 첨부 이미지를 storage에 올리고 image_path를 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();

  const post = await createCommunityPost({
    supabase,
    boardId: BOARD_ID_FREE,
    uid: "user-1",
    decodedToken: {
      uid: "user-1",
      email: "han@example.com",
      name: "한솔",
      idToken: "token-123",
    },
    input: {
      category: "general",
      title: "이미지 첨부 자유글",
      body: "본문",
      image: {
        fileName: "free-post.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
      },
    },
    resolveAuthorName: async () => "한솔",
  });

  assert.equal(state.uploadedPaths.length, 1);
  assert.match(state.uploadedPaths[0], /^free\/user-1\/.+\.png$/);
  assert.equal(state.insertedPayload.image_path, state.uploadedPaths[0]);
  assert.equal(post.imagePath, state.uploadedPaths[0]);
  assert.equal(
    post.imageUrl,
    `https://example.com/storage/${state.uploadedPaths[0]}`
  );
});

test("createCommunityPost는 support 글을 supportContext와 이미지와 함께 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();

  const post = await createCommunityPost({
    supabase,
    boardId: BOARD_ID_SUPPORT,
    uid: "user-1",
    decodedToken: {
      uid: "user-1",
      email: "han@example.com",
      name: "한솔",
      idToken: "token-123",
    },
    input: {
      category: "bug",
      title: "support 이미지 제보",
      body: "재현 화면을 첨부합니다.",
      supportContext: {
        slotNumber: "1",
        screenPath: "/play/1",
        gameVersion: "Ver.1",
      },
      image: {
        fileName: "support-post.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
      },
    },
    resolveAuthorName: async () => "한솔",
  });

  assert.equal(state.insertedPayload.board_id, "support");
  assert.equal(state.insertedPayload.category, "bug");
  assert.deepEqual(state.insertedPayload.support_context, {
    slotNumber: "1",
    screenPath: "/play/1",
    gameVersion: "Ver.1",
  });
  assert.equal(state.insertedPayload.slot_id, null);
  assert.equal(state.insertedPayload.snapshot, null);
  assert.match(state.uploadedPaths[0], /^support\/user-1\/.+\.png$/);
  assert.equal(post.supportContext.screenPath, "/play/1");
  assert.equal(post.imagePath, state.uploadedPaths[0]);
});

test("createCommunityPost는 news 글을 newsContext와 이미지와 함께 저장한다", async () => {
  const { supabase, state } = createSupabaseInsertStub();
  const previousUids = process.env.NEWS_EDITOR_UIDS;
  const previousEmails = process.env.NEWS_EDITOR_EMAILS;
  process.env.NEWS_EDITOR_UIDS = "editor-1";
  process.env.NEWS_EDITOR_EMAILS = "";

  const post = await createCommunityPost({
    supabase,
    boardId: BOARD_ID_NEWS,
    uid: "editor-1",
    decodedToken: {
      uid: "editor-1",
      email: "editor@example.com",
      name: "운영팀",
      idToken: "token-123",
    },
    input: {
      category: "patch",
      title: "패치 노트",
      body: "저장 안정화 패치를 적용했습니다.",
      newsContext: {
        summary: "저장 처리 안정화",
        version: "Ver.2.1.0",
        scope: "저장 흐름",
        startsAt: "2026-04-12T12:00",
        endsAt: "2026-04-12T18:00",
        featured: true,
      },
      image: {
        fileName: "news-post.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
      },
    },
    resolveAuthorName: async () => "운영팀",
  });

  assert.equal(state.insertedPayload.board_id, "news");
  assert.equal(state.insertedPayload.category, "patch");
  assert.deepEqual(state.insertedPayload.news_context, {
    summary: "저장 처리 안정화",
    version: "Ver.2.1.0",
    scope: "저장 흐름",
    startsAt: "2026-04-12T03:00:00.000Z",
    endsAt: "2026-04-12T09:00:00.000Z",
    featured: true,
  });
  assert.match(state.uploadedPaths[0], /^news\/editor-1\/.+\.png$/);
  assert.equal(post.newsContext.version, "Ver.2.1.0");
  assert.equal(post.canManage, false);

  process.env.NEWS_EDITOR_UIDS = previousUids;
  process.env.NEWS_EDITOR_EMAILS = previousEmails;
});

test("createCommunityPost는 news 발행 권한이 없으면 거부한다", async () => {
  const { supabase } = createSupabaseInsertStub();
  const previousUids = process.env.NEWS_EDITOR_UIDS;
  const previousEmails = process.env.NEWS_EDITOR_EMAILS;
  process.env.NEWS_EDITOR_UIDS = "";
  process.env.NEWS_EDITOR_EMAILS = "";

  await assert.rejects(
    createCommunityPost({
      supabase,
      boardId: BOARD_ID_NEWS,
      uid: "user-1",
      decodedToken: {
        uid: "user-1",
        email: "user@example.com",
        name: "일반유저",
        idToken: "token-123",
      },
      input: {
        category: "notice",
        title: "공지",
        body: "본문",
      },
      resolveAuthorName: async () => "일반유저",
    }),
    /소식 발행 권한이 없습니다\./
  );

  process.env.NEWS_EDITOR_UIDS = previousUids;
  process.env.NEWS_EDITOR_EMAILS = previousEmails;
});
