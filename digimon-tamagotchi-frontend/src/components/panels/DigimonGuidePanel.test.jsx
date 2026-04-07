import React from "react";
import { render, screen } from "@testing-library/react";
import DigimonGuidePanel from "./DigimonGuidePanel";

function hasListText(text) {
  return (_, element) =>
    element?.tagName.toLowerCase() === "li" && element.textContent?.includes(text);
}

describe("DigimonGuidePanel", () => {
  test("기본 가이드가 실제 메뉴 구조와 같은 그룹 문구를 보여준다", () => {
    render(<DigimonGuidePanel initialView="GUIDE" />);

    expect(screen.queryByText(/상단 메뉴/)).not.toBeInTheDocument();
    expect(screen.queryByText(/하단 메뉴/)).not.toBeInTheDocument();
    expect(screen.getByText(hasListText("기본 조작: 상태, 먹이, 훈련, 배틀, 교감"))).toBeInTheDocument();
    expect(screen.getByText(hasListText("케어·도구: 화장실, 조명, 치료, 호출, 더보기"))).toBeInTheDocument();
    expect(screen.getByText(hasListText("더보기: 기록(활동 로그, 배틀 기록)"))).toBeInTheDocument();
  });
});
