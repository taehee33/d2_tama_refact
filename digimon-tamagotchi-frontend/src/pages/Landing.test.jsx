import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Landing from "./Landing";
import { landingHeroContent, landingMemorySceneContent } from "../data/landingContent";

const mockAuthState = {
  currentUser: null,
};

const originalHeroBackground = {
  backgroundArtworkSrc: landingHeroContent.backgroundArtworkSrc,
  backgroundArtworkPosition: landingHeroContent.backgroundArtworkPosition,
  backgroundArtworkSize: landingHeroContent.backgroundArtworkSize,
};

const originalMemoryArtwork = {
  backgroundArtworkSrc: landingMemorySceneContent.backgroundArtworkSrc,
  backgroundArtworkPosition: landingMemorySceneContent.backgroundArtworkPosition,
  backgroundArtworkSize: landingMemorySceneContent.backgroundArtworkSize,
  featuredArtworkSrc: landingMemorySceneContent.featuredArtworkSrc,
  featuredArtworkAlt: landingMemorySceneContent.featuredArtworkAlt,
  featuredArtworkCaption: landingMemorySceneContent.featuredArtworkCaption,
  featuredArtworkPosition: landingMemorySceneContent.featuredArtworkPosition,
  featuredArtworkItems: landingMemorySceneContent.featuredArtworkItems.map((item) => ({ ...item })),
};

jest.mock(
  "react-router-dom",
  () => ({
    __esModule: true,
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

describe("Landing 둘러보기 진입점", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    Object.assign(landingHeroContent, originalHeroBackground);
    Object.assign(landingMemorySceneContent, {
      ...originalMemoryArtwork,
      featuredArtworkItems: originalMemoryArtwork.featuredArtworkItems.map((item) => ({ ...item })),
    });
  });

  test("랜딩 페이지가 5개 섹션을 순서대로 렌더링한다", () => {
    const { container } = render(<Landing />);

    expect(container.querySelectorAll("section")).toHaveLength(5);
    expect(
      screen.getByRole("heading", {
        name: "그 시절, 우리는 모두 선택받은 아이들이었다",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "화면 너머로만 보이던 디지털 월드가 다시 열립니다" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "코로몬" })).toBeInTheDocument();
    expect(screen.getByText("1999년 그 여름, 디지털월드")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "지금, 다시 모험을 시작하세요" })
    ).toBeInTheDocument();
    expect(screen.queryByText("신호를 감지했습니다")).not.toBeInTheDocument();
    expect(screen.queryByText("MEMORY SCENE")).not.toBeInTheDocument();
  });

  test("비로그인 둘러보기에서 로그인 CTA와 공개 링크가 보인다", () => {
    render(<Landing />);

    expect(screen.getByRole("link", { name: "로그인하고 시작하기" })).toHaveAttribute(
      "href",
      "/auth"
    );
    expect(screen.getByRole("link", { name: "가이드 먼저 보기" })).toHaveAttribute(
      "href",
      "/guide"
    );
    expect(screen.getByRole("link", { name: "노트북 둘러보기" })).toHaveAttribute(
      "href",
      "/notebook"
    );
    expect(screen.getByRole("link", { name: "저장 방식 확인" })).toHaveAttribute(
      "href",
      "/support"
    );
  });

  test("로그인 상태에서는 핵심 CTA가 플레이 허브와 홈 복귀로 바뀐다", () => {
    mockAuthState.currentUser = { uid: "tester" };

    render(<Landing />);

    expect(screen.getByRole("link", { name: "플레이 허브 열기" })).toHaveAttribute(
      "href",
      "/play"
    );
    expect(screen.getByRole("link", { name: "내 홈으로 돌아가기" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  test("핵심 실자산 경로를 랜딩에서 연결한다", () => {
    render(<Landing />);

    expect(screen.getByAltText("선택받은 아이들이 창밖으로 손을 흔드는 히어로 장면")).toHaveAttribute(
      "src",
      "/images/landing/hero-memory-window.png"
    );
    expect(screen.getByAltText("빛을 머금은 디지타마 포스터 비주얼")).toHaveAttribute(
      "src",
      "/images/133.png"
    );
    expect(screen.getByAltText("첫 번째 파트너 코로몬")).toHaveAttribute(
      "src",
      "/images/225.png"
    );
    expect(screen.getByAltText("다음 진화를 예고하는 아구몬")).toHaveAttribute(
      "src",
      "/images/240.png"
    );
    expect(screen.getByAltText("대표 장면 첫 번째 컷")).toHaveAttribute(
      "src",
      "/images/landing/memory-cut-01.png"
    );
    expect(screen.getByAltText("대표 장면 두 번째 컷")).toHaveAttribute(
      "src",
      "/images/landing/memory-cut-02.jpg"
    );
    expect(screen.getByAltText("대표 장면 세 번째 컷")).toHaveAttribute(
      "src",
      "/images/landing/memory-cut-03.png"
    );
    expect(screen.getByAltText("손 위에 올려진 디지바이스 회상 장면")).toHaveAttribute(
      "src",
      "/images/landing/cta-device.webp"
    );
    expect(screen.queryByText("대표컷 01 / 여름의 시작")).not.toBeInTheDocument();
    expect(screen.queryByText("대표컷 02 / 함께한 모험")).not.toBeInTheDocument();
    expect(screen.queryByText("대표컷 03 / 다시 떠오르는 기억")).not.toBeInTheDocument();
  });

  test("성장 섹션은 실제 게임에 있는 스탯 이름만 노출한다", () => {
    render(<Landing />);

    expect(screen.getByText("배고픔")).toBeInTheDocument();
    expect(screen.getByText("힘")).toBeInTheDocument();
    expect(screen.getByText("훈련")).toBeInTheDocument();
    expect(screen.queryByText("동기화율")).not.toBeInTheDocument();
    expect(screen.queryByText("안정도")).not.toBeInTheDocument();
    expect(screen.queryByText("유대")).not.toBeInTheDocument();
  });

  test("사용자가 지우길 원하는 보조 문구들은 랜딩에서 렌더링하지 않는다", () => {
    render(<Landing />);

    expect(
      screen.queryByText("이 랜딩은 그 감정을 다시 꺼내기 위한 조용한 입구입니다.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Digimon Adventure / Memory / Connection")).not.toBeInTheDocument();
    expect(screen.queryByText("SCENE CHANGE")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "설명보다 장면이 먼저 도착하고, 스크롤이 깊어질수록 브랜드 페이지에서 디지털 월드로 분위기가 전환됩니다."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "한 장면만으로도 여름빛, 모험, 파트너의 온도가 돌아오는 구간입니다. 대표 장면 세 컷을 전시처럼 이어 붙여, 설명보다 기억이 먼저 도착하도록 구성합니다."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "로그인해 당신의 디지몬을 깨우거나, 먼저 둘러보며 이 세계의 결을 천천히 확인해 보세요."
      )
    ).not.toBeInTheDocument();
  });

  test("선택한 이미지를 히어로 배경과 중간 회상 컷으로 주입할 수 있다", () => {
    landingHeroContent.backgroundArtworkSrc = "/images/custom-hero.jpg";
    landingHeroContent.backgroundArtworkAlt = "커스텀 히어로 이미지";
    landingHeroContent.backgroundArtworkPosition = "50% 35%";
    landingMemorySceneContent.featuredArtworkItems = [
      {
        id: "custom-memory",
        src: "/images/custom-memory.jpg",
        alt: "회상 장면 커스텀 이미지",
        caption: "CUSTOM MEMORY ART",
        position: "center top",
      },
    ];

    render(<Landing />);

    expect(screen.getByAltText("커스텀 히어로 이미지")).toHaveAttribute(
      "src",
      "/images/custom-hero.jpg"
    );
    expect(screen.getByAltText("빛을 머금은 디지타마 포스터 비주얼")).toBeInTheDocument();
    expect(screen.getByAltText("회상 장면 커스텀 이미지")).toHaveAttribute(
      "src",
      "/images/custom-memory.jpg"
    );
    expect(screen.queryByText("CUSTOM MEMORY ART")).not.toBeInTheDocument();
    expect(screen.queryByAltText("대표 장면 첫 번째 컷")).not.toBeInTheDocument();
  });

  test("대표컷을 누르면 전체화면으로 크게 볼 수 있다", () => {
    render(<Landing />);

    fireEvent.click(screen.getByRole("button", { name: "대표 장면 첫 번째 컷 전체화면으로 보기" }));

    const viewer = screen.getByRole("dialog", { name: "대표 장면 첫 번째 컷 전체화면 보기" });
    expect(within(viewer).getByAltText("대표 장면 첫 번째 컷")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "대표컷 전체화면 닫기" }));

    expect(screen.queryByRole("dialog", { name: "대표 장면 첫 번째 컷 전체화면 보기" })).not.toBeInTheDocument();
  });
});
