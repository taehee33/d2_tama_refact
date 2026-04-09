import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/community",
  search: "",
};

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
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
  formatTimestamp: jest.fn(() => "04/01 09:00"),
}));

jest.mock("../utils/communityApi", () => ({
  listCommunityPosts: jest.fn(),
  getCommunityPostDetail: jest.fn(),
  createCommunityPost: jest.fn(),
  updateCommunityPost: jest.fn(),
  deleteCommunityPost: jest.fn(),
  createCommunityComment: jest.fn(),
  updateCommunityComment: jest.fn(),
  deleteCommunityComment: jest.fn(),
}));

const communityApi = require("../utils/communityApi");
const Community = require("./Community").default;

const showcasePosts = [
  {
    id: "showcase-1",
    boardId: "showcase",
    slotId: "1",
    title: "서버에서 불러온 자랑 글",
    body: "실제 커뮤니티 글입니다.",
    authorUid: "user-1",
    authorTamerName: "한솔",
    commentCount: 2,
    previewComments: [
      {
        id: "showcase-comment-2",
        authorTamerName: "둘째",
        body: "좋은 기록이네요.",
      },
      {
        id: "showcase-comment-1",
        authorTamerName: "첫째",
        body: "축하합니다!",
      },
    ],
    createdAt: "2026-04-01T00:00:00.000Z",
    snapshot: {
      slotName: "슬롯1",
      digimonDisplayName: "코로몬",
      stageLabel: "성장기",
      version: "Ver.1",
      device: "Digital Monster Color 25th",
      weight: 12,
      careMistakes: 0,
      totalBattles: 4,
      totalBattlesWon: 3,
      winRate: 75,
      visual: {
        backgroundNumber: 162,
        spriteBasePath: "/images",
        spriteNumber: 6,
        isLightsOn: true,
        sleepStatus: "AWAKE",
        poopCount: 0,
        isFrozen: false,
        isDead: false,
        isInjured: false,
      },
    },
  },
];

const freePostsAll = [
  {
    id: "free-1",
    boardId: "free",
    category: "general",
    title: "오늘 배틀 루틴 공유",
    body: "아침 배틀 루틴을 공유합니다.",
    authorUid: "user-2",
    authorTamerName: "메탈그레이",
    commentCount: 1,
    createdAt: "2026-04-01T01:00:00.000Z",
  },
  {
    id: "free-2",
    boardId: "free",
    category: "question",
    title: "완전체 진화 조건 질문",
    body: "케어 미스 기준이 헷갈립니다.",
    authorUid: "user-1",
    authorTamerName: "한솔",
    commentCount: 3,
    createdAt: "2026-04-01T02:00:00.000Z",
  },
];

const freePostDetail = {
  post: {
    id: "free-2",
    boardId: "free",
    category: "question",
    title: "완전체 진화 조건 질문",
    body: "케어 미스 기준이 헷갈립니다.",
    authorUid: "user-1",
    authorTamerName: "한솔",
    commentCount: 3,
    createdAt: "2026-04-01T02:00:00.000Z",
  },
  comments: [
    {
      id: "free-comment-1",
      postId: "free-2",
      authorUid: "user-2",
      authorTamerName: "메탈그레이",
      body: "성숙기 동안 누적 케어 미스를 먼저 보시면 됩니다.",
      createdAt: "2026-04-01T03:00:00.000Z",
      updatedAt: "2026-04-01T03:00:00.000Z",
    },
  ],
};

describe("Community", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockSlotsState.slots = [];
    mockSlotsState.loading = false;
    mockNavigate.mockReset();
    mockLocation.pathname = "/community";
    mockLocation.search = "";
    window.confirm = jest.fn(() => true);

    Object.values(communityApi).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === "function") {
        mockFn.mockReset();
      }
    });
  });

  afterEach(() => {
    delete window.confirm;
  });

  it("비로그인 상태에서는 자랑게시판 샘플 피드만 공개한다", () => {
    render(<Community />);

    expect(screen.getByText("내 디지몬 자랑 피드")).toBeInTheDocument();
    expect(screen.getByText("오늘은 배틀 승률 70%를 넘겼어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 자랑하기" })).toBeInTheDocument();
    expect(communityApi.listCommunityPosts).not.toHaveBeenCalled();
  });

  it("비로그인 상태 자유게시판은 로그인 게이트만 보여 주고 실제 목록을 요청하지 않는다", () => {
    mockLocation.search = "?board=free";

    render(<Community />);

    expect(screen.getByRole("heading", { name: "자유게시판" })).toBeInTheDocument();
    expect(
      screen.getByText("자유게시판 실제 글은 로그인 후 확인할 수 있습니다.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 글쓰기" })).toBeInTheDocument();
    expect(communityApi.listCommunityPosts).not.toHaveBeenCalled();
  });

  it("로그인 상태 자유게시판은 말머리 필터와 압축 목록 행을 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=free";

    communityApi.listCommunityPosts.mockImplementation((currentUser, boardId, options = {}) => {
      if (boardId !== "free") {
        return Promise.resolve([]);
      }

      if (options.category === "question") {
        return Promise.resolve(freePostsAll.filter((post) => post.category === "question"));
      }

      return Promise.resolve(freePostsAll);
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("오늘 배틀 루틴 공유")).toBeInTheDocument();
    });

    expect(communityApi.listCommunityPosts).toHaveBeenCalledWith(
      mockAuthState.currentUser,
      "free",
      { category: "" }
    );
    expect(screen.getByText("말머리")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("글쓴이")).toBeInTheDocument();
    expect(screen.getByText("작성일")).toBeInTheDocument();
    expect(screen.getByText("관리")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "질문" })).toBeInTheDocument();
    const generalRow = screen.getByText("오늘 배틀 루틴 공유").closest("article");
    const questionRow = screen.getByText("완전체 진화 조건 질문").closest("article");

    expect(within(generalRow).getByText("일반")).toBeInTheDocument();
    expect(within(generalRow).getByRole("button", { name: /오늘 배틀 루틴 공유/ })).toBeInTheDocument();
    expect(within(generalRow).getByText("메탈그레이")).toBeInTheDocument();
    expect(generalRow.querySelector(".community-free-post-row__date")).not.toBeNull();
    expect(within(generalRow).getByRole("button", { name: "보기" })).toBeInTheDocument();
    expect(within(questionRow).getByText("질문")).toBeInTheDocument();
    expect(screen.getByText("메탈그레이")).toBeInTheDocument();
    expect(screen.getByText("한솔")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "안내 카드 펼치기 3개" })).toBeInTheDocument();
    expect(screen.queryByText("자유게시판 이용 안내")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "안내 카드 펼치기 3개" }));

    expect(screen.getByRole("button", { name: "안내 카드 접기 3개" })).toBeInTheDocument();
    expect(screen.getByText("자유게시판 이용 안내")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "질문" }));

    await waitFor(() => {
      expect(communityApi.listCommunityPosts).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "free",
        { category: "question" }
      );
    });

    expect(screen.queryByText("오늘 배틀 루틴 공유")).not.toBeInTheDocument();
    expect(screen.getByText("완전체 진화 조건 질문")).toBeInTheDocument();
  });

  it("로그인 상태 자유게시판은 텍스트 전용 글쓰기 모달로 등록한다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=free";

    communityApi.listCommunityPosts.mockResolvedValue([]);
    communityApi.createCommunityPost.mockResolvedValue({
      id: "free-3",
      boardId: "free",
      category: "guide",
    });

    render(<Community />);

    fireEvent.click(screen.getByRole("button", { name: "글쓰기" }));

    expect(screen.getByRole("dialog", { name: "자유게시판 글쓰기" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("말머리"), {
      target: { value: "guide" },
    });
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "케어 루틴 정리" },
    });
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "아침 체크 순서를 정리했습니다." },
    });

    fireEvent.click(screen.getByRole("button", { name: "글 올리기" }));

    await waitFor(() => {
      expect(communityApi.createCommunityPost).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "free",
        {
          category: "guide",
          title: "케어 루틴 정리",
          body: "아침 체크 순서를 정리했습니다.",
        }
      );
    });
  });

  it("자유게시판 상세는 스냅샷 없이 제목, 본문, 댓글만 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=free";

    communityApi.listCommunityPosts.mockResolvedValue(freePostsAll);
    communityApi.getCommunityPostDetail.mockResolvedValue(freePostDetail);

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("완전체 진화 조건 질문")).toBeInTheDocument();
    });

    const targetRow = screen.getByText("완전체 진화 조건 질문").closest("article");
    fireEvent.click(within(targetRow).getByRole("button", { name: "보기" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "완전체 진화 조건 질문" })).toBeInTheDocument();
    });

    expect(communityApi.getCommunityPostDetail).toHaveBeenCalledWith(
      mockAuthState.currentUser,
      "free",
      "free-2"
    );
    const dialog = screen.getByRole("dialog", { name: "완전체 진화 조건 질문" });
    expect(within(dialog).getByText("질문")).toBeInTheDocument();
    expect(within(dialog).getByText("케어 미스 기준이 헷갈립니다.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("성숙기 동안 누적 케어 미스를 먼저 보시면 됩니다.")
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("디지몬 스탯")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Digital Monster Color 25th")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("새 댓글")).toBeInTheDocument();
  });

  it("로그인 상태 자랑게시판은 현재 슬롯 스냅샷을 함께 저장한다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockSlotsState.slots = [
      {
        id: 2,
        slotName: "슬롯2",
        digimonDisplayName: "푸니몬",
        selectedDigimon: "Punimon",
        version: "Ver.2",
        device: "Digital Monster Color 25th",
        backgroundSettings: {
          selectedId: "forest",
          mode: "auto",
        },
        digimonStats: {
          evolutionStage: "Baby1",
          weight: 5,
          careMistakes: 0,
          totalBattles: 0,
          totalBattlesWon: 0,
          poopCount: 0,
          isLightsOn: true,
          sleepStatus: "AWAKE",
        },
      },
    ];

    communityApi.listCommunityPosts.mockResolvedValue(showcasePosts);
    communityApi.createCommunityPost.mockResolvedValue({
      id: "showcase-2",
      boardId: "showcase",
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("서버에서 불러온 자랑 글")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "자랑하기" }));

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "히히히" },
    });
    fireEvent.change(screen.getByLabelText("짧은 코멘트"), {
      target: { value: "키킥" },
    });

    fireEvent.click(screen.getByRole("button", { name: "자랑 글 올리기" }));

    await waitFor(() => {
      expect(communityApi.createCommunityPost).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "showcase",
        expect.objectContaining({
          slotId: "2",
          title: "히히히",
          body: "키킥",
          snapshot: expect.objectContaining({
            slotId: "2",
            slotName: "슬롯2",
            selectedDigimon: "Punimon",
            digimonDisplayName: "푸니몬",
            version: "Ver.2",
            visual: expect.objectContaining({
              backgroundNumber: expect.any(Number),
              spriteBasePath: expect.any(String),
              spriteNumber: expect.any(Number),
            }),
          }),
        })
      );
    });
  });
});
