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
const OriginalFileReader = global.FileReader;
const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;

class MockFileReader {
  readAsDataURL(file) {
    this.result = `data:${file.type || "image/png"};base64,ZmFrZQ==`;

    if (typeof this.onload === "function") {
      this.onload({ target: { result: this.result } });
    }
  }
}

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
    authorIsOperator: true,
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
    authorIsOperator: true,
    commentCount: 3,
    createdAt: "2026-04-01T02:00:00.000Z",
  },
  comments: [
    {
      id: "free-comment-1",
      postId: "free-2",
      authorUid: "user-2",
      authorTamerName: "메탈그레이",
      authorIsOperator: true,
      body: "성숙기 동안 누적 케어 미스를 먼저 보시면 됩니다.",
      createdAt: "2026-04-01T03:00:00.000Z",
      updatedAt: "2026-04-01T03:00:00.000Z",
    },
  ],
};

const freeImagePostDetail = {
  post: {
    id: "free-1",
    boardId: "free",
    category: "general",
    title: "오늘 배틀 루틴 공유",
    body: "아침 배틀 루틴을 공유합니다.",
    authorUid: "user-2",
    authorTamerName: "메탈그레이",
    commentCount: 1,
    createdAt: "2026-04-01T01:00:00.000Z",
    imagePath: "free/user-2/post-1/image.png",
    imageUrl: "https://example.com/community/free-image.png",
    imageAlt: "오늘 배틀 루틴 공유 첨부 이미지",
  },
  comments: [],
};

const supportPostsAll = [
  {
    id: "support-1",
    boardId: "support",
    category: "bug",
    title: "저장 후 상태가 초기화됩니다",
    body: "저장 버튼을 누르면 수치가 되돌아갑니다.",
    authorUid: "user-2",
    authorTamerName: "메탈그레이",
    commentCount: 2,
    createdAt: "2026-04-01T05:00:00.000Z",
    supportContext: {
      slotNumber: "1",
      screenPath: "/play/1",
      gameVersion: "Ver.2",
    },
  },
  {
    id: "support-2",
    boardId: "support",
    category: "solved",
    title: "백업 복원 질문 해결됨",
    body: "브라우저 권한 허용으로 해결했습니다.",
    authorUid: "user-1",
    authorTamerName: "한솔",
    commentCount: 1,
    createdAt: "2026-04-01T06:00:00.000Z",
    supportContext: {
      slotNumber: "2",
      screenPath: "/backup",
      gameVersion: "Ver.1",
    },
  },
];

const supportPostDetail = {
  post: {
    id: "support-1",
    boardId: "support",
    category: "bug",
    title: "저장 후 상태가 초기화됩니다",
    body: "저장 버튼을 누르면 수치가 되돌아갑니다.",
    authorUid: "user-2",
    authorTamerName: "메탈그레이",
    commentCount: 2,
    createdAt: "2026-04-01T05:00:00.000Z",
    supportContext: {
      slotNumber: "1",
      screenPath: "/play/1",
      gameVersion: "Ver.2",
    },
    imagePath: "support/user-2/post-1/image.png",
    imageUrl: "https://example.com/community/support-image.png",
    imageAlt: "저장 후 상태가 초기화됩니다 첨부 이미지",
  },
  comments: [
    {
      id: "support-comment-1",
      postId: "support-1",
      authorUid: "user-1",
      authorTamerName: "한솔",
      body: "재현 순서 공유 감사합니다.",
      createdAt: "2026-04-01T06:10:00.000Z",
      updatedAt: "2026-04-01T06:10:00.000Z",
    },
  ],
};

describe("Community", () => {
  beforeAll(() => {
    global.FileReader = MockFileReader;
    global.URL.createObjectURL = jest.fn(() => "blob:free-post-preview");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterAll(() => {
    global.FileReader = OriginalFileReader;
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

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

  it("비로그인 상태 버그제보 / QnA는 로그인 게이트만 보여 주고 실제 목록을 요청하지 않는다", () => {
    mockLocation.search = "?board=support";

    render(<Community />);

    expect(screen.getByRole("heading", { name: "버그제보 / QnA" })).toBeInTheDocument();
    expect(
      screen.getByText("버그제보 / QnA 실제 글은 로그인 후 확인할 수 있습니다.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 글쓰기" })).toBeInTheDocument();
    expect(communityApi.listCommunityPosts).not.toHaveBeenCalled();
  });

  it("디스코드 보드는 디스코드/후원 라벨과 Ko-fi 후원 링크를 함께 보여 준다", () => {
    mockLocation.search = "?board=discord";

    render(<Community />);

    const discordSection = screen.getByText("디스코드", { selector: "p" }).closest("section");
    const supportSection = screen.getByText("후원", { selector: "p" }).closest("section");

    expect(screen.getByRole("heading", { name: "디스코드/후원" })).toBeInTheDocument();
    expect(discordSection).not.toBeNull();
    expect(supportSection).not.toBeNull();
    expect(within(discordSection).getByText("디스코드 관련사항")).toBeInTheDocument();
    expect(within(discordSection).getByText("공지 확인")).toBeInTheDocument();
    expect(within(discordSection).getByText("자랑 스냅샷")).toBeInTheDocument();
    expect(within(discordSection).getByText("버그제보 / QnA")).toBeInTheDocument();
    expect(within(discordSection).getByText("자유잡담")).toBeInTheDocument();
    expect(within(supportSection).getByText("Ko-fi를 통해 후원으로 응원해 주세요.")).toBeInTheDocument();
    expect(within(discordSection).getByRole("link", { name: "디스코드 링크" })).toHaveAttribute(
      "href",
      "https://discord.gg/BWXFtSCnGt"
    );
    expect(within(supportSection).getByRole("link", { name: "Ko-fi 링크" })).toHaveAttribute(
      "href",
      "https://ko-fi.com/hth3381"
    );
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
    expect(within(questionRow).getByText("운영자")).toBeInTheDocument();
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

  it("로그인 상태 버그제보 / QnA는 말머리 필터와 압축 목록 행을 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=support";

    communityApi.listCommunityPosts.mockImplementation((currentUser, boardId, options = {}) => {
      if (boardId !== "support") {
        return Promise.resolve([]);
      }

      if (options.category === "solved") {
        return Promise.resolve(supportPostsAll.filter((post) => post.category === "solved"));
      }

      return Promise.resolve(supportPostsAll);
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("저장 후 상태가 초기화됩니다")).toBeInTheDocument();
    });

    expect(communityApi.listCommunityPosts).toHaveBeenCalledWith(
      mockAuthState.currentUser,
      "support",
      { category: "" }
    );
    expect(screen.getByRole("button", { name: "버그" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "질문" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "해결" })).toBeInTheDocument();

    const bugRow = screen.getByText("저장 후 상태가 초기화됩니다").closest("article");
    const solvedRow = screen.getByText("백업 복원 질문 해결됨").closest("article");

    expect(within(bugRow).getByText("버그")).toBeInTheDocument();
    expect(within(solvedRow).getByText("해결")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "해결" }));

    await waitFor(() => {
      expect(communityApi.listCommunityPosts).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "support",
        { category: "solved" }
      );
    });

    expect(screen.queryByText("저장 후 상태가 초기화됩니다")).not.toBeInTheDocument();
    expect(screen.getByText("백업 복원 질문 해결됨")).toBeInTheDocument();
  });

  it("로그인 상태 버그제보 / QnA는 supportContext와 이미지와 함께 등록한다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=support";

    communityApi.listCommunityPosts.mockResolvedValue([]);
    communityApi.createCommunityPost.mockResolvedValue({
      id: "support-3",
      boardId: "support",
      category: "bug",
      supportContext: {
        slotNumber: "1",
        screenPath: "/play/1",
        gameVersion: "Ver.2",
      },
      imagePath: "support/user-1/post-3/image.png",
      imageUrl: "https://example.com/community/support-upload.png",
    });

    render(<Community />);

    fireEvent.click(screen.getByRole("button", { name: "글쓰기" }));

    expect(screen.getByRole("dialog", { name: "버그제보 / QnA 글쓰기" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("말머리"), {
      target: { value: "bug" },
    });
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "저장 후 상태가 초기화됩니다" },
    });
    fireEvent.change(screen.getByLabelText("슬롯 번호"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("화면 경로"), {
      target: { value: "/play/1" },
    });
    fireEvent.change(screen.getByLabelText("버전"), {
      target: { value: "Ver.2" },
    });
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "저장 버튼을 누르면 수치가 되돌아갑니다." },
    });
    fireEvent.change(screen.getByLabelText("이미지 첨부"), {
      target: {
        files: [
          new File(["fake-image"], "support-post.png", {
            type: "image/png",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByAltText("support-post.png 미리보기")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "글 올리기" }));

    await waitFor(() => {
      expect(communityApi.createCommunityPost).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "support",
        expect.objectContaining({
          category: "bug",
          title: "저장 후 상태가 초기화됩니다",
          body: "저장 버튼을 누르면 수치가 되돌아갑니다.",
          supportContext: {
            slotNumber: "1",
            screenPath: "/play/1",
            gameVersion: "Ver.2",
          },
          image: expect.objectContaining({
            fileName: "support-post.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,ZmFrZQ==",
          }),
        })
      );
    });
  });

  it("로그인 상태 자유게시판은 이미지 1장을 함께 첨부해 등록할 수 있다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=free";

    communityApi.listCommunityPosts.mockResolvedValue([]);
    communityApi.createCommunityPost.mockResolvedValue({
      id: "free-image-3",
      boardId: "free",
      category: "general",
      imagePath: "free/user-1/post-1/image.png",
      imageUrl: "https://example.com/community/free-image.png",
    });

    render(<Community />);

    fireEvent.click(screen.getByRole("button", { name: "글쓰기" }));

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "이미지 첨부 자유글" },
    });
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "본문과 이미지를 같이 남깁니다." },
    });
    fireEvent.change(screen.getByLabelText("이미지 첨부"), {
      target: {
        files: [
          new File(["fake-image"], "free-post.png", {
            type: "image/png",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByAltText("free-post.png 미리보기")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "글 올리기" }));

    await waitFor(() => {
      expect(communityApi.createCommunityPost).toHaveBeenCalledWith(
        mockAuthState.currentUser,
        "free",
        expect.objectContaining({
          category: "general",
          title: "이미지 첨부 자유글",
          body: "본문과 이미지를 같이 남깁니다.",
          image: expect.objectContaining({
            fileName: "free-post.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,ZmFrZQ==",
          }),
        })
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
    expect(within(dialog).getAllByText("운영자").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("케어 미스 기준이 헷갈립니다.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("성숙기 동안 누적 케어 미스를 먼저 보시면 됩니다.")
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("디지몬 스탯")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Digital Monster Color 25th")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("새 댓글")).toBeInTheDocument();
  });

  it("자유게시판 상세는 첨부 이미지가 있으면 본문과 함께 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=free";

    communityApi.listCommunityPosts.mockResolvedValue([
      {
        ...freePostsAll[0],
        imagePath: "free/user-2/post-1/image.png",
        imageUrl: "https://example.com/community/free-image.png",
      },
    ]);
    communityApi.getCommunityPostDetail.mockResolvedValue(freeImagePostDetail);

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("오늘 배틀 루틴 공유")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "보기" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "오늘 배틀 루틴 공유" })).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog", { name: "오늘 배틀 루틴 공유" });
    expect(
      within(dialog).getByRole("img", { name: "오늘 배틀 루틴 공유 첨부 이미지" })
    ).toHaveAttribute("src", "https://example.com/community/free-image.png");
  });

  it("버그제보 / QnA 상세는 support 메타와 첨부 이미지를 함께 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockLocation.search = "?board=support";

    communityApi.listCommunityPosts.mockResolvedValue(supportPostsAll);
    communityApi.getCommunityPostDetail.mockResolvedValue(supportPostDetail);

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("저장 후 상태가 초기화됩니다")).toBeInTheDocument();
    });

    const targetRow = screen.getByText("저장 후 상태가 초기화됩니다").closest("article");
    fireEvent.click(within(targetRow).getByRole("button", { name: "보기" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "저장 후 상태가 초기화됩니다" })
      ).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog", { name: "저장 후 상태가 초기화됩니다" });

    expect(communityApi.getCommunityPostDetail).toHaveBeenCalledWith(
      mockAuthState.currentUser,
      "support",
      "support-1"
    );
    expect(within(dialog).getByText("버그")).toBeInTheDocument();
    expect(within(dialog).getByText("슬롯 번호")).toBeInTheDocument();
    expect(within(dialog).getByText("/play/1")).toBeInTheDocument();
    expect(within(dialog).getByText("Ver.2")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "저장 후 상태가 초기화됩니다 첨부 이미지" })
    ).toHaveAttribute("src", "https://example.com/community/support-image.png");
    expect(within(dialog).queryByText("디지몬 스탯")).not.toBeInTheDocument();
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
