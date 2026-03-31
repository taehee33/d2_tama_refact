import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GameHeaderMeta, { GAME_HEADER_INFO_COLLAPSED_KEY } from "./GameHeaderMeta";

describe("GameHeaderMeta", () => {
  const defaultProps = {
    slotName: "슬롯1",
    slotCreatedAtText: "2026. 03. 30. 오후 10:37:15",
    slotDevice: "Digital Monster Color 25th",
    slotVersion: "Ver.1",
    currentTimeText: "2026. 03. 31. 오후 10:37:58",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test("기본적으로 접힌 상태로 시작하고 토글 상태를 localStorage에 유지한다", () => {
    const { unmount } = render(<GameHeaderMeta {...defaultProps} />);

    expect(screen.getByRole("button", { name: "정보 펼치기" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("game-header-meta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "정보 펼치기" }));

    expect(screen.getByRole("button", { name: "정보 접기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/슬롯 이름: 슬롯1/)).toBeInTheDocument();
    expect(localStorage.getItem(GAME_HEADER_INFO_COLLAPSED_KEY)).toBe("false");

    unmount();

    render(<GameHeaderMeta {...defaultProps} />);

    expect(screen.getByRole("button", { name: "정보 접기" })).toBeInTheDocument();
    expect(screen.getByText(/현재 시간:/)).toBeInTheDocument();
  });
});
