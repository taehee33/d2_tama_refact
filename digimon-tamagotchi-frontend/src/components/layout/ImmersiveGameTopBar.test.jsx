import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveGameTopBar from "./ImmersiveGameTopBar";

describe("ImmersiveGameTopBar", () => {
  test("모바일에서는 전용 상단 바와 이동 버튼을 렌더링한다", () => {
    const onOpenBaseView = jest.fn();
    const onOpenPlayHub = jest.fn();
    const { container } = render(
      <ImmersiveGameTopBar
        isMobile
        onOpenBaseView={onOpenBaseView}
        onOpenPlayHub={onOpenPlayHub}
      />
    );

    expect(container.firstChild).toHaveClass("game-immersive-nav--mobile");
    expect(screen.getByText("몰입형 플레이")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "기본 화면" }));
    fireEvent.click(screen.getByRole("button", { name: "플레이 허브" }));

    expect(onOpenBaseView).toHaveBeenCalledTimes(1);
    expect(onOpenPlayHub).toHaveBeenCalledTimes(1);
  });

  test("데스크톱에서는 플레이 허브 오른쪽에 기본 화면 버튼이 온다", () => {
    render(
      <ImmersiveGameTopBar
        onOpenBaseView={() => {}}
        onOpenPlayHub={() => {}}
      />
    );

    const navButtons = screen.getAllByRole("button");

    expect(navButtons[0]).toHaveTextContent("플레이 허브");
    expect(navButtons[1]).toHaveTextContent("기본 화면");
  });
});
