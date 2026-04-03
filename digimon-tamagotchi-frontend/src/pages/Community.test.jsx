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
    mockNavigate.mockReset();
    mockLocation.pathname = "/community";
    mockLocation.search = "";

    Object.values(communityApi).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === "function") {
        mockFn.mockReset();
      }
    });
  });

  it("비로그인 상태에서는 샘플 피드와 로그인 CTA를 보여 준다", () => {
    render(<Community />);

    expect(screen.getByText("내 디지몬 자랑 피드")).toBeInTheDocument();
    expect(screen.getByText("오늘은 배틀 승률 70%를 넘겼어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 자랑하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "자랑하기" })).not.toBeInTheDocument();
  });

  it("게시판 탭을 전환하면 자유게시판, 버그제보/QnA, 디스코드 패널을 각각 보여 준다", () => {
    render(<Community />);

    fireEvent.click(screen.getByRole("tab", { name: /자유게시판/i }));
    expect(screen.getByRole("tab", { name: /자유게시판/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /자랑게시판/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "자유게시판" })).toBeInTheDocument();
    expect(screen.getByText("오늘 플레이 로그")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /버그제보/i }));
    expect(screen.getByRole("tab", { name: /버그제보/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "버그제보 / QnA" })).toBeInTheDocument();
    expect(screen.getByText("로그인 없이 플레이할 수 있나요?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /디스코드/i }));
    expect(screen.getByRole("tab", { name: /디스코드/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "디스코드 커뮤니티" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "디스코드 바로가기" })).toBeInTheDocument();
    expect(screen.getByText("공지 확인")).toBeInTheDocument();
  });

  it("URL query의 board 값으로 초기 게시판을 선택하고 잘못된 값은 자랑게시판으로 되돌린다", () => {
    const { rerender } = render(<Community />);

    mockLocation.search = "?board=free";
    rerender(<Community />);
    expect(screen.getByRole("tab", { name: /자유게시판/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "자유게시판" })).toBeInTheDocument();

    mockLocation.search = "?board=discord";
    rerender(<Community />);
    expect(screen.getByRole("tab", { name: /디스코드/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "디스코드 커뮤니티" })).toBeInTheDocument();

    mockLocation.search = "?board=unknown";
    rerender(<Community />);
    expect(screen.getByRole("tab", { name: /자랑게시판/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "내 디지몬 자랑 피드" })).toBeInTheDocument();
  });

  it("페이지 안에서 게시판을 바꾸면 URL query와 선택 상태를 같이 갱신한다", () => {
    render(<Community />);

    fireEvent.click(screen.getByRole("tab", { name: /버그제보/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/community?board=support");
    expect(screen.getByRole("tab", { name: /버그제보/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "버그제보 / QnA" })).toBeInTheDocument();
  });

  it("게시판 종류 목록이 선택된 게시판 설명보다 먼저 나온다", () => {
    render(<Community />);

    const tablist = screen.getByRole("tablist", { name: "커뮤니티 보드" });
    const heroHeading = screen.getByRole("heading", { name: "내 디지몬 자랑 피드" });

    expect(tablist.compareDocumentPosition(heroHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("게시판 선택 UI는 칩형 탭으로 제목만 보여 주고 CTA는 툴바로 이동한다", () => {
    const { container } = render(<Community />);

    const tablist = screen.getByRole("tablist", { name: "커뮤니티 보드" });
    const hero = container.querySelector(".community-hero");
    const toolbarAside = container.querySelector(".community-feed-toolbar__aside");

    expect(within(tablist).getByRole("tab", { name: "자랑게시판" })).toBeInTheDocument();
    expect(
      within(tablist).queryByText("대표 장면과 성장 로그를 올리는 메인 피드")
    ).not.toBeInTheDocument();
    expect(within(tablist).queryByText("샘플 공개 중")).not.toBeInTheDocument();

    expect(hero).not.toBeNull();
    expect(toolbarAside).not.toBeNull();
    expect(
      within(hero).queryByRole("link", { name: "로그인하고 자랑하기" })
    ).not.toBeInTheDocument();
    expect(
      within(toolbarAside).getByRole("link", { name: "로그인하고 자랑하기" })
    ).toBeInTheDocument();
  });

  it("자랑게시판 목록 카드는 라벨과 구역으로 정보를 분리해 보여 준다", async () => {
    mockAuthState.currentUser = {
      uid: "user-1",
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };
    mockSlotsState.slots = [];

    communityApi.listShowcasePosts.mockResolvedValue([
      {
        id: "post-1",
        slotId: "1",
        title: "바다 산책 뿔몬",
        body: "실제 커뮤니티 글입니다.",
        authorUid: "user-1",
        authorTamerName: "히히히",
        commentCount: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
        snapshot: {
          slotName: "슬롯1",
          digimonDisplayName: "뿔몬",
          stageLabel: "유년기 II",
          version: "Ver.2",
          device: "Digital Monster Color 25th",
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
    ]);
    communityApi.getShowcasePostDetail.mockResolvedValue({
      post: {
        id: "post-1",
        slotId: "1",
        title: "바다 산책 뿔몬",
        body: "실제 커뮤니티 글입니다.",
        authorUid: "user-1",
        authorTamerName: "히히히",
        commentCount: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
        snapshot: {
          slotName: "슬롯1",
          digimonDisplayName: "뿔몬",
          stageLabel: "유년기 II",
          version: "Ver.2",
          device: "Digital Monster Color 25th",
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
      comments: [],
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("바다 산책 뿔몬")).toBeInTheDocument();
    });

    const postCard = screen.getByText("바다 산책 뿔몬").closest("article");

    expect(postCard).not.toBeNull();
    expect(screen.getByText("제목 :")).toBeInTheDocument();
    expect(screen.getByText("작성자 :")).toBeInTheDocument();
    expect(screen.getByText("댓글 :")).toBeInTheDocument();
    expect(screen.getByText("디지몬 :")).toBeInTheDocument();
    expect(screen.getByText("단계 :")).toBeInTheDocument();
    expect(screen.getByText("슬롯 :")).toBeInTheDocument();
    expect(screen.getByText("대표 장면")).toBeInTheDocument();
    expect(within(postCard).getByText(/작성일 :/)).toBeInTheDocument();
  });

  it("로그인 상태에서는 자랑하기 모달과 상세 모달이 열린다", async () => {
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
          evolutionStage: "Child",
          weight: 12,
          careMistakes: 0,
          totalBattles: 4,
          totalBattlesWon: 3,
          poopCount: 0,
          isLightsOn: true,
          sleepStatus: "AWAKE",
        },
      },
    ];

    communityApi.listShowcasePosts.mockResolvedValue([
      {
        id: "post-1",
        slotId: "1",
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
          device: "Digital Monster Color 25th",
          weight: 12,
          careMistakes: 0,
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
    ]);
    communityApi.getShowcasePostDetail.mockResolvedValue({
      post: {
        id: "post-1",
        slotId: "1",
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
          device: "Digital Monster Color 25th",
          weight: 12,
          careMistakes: 0,
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
      comments: [],
    });

    render(<Community />);

    await waitFor(() => {
      expect(screen.getByText("서버에서 불러온 글")).toBeInTheDocument();
    });

    const postCard = screen.getByText("서버에서 불러온 글").closest("article");

    expect(postCard).not.toBeNull();
    expect(within(postCard).getByText("관리")).toBeInTheDocument();
    expect(within(postCard).getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(within(postCard).getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(within(postCard).getByText("코로몬")).toBeInTheDocument();
    expect(within(postCard).getByText("성장기 · Ver.1")).toBeInTheDocument();
    expect(within(postCard).getByText("댓글 :")).toBeInTheDocument();
    expect(within(postCard).getByText("1개")).toBeInTheDocument();
    expect(screen.queryByText("내용")).not.toBeInTheDocument();
    expect(screen.queryByText("디지몬 스탯")).not.toBeInTheDocument();
    expect(screen.queryByText("Digital Monster Color 25th")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "자랑하기" }));
    expect(screen.getByRole("dialog", { name: "내 디지몬 자랑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "자랑 글 올리기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    fireEvent.click(screen.getByRole("button", { name: "상세 보기" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "서버에서 불러온 글" })).toBeInTheDocument();
    });

    expect(screen.getByText("내용")).toBeInTheDocument();
    expect(screen.getByText("디지몬 스탯")).toBeInTheDocument();
    expect(screen.getAllByText("슬롯1").length).toBeGreaterThan(1);
    expect(screen.getByText("Digital Monster Color 25th")).toBeInTheDocument();
    expect(screen.queryByText("불 꺼줘!")).not.toBeInTheDocument();

    expect(communityApi.getShowcasePostDetail).toHaveBeenCalledWith(
      mockAuthState.currentUser,
      "post-1"
    );
  });

  it("글 작성 시 현재 미리보기 스냅샷을 함께 전송한다", async () => {
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

    communityApi.listShowcasePosts.mockResolvedValue([]);
    communityApi.createShowcasePost.mockResolvedValue({
      id: "post-2",
    });

    render(<Community />);

    fireEvent.click(screen.getByRole("button", { name: "자랑하기" }));

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "히히히" },
    });
    fireEvent.change(screen.getByLabelText("짧은 코멘트"), {
      target: { value: "키킥" },
    });

    fireEvent.click(screen.getByRole("button", { name: "자랑 글 올리기" }));

    await waitFor(() => {
      expect(communityApi.createShowcasePost).toHaveBeenCalledWith(
        mockAuthState.currentUser,
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
