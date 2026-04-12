import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import News from "./News";

const mockAuthState = {
  currentUser: null,
};

const mockProfile = {
  displayTamerName: "운영팀",
};

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../hooks/useTamerProfile", () => ({
  useTamerProfile: () => mockProfile,
}));

jest.mock("../utils/dateUtils", () => ({
  formatTimestamp: jest.fn((value, format) =>
    format === "long" ? "2026-04-12 12:00:00" : "04/12 12:00"
  ),
}));

jest.mock("../utils/communityApi", () => ({
  getCommunityBoardFeed: jest.fn(),
  getCommunityPostDetail: jest.fn(),
  createCommunityPost: jest.fn(),
  updateCommunityPost: jest.fn(),
  deleteCommunityPost: jest.fn(),
  createCommunityComment: jest.fn(),
  updateCommunityComment: jest.fn(),
  deleteCommunityComment: jest.fn(),
}));

const communityApi = require("../utils/communityApi");

const newsPosts = [
  {
    id: "news-1",
    boardId: "news",
    category: "patch",
    title: "Ver.2.1.0 저장 안정화 패치",
    body: "저장 처리 안정화와 커뮤니티 이미지 개선을 적용했습니다.",
    authorUid: "editor-1",
    authorTamerName: "운영팀",
    commentCount: 2,
    createdAt: "2026-04-12T03:00:00.000Z",
    canManage: true,
    newsContext: {
      summary: "저장 처리 안정화와 커뮤니티 이미지 개선",
      version: "Ver.2.1.0",
      scope: "저장 흐름 · 커뮤니티",
      startsAt: "2026-04-12T03:00:00.000Z",
      endsAt: "2026-04-12T09:00:00.000Z",
      featured: true,
    },
  },
  {
    id: "news-2",
    boardId: "news",
    category: "maintenance",
    title: "점검 안내",
    body: "커뮤니티 배포 점검이 예정되어 있습니다.",
    authorUid: "editor-1",
    authorTamerName: "운영팀",
    commentCount: 0,
    createdAt: "2026-04-11T03:00:00.000Z",
    canManage: true,
    newsContext: {
      scope: "커뮤니티",
      startsAt: "2026-04-13T03:00:00.000Z",
      endsAt: "2026-04-13T05:00:00.000Z",
    },
  },
];

const newsDetail = {
  post: {
    ...newsPosts[0],
    imageUrl: "https://example.com/news.png",
    imageAlt: "패치 대표 이미지",
  },
  comments: [
    {
      id: "comment-1",
      postId: "news-1",
      authorUid: "user-1",
      authorTamerName: "한솔",
      body: "변경점 정리 감사합니다.",
      createdAt: "2026-04-12T04:00:00.000Z",
      updatedAt: "2026-04-12T04:00:00.000Z",
    },
  ],
};

describe("News", () => {
  beforeEach(() => {
    communityApi.getCommunityBoardFeed.mockReset();
    communityApi.getCommunityPostDetail.mockReset();
    communityApi.createCommunityPost.mockReset();
    communityApi.updateCommunityPost.mockReset();
    communityApi.deleteCommunityPost.mockReset();
    communityApi.createCommunityComment.mockReset();
    communityApi.updateCommunityComment.mockReset();
    communityApi.deleteCommunityComment.mockReset();
  });

  test("비로그인 상태에서는 로그인 게이트를 보여 준다", () => {
    mockAuthState.currentUser = null;

    render(<News />);

    expect(screen.getAllByText("소식 피드는 로그인 후 확인할 수 있습니다.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/auth");
  });

  test("로그인한 운영 계정은 대표 소식, 필터, 발행 버튼과 상세를 볼 수 있다", async () => {
    mockAuthState.currentUser = {
      uid: "editor-1",
      getIdToken: jest.fn(),
    };

    communityApi.getCommunityBoardFeed.mockResolvedValue({
      posts: newsPosts,
      viewer: { canCreate: true },
    });
    communityApi.getCommunityPostDetail.mockResolvedValue(newsDetail);

    render(<News />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ver.2.1.0 저장 안정화 패치" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "소식 발행" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "점검" }));
    expect(screen.getByRole("button", { name: "점검 안내" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver.2.1.0 저장 안정화 패치" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver.2.1.0 저장 안정화 패치" }));

    await waitFor(() => {
      expect(screen.getByText("저장 흐름 · 커뮤니티")).toBeInTheDocument();
    });

    expect(screen.getByText("저장 처리 안정화와 커뮤니티 이미지 개선")).toBeInTheDocument();
    expect(screen.getByText("대표 소식")).toBeInTheDocument();
  });
});
