import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const mockAuthState = {
  currentUser: null,
};

const mockProfile = {
  displayTamerName: "한솔",
  maxSlots: 10,
};

const mockSlotsState = {
  slots: [],
  loading: false,
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

jest.mock("../hooks/useUserSlots", () => ({
  __esModule: true,
  default: () => mockSlotsState,
}));

jest.mock("../utils/dateUtils", () => ({
  formatTimestamp: jest.fn(() => "4월 1일 09:00"),
}));

jest.mock("../utils/communityApi", () => ({
  listShowcasePosts: jest.fn(),
  getShowcasePostDetail: jest.fn(),
  createShowcasePost: jest.fn(),
  updateShowcasePost: jest.fn(),
  deleteShowcasePost: jest.fn(),
  createShowcaseComment: jest.fn(),
  updateShowcaseComment: jest.fn(),
  deleteShowcaseComment: jest.fn(),
}));

const communityApi = require("../utils/communityApi");
const Community = require("./Community").default;

describe("Community", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockSlotsState.slots = [];
    mockSlotsState.loading = false;
    Object.values(communityApi).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === "function") {
        mockFn.mockReset();
      }
    });
  });

  it("비로그인 상태에서는 샘플 피드만 보여 준다", () => {
    render(<Community />);

    expect(screen.getByText("로그인 전에는 샘플 글만 볼 수 있습니다")).toBeInTheDocument();
    expect(screen.getByText("오늘은 배틀 승률 70%를 넘겼어요")).toBeInTheDocument();
    expect(screen.queryByText("내 슬롯에서 글 만들기")).not.toBeInTheDocument();
  });

  it("로그인 상태에서는 실제 피드와 작성 패널을 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockSlotsState.slots = [
      {
        id: 1,
        slotName: "슬롯1",
        digimonDisplayName: "코로몬",
        selectedDigimon: "Koromon",
        version: "Ver.1",
        device: "Digital Monster Color 25th",
        digimonStats: {
          weight: 12,
          careMistakes: 0,
          totalBattles: 4,
          totalBattlesWon: 3,
        },
      },
    ];

    communityApi.listShowcasePosts.mockResolvedValue([
      {
        id: "post-1",
        title: "서버에서 불러온 글",
        body: "실제 커뮤니티 글입니다.",
        authorUid: "user-1",
        authorTamerName: "한솔",
        commentCount: 1,
        createdAt: "2026-04-01T00:00:00.000Z",
        snapshot: {
          slotName: "슬롯1",
          digimonDisplayName: "코로몬",
          stageLabel: "성장기",
          version: "Ver.1",
          weight: 12,
          careMistakes: 0,
          winRate: 75,
        },
      },
    ]);
    communityApi.getShowcasePostDetail.mockResolvedValue({
      post: {
        id: "post-1",
        title: "서버에서 불러온 글",
        body: "실제 커뮤니티 글입니다.",
        authorUid: "user-1",
        authorTamerName: "한솔",
        commentCount: 1,
        createdAt: "2026-04-01T00:00:00.000Z",
        snapshot: {
          slotName: "슬롯1",
          digimonDisplayName: "코로몬",
          stageLabel: "성장기",
          version: "Ver.1",
          weight: 12,
          careMistakes: 0,
          winRate: 75,
        },
      },
      comments: [],
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("서버에서 불러온 글")).toBeInTheDocument();
    });
    expect(screen.getByText("내 슬롯에서 글 만들기")).toBeInTheDocument();
    expect(screen.getByText("게시글 상세")).toBeInTheDocument();
  });
});
