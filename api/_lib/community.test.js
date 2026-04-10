const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_ID_FREE,
  buildCommunitySnapshot,
  listCommunityPosts,
  resolveStageLabel,
  validateCommentPayload,
  validatePostPayload,
} = require("./community");

test("buildCommunitySnapshot generates normalized post snapshot", () => {
  const snapshot = buildCommunitySnapshot(
    {
      slotName: "슬롯1",
      selectedDigimon: "Koromon",
      digimonDisplayName: "깜몬",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      digimonStats: {
        evolutionStage: "Child",
        weight: 12,
        careMistakes: 3,
        totalBattles: 9,
        totalBattlesWon: 6,
      },
    },
    1,
    {
      recordedAt: "2026-04-01T12:00:00.000Z",
      currentTime: "2026-04-01T12:00:00.000Z",
    }
  );

  assert.deepEqual(snapshot, {
    slotId: "1",
    slotName: "슬롯1",
    selectedDigimon: "Koromon",
    digimonDisplayName: "깜몬",
    stageLabel: "성장기",
    version: "Ver.1",
    device: "Digital Monster Color 25th",
    weight: 12,
    careMistakes: 3,
    totalBattles: 9,
    totalBattlesWon: 6,
    winRate: 67,
    spriteBasePath: "/images",
    spriteNumber: 0,
    backgroundNumber: 162,
    isLightsOn: true,
    sleepStatus: "AWAKE",
    poopCount: 0,
    isFrozen: false,
    isDead: false,
    isInjured: false,
    recordedAt: "2026-04-01T12:00:00.000Z",
  });
});

test("listCommunityPosts returns latest 3 preview comments per post", async () => {
  const postRows = [
    {
      id: "post-1",
      board_id: "showcase",
      author_uid: "user-1",
      author_tamer_name: "한솔",
      slot_id: "1",
      title: "첫 글",
      body: "본문",
      snapshot: { digimonDisplayName: "코로몬" },
      comment_count: 4,
      created_at: "2026-04-04T10:00:00.000Z",
      updated_at: "2026-04-04T10:00:00.000Z",
    },
    {
      id: "post-2",
      board_id: "showcase",
      author_uid: "user-2",
      author_tamer_name: "루체",
      slot_id: "2",
      title: "둘째 글",
      body: "둘째 본문",
      snapshot: { digimonDisplayName: "아구몬" },
      comment_count: 1,
      created_at: "2026-04-03T10:00:00.000Z",
      updated_at: "2026-04-03T10:00:00.000Z",
    },
  ];
  const commentRows = [
    {
      id: "comment-4",
      post_id: "post-1",
      author_uid: "user-8",
      author_tamer_name: "넷째",
      body: "네번째 댓글",
      created_at: "2026-04-04T14:00:00.000Z",
      updated_at: "2026-04-04T14:00:00.000Z",
    },
    {
      id: "comment-3",
      post_id: "post-1",
      author_uid: "user-7",
      author_tamer_name: "셋째",
      body: "세번째 댓글",
      created_at: "2026-04-04T13:00:00.000Z",
      updated_at: "2026-04-04T13:00:00.000Z",
    },
    {
      id: "comment-2",
      post_id: "post-1",
      author_uid: "user-6",
      author_tamer_name: "둘째",
      body: "두번째 댓글",
      created_at: "2026-04-04T12:00:00.000Z",
      updated_at: "2026-04-04T12:00:00.000Z",
    },
    {
      id: "comment-1",
      post_id: "post-1",
      author_uid: "user-5",
      author_tamer_name: "첫째",
      body: "첫번째 댓글",
      created_at: "2026-04-04T11:00:00.000Z",
      updated_at: "2026-04-04T11:00:00.000Z",
    },
    {
      id: "comment-5",
      post_id: "post-2",
      author_uid: "user-9",
      author_tamer_name: "손님",
      body: "둘째 글 댓글",
      created_at: "2026-04-03T11:00:00.000Z",
      updated_at: "2026-04-03T11:00:00.000Z",
    },
  ];

  const supabase = {
    from(table) {
      if (table === "community_posts") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit: async () => ({
                        data: postRows,
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "community_post_comments") {
        return {
          select() {
            return {
              in() {
                return {
                  order: async () => ({
                    data: commentRows,
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "community-post-images");

        return {
          getPublicUrl(path) {
            return {
              data: {
                publicUrl: `https://example.com/storage/${path}`,
              },
            };
          },
        };
      },
    },
  };

  const posts = await listCommunityPosts({ supabase });

  assert.equal(posts[0].commentCount, 4);
  assert.deepEqual(
    posts[0].previewComments.map((comment) => comment.body),
    ["네번째 댓글", "세번째 댓글", "두번째 댓글"]
  );
  assert.deepEqual(
    posts[0].previewComments.map((comment) => comment.authorTamerName),
    ["넷째", "셋째", "둘째"]
  );
  assert.equal(posts[1].previewComments.length, 1);
  assert.equal(posts[1].previewComments[0].body, "둘째 글 댓글");
});

test("listCommunityPosts resolves free board image url when image_path exists", async () => {
  const supabase = {
    from(table) {
      if (table === "community_posts") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit: async () => ({
                        data: [
                          {
                            id: "free-1",
                            board_id: "free",
                            category: "general",
                            author_uid: "user-1",
                            author_tamer_name: "한솔",
                            slot_id: null,
                            title: "이미지 자유글",
                            body: "본문",
                            snapshot: null,
                            image_path: "free/user-1/post-1/image.png",
                            comment_count: 0,
                            created_at: "2026-04-04T10:00:00.000Z",
                            updated_at: "2026-04-04T10:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "community_post_comments") {
        return {
          select() {
            return {
              in() {
                return {
                  order: async () => ({
                    data: [],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "community-post-images");

        return {
          getPublicUrl(path) {
            return {
              data: {
                publicUrl: `https://example.com/storage/${path}`,
              },
            };
          },
        };
      },
    },
  };

  const posts = await listCommunityPosts({
    supabase,
    boardId: BOARD_ID_FREE,
  });

  assert.equal(posts[0].imagePath, "free/user-1/post-1/image.png");
  assert.equal(
    posts[0].imageUrl,
    "https://example.com/storage/free/user-1/post-1/image.png"
  );
});

test("resolveStageLabel supports legacy stage aliases", () => {
  assert.equal(resolveStageLabel("Baby1"), "유년기 I");
  assert.equal(resolveStageLabel("Baby II"), "유년기 II");
});

test("validatePostPayload requires title and slot", () => {
  const validation = validatePostPayload({ title: " ", slotId: "", body: "" });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["슬롯을 선택해 주세요.", "제목을 입력해 주세요."]);
});

test("validatePostPayload supports free board category validation", () => {
  const invalidValidation = validatePostPayload(
    { category: "", title: "자유글", body: "본문" },
    { boardId: BOARD_ID_FREE }
  );
  const validValidation = validatePostPayload(
    { category: "question", title: "자유글", body: "본문" },
    { boardId: BOARD_ID_FREE }
  );

  assert.equal(invalidValidation.isValid, false);
  assert.deepEqual(invalidValidation.errors, ["말머리를 선택해 주세요."]);
  assert.equal(validValidation.isValid, true);
  assert.equal(validValidation.value.category, "question");
});

test("validateCommentPayload requires non-empty body", () => {
  const validation = validateCommentPayload({ body: " " });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["댓글 내용을 입력해 주세요."]);
});

test("listCommunityPosts filters by free board category when requested", async () => {
  const state = {
    boardId: "",
    category: "",
  };

  const supabase = {
    from(table) {
      if (table === "community_posts") {
        return {
          select() {
            return {
              eq(column, value) {
                if (column === "board_id") {
                  state.boardId = value;
                  return {
                    eq(nextColumn, nextValue) {
                      state.category = `${nextColumn}:${nextValue}`;
                      return {
                        order() {
                          return {
                            limit: async () => ({
                              data: [],
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                    order() {
                      return {
                        limit: async () => ({
                          data: [],
                          error: null,
                        }),
                      };
                    },
                  };
                }

                throw new Error(`Unexpected column: ${column}`);
              },
            };
          },
        };
      }

      if (table === "community_post_comments") {
        return {
          select() {
            return {
              in() {
                return {
                  order: async () => ({
                    data: [],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  await listCommunityPosts({
    supabase,
    boardId: BOARD_ID_FREE,
    category: "question",
  });

  assert.equal(state.boardId, "free");
  assert.equal(state.category, "category:question");
});
