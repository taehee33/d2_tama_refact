const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCommentItemHandler,
  createPostCommentsHandler,
  createPostItemHandler,
  createPostsCollectionHandler,
} = require("./communityHandlers");

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end() {
      if (arguments.length > 0) {
        const [payload] = arguments;
        this.body = typeof payload === "string" ? JSON.parse(payload) : payload;
      }
      this.ended = true;
    },
  };
}

test("posts handler rejects missing auth token", async () => {
  const handler = createPostsCollectionHandler({
    verifyFirebaseToken: async () => ({ uid: "user-1" }),
    getUserProfile: async () => ({ tamerName: "히히히" }),
    getUserSlot: async () => ({}),
    getSupabaseAdminClient: () => ({}),
    listShowcasePosts: async () => [],
    createShowcasePost: async () => ({}),
  });

  const res = createMockRes();
  await handler({ method: "GET", headers: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "unauthorized");
});

test("post create rejects slot that does not belong to current user", async () => {
  const handler = createPostsCollectionHandler({
    verifyFirebaseToken: async () => ({ uid: "user-1" }),
    getUserProfile: async () => ({ tamerName: "히히히" }),
    getUserSlot: async () => null,
    getSupabaseAdminClient: () => ({}),
    listShowcasePosts: async () => [],
    createShowcasePost: async () => {
      throw new Error("should not be called");
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { slotId: "1", title: "오늘의 자랑", body: "본문" },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "slot_not_owned");
});

test("post update rejects non-author", async () => {
  const handler = createPostItemHandler({
    verifyFirebaseToken: async () => ({ uid: "user-2" }),
    getSupabaseAdminClient: () => ({}),
    getShowcasePostById: async () => ({
      id: "post-1",
      authorUid: "user-1",
    }),
    getShowcasePostDetail: async () => ({}),
    updateShowcasePost: async () => {
      throw new Error("should not be called");
    },
    deleteShowcasePost: async () => {
      throw new Error("should not be called");
    },
  });

  const res = createMockRes();
  await handler(
    {
      method: "PATCH",
      headers: { authorization: "Bearer test-token" },
      query: { postId: "post-1" },
      body: { title: "수정", body: "내용" },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "forbidden");
});

test("comment create returns synced comment count", async () => {
  const handler = createPostCommentsHandler({
    verifyFirebaseToken: async () => ({ uid: "user-1" }),
    getUserProfile: async () => ({ tamerName: "히히히" }),
    getSupabaseAdminClient: () => ({}),
    getShowcasePostById: async () => ({ id: "post-1" }),
    createComment: async () => ({
      id: "comment-1",
      postId: "post-1",
      authorUid: "user-1",
      authorTamerName: "히히히",
      body: "좋아요",
    }),
    syncCommentCount: async () => 3,
  });

  const res = createMockRes();
  await handler(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      query: { postId: "post-1" },
      body: { body: "좋아요" },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.commentCount, 3);
  assert.equal(res.body.comment.id, "comment-1");
});

test("comment update rejects non-author", async () => {
  const handler = createCommentItemHandler({
    verifyFirebaseToken: async () => ({ uid: "user-2" }),
    getSupabaseAdminClient: () => ({}),
    getCommentById: async () => ({
      id: "comment-1",
      authorUid: "user-1",
      postId: "post-1",
    }),
    updateComment: async () => {
      throw new Error("should not be called");
    },
    deleteComment: async () => {
      throw new Error("should not be called");
    },
    syncCommentCount: async () => 0,
  });

  const res = createMockRes();
  await handler(
    {
      method: "PATCH",
      headers: { authorization: "Bearer test-token" },
      query: { commentId: "comment-1" },
      body: { body: "수정" },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "forbidden");
});
