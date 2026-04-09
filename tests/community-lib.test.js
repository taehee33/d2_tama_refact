"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_ID_FREE,
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
});
