import {
  createCommunityPost,
  createShowcasePost,
  getCommunityBoardFeed,
  listCommunityPosts,
} from "./communityApi";

describe("communityApi", () => {
  const currentUser = {
    getIdToken: jest.fn().mockResolvedValue("token-123"),
  };

  beforeEach(() => {
    currentUser.getIdToken.mockReset();
    currentUser.getIdToken.mockResolvedValue("token-123");
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("중첩된 error.message를 우선 노출한다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            message: "선택한 슬롯을 찾을 수 없습니다.",
          },
        })
      ),
    });

    await expect(
      createShowcasePost(currentUser, {
        slotId: "1",
        title: "테스트",
        body: "본문",
      })
    ).rejects.toThrow("선택한 슬롯을 찾을 수 없습니다.");
  });

  it("HTML 404 응답이면 로컬 개발용 안내 메시지로 바꾼다", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue("<!doctype html><html><body>Not Found</body></html>"),
    });

    await expect(
      createShowcasePost(currentUser, {
        slotId: "1",
        title: "테스트",
        body: "본문",
      })
    ).rejects.toThrow("커뮤니티 API 경로를 찾지 못했습니다.");
  });

  it("자유게시판 목록 조회는 category query를 붙여 요청한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ posts: [] })),
    });

    await listCommunityPosts(currentUser, "free", { category: "question" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/free/posts?category=question",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      })
    );
  });

  it("support 목록 조회도 category query를 붙여 요청한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ posts: [] })),
    });

    await listCommunityPosts(currentUser, "support", { category: "bug" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/support/posts?category=bug",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      })
    );
  });

  it("소식 피드 조회는 viewer meta를 함께 돌려준다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          posts: [{ id: "news-1", title: "공지" }],
          viewer: { canCreate: true },
        })
      ),
    });

    await expect(getCommunityBoardFeed(currentUser, "news")).resolves.toEqual({
      posts: [{ id: "news-1", title: "공지" }],
      viewer: { canCreate: true },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/news/posts",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("목록 응답 payload가 null이어도 빈 배열로 처리한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("null"),
    });

    await expect(listCommunityPosts(currentUser, "support")).resolves.toEqual([]);
  });

  it("자유게시판 글 작성은 boardId 기반 경로를 사용한다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(JSON.stringify({ post: { id: "free-1" } })),
    });

    await createCommunityPost(currentUser, "free", {
      category: "guide",
      title: "자유글",
      body: "본문",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/free/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          category: "guide",
          title: "자유글",
          body: "본문",
        }),
      })
    );
  });

  it("자유게시판 이미지 첨부 글 작성은 image payload를 그대로 JSON으로 보낸다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(JSON.stringify({ post: { id: "free-image-1" } })),
    });

    await createCommunityPost(currentUser, "free", {
      category: "general",
      title: "이미지 첨부",
      body: "본문",
      image: {
        fileName: "post.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZQ==",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/free/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          category: "general",
          title: "이미지 첨부",
          body: "본문",
          image: {
            fileName: "post.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,ZmFrZQ==",
          },
        }),
      })
    );
  });

  it("support 글 작성은 supportContext와 image payload를 함께 보낸다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(JSON.stringify({ post: { id: "support-1" } })),
    });

    await createCommunityPost(currentUser, "support", {
      category: "bug",
      title: "저장 후 데이터가 사라집니다",
      body: "재현 순서를 적었습니다.",
      supportContext: {
        slotNumber: "1",
        screenPath: "/play/1",
        gameVersion: "Ver.2",
      },
      image: {
        fileName: "bug.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZQ==",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/support/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          category: "bug",
          title: "저장 후 데이터가 사라집니다",
          body: "재현 순서를 적었습니다.",
          supportContext: {
            slotNumber: "1",
            screenPath: "/play/1",
            gameVersion: "Ver.2",
          },
          image: {
            fileName: "bug.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,ZmFrZQ==",
          },
        }),
      })
    );
  });

  it("소식 작성은 newsContext와 image payload를 함께 보낸다", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(JSON.stringify({ post: { id: "news-1" } })),
    });

    await createCommunityPost(currentUser, "news", {
      category: "patch",
      title: "Ver.2.1.0 패치 안내",
      body: "저장 안정화 패치를 적용했습니다.",
      newsContext: {
        summary: "저장 처리 안정화와 커뮤니티 이미지 개선",
        version: "Ver.2.1.0",
        scope: "저장 흐름 · 커뮤니티",
        startsAt: "2026-04-12T12:00",
        endsAt: "2026-04-12T18:00",
        featured: true,
      },
      image: {
        fileName: "patch.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZQ==",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/community/news/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          category: "patch",
          title: "Ver.2.1.0 패치 안내",
          body: "저장 안정화 패치를 적용했습니다.",
          newsContext: {
            summary: "저장 처리 안정화와 커뮤니티 이미지 개선",
            version: "Ver.2.1.0",
            scope: "저장 흐름 · 커뮤니티",
            startsAt: "2026-04-12T12:00",
            endsAt: "2026-04-12T18:00",
            featured: true,
          },
          image: {
            fileName: "patch.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,ZmFrZQ==",
          },
        }),
      })
    );
  });
});
