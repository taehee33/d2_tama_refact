import React from "react";
import { render, screen } from "@testing-library/react";
import Guide from "./Guide";

const mockAuthState = {
  currentUser: null,
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

describe("Guide", () => {
  test("현재 사이트 기준 가이드 흐름과 커뮤니티 보드 안내를 함께 보여 준다", () => {
    render(<Guide />);

    expect(screen.getByRole("heading", { name: "디지몬 육성 가이드" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "현재 사이트 기준으로 보는 전체 흐름" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "커뮤니티 보드 활용" })).toBeInTheDocument();
    expect(screen.getAllByText("버그제보 / QnA").length).toBeGreaterThan(0);
    expect(screen.getByText(/상태 · 먹이 · 훈련 · 배틀 · 교감/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "로그인 →" })[0]).toHaveAttribute("href", "/auth");
  });
});
