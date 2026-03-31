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
});
