import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveSkinPicker from "./ImmersiveSkinPicker";

describe("ImmersiveSkinPicker", () => {
  test("벽돌 Ver.1을 가로 전용 스킨으로 표시하고 선택 콜백을 호출한다", () => {
    const onSelectSkin = jest.fn();

    render(
      <ImmersiveSkinPicker
        isOpen
        activeSkinId="tama-default-none"
        onSelectSkin={onSelectSkin}
      />
    );

    expect(screen.getByText("가로 전용")).toBeInTheDocument();
    expect(
      screen.getByText("세로 몰입형에서는 기본 화면을 유지합니다.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /벽돌 Ver\.1/i }));

    expect(onSelectSkin).toHaveBeenCalledWith("brick-ver1");
  });
});
