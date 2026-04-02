import React from "react";
import { render, screen } from "@testing-library/react";
import Landing from "./Landing";

const mockAuthState = {
  currentUser: null,
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
  });

  test("랜딩 페이지가 6개 섹션을 순서대로 렌더링한다", () => {
    const { container } = render(<Landing />);

    expect(container.querySelectorAll("section")).toHaveLength(6);
    expect(
      screen.getByRole("heading", {
        name: "그 시절, 우리는 모두 선택받은 아이들이었다",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "화면 너머로만 보이던 디지털 월드가 다시 열립니다" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "신호를 감지했습니다" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "코로몬" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "그 여름의 디지털 월드" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "지금, 다시 모험을 시작하세요" })
    ).toBeInTheDocument();
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
    expect(screen.getByAltText("회상 장면 속 깜몬")).toHaveAttribute("src", "/images/210.png");
  });
});
