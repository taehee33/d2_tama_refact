import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ExtraMenuModal from "./ExtraMenuModal";

describe("ExtraMenuModal", () => {
  test("더보기 허브를 기록/자료/보관·꾸미기/시스템 섹션으로 렌더링한다", () => {
    render(
      <ExtraMenuModal
        onClose={jest.fn()}
        onOpenSettings={jest.fn()}
        onOpenCollection={jest.fn()}
        onOpenActivityLog={jest.fn()}
        onOpenBattleLog={jest.fn()}
        onOpenEncyclopedia={jest.fn()}
        onOpenFridge={jest.fn()}
      />
    );

    expect(screen.getByText("기록")).toBeInTheDocument();
    expect(screen.getByText("자료")).toBeInTheDocument();
    expect(screen.getByText("보관/꾸미기")).toBeInTheDocument();
    expect(screen.getByText("시스템")).toBeInTheDocument();
    expect(screen.queryByText(/디지몬 가이드/)).not.toBeInTheDocument();
  });

  test("섹션 버튼이 올바른 모달 액션과 닫기를 함께 실행한다", () => {
    const onClose = jest.fn();
    const onOpenActivityLog = jest.fn();

    render(
      <ExtraMenuModal
        onClose={onClose}
        onOpenSettings={jest.fn()}
        onOpenCollection={jest.fn()}
        onOpenActivityLog={onOpenActivityLog}
        onOpenBattleLog={jest.fn()}
        onOpenEncyclopedia={jest.fn()}
        onOpenFridge={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /활동 로그/ }));

    expect(onOpenActivityLog).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("상단 닫기 버튼으로 더보기 모달을 닫을 수 있다", () => {
    const onClose = jest.fn();

    render(
      <ExtraMenuModal
        onClose={onClose}
        onOpenSettings={jest.fn()}
        onOpenCollection={jest.fn()}
        onOpenActivityLog={jest.fn()}
        onOpenBattleLog={jest.fn()}
        onOpenEncyclopedia={jest.fn()}
        onOpenFridge={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "추가 기능 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
