import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import JogressModeSelectModal from "./JogressModeSelectModal";

describe("JogressModeSelectModal", () => {
  test("온라인 조그레스의 양쪽 진화 계약을 안내하고 선택을 허용한다", () => {
    const onSelectOnline = jest.fn();

    render(
      <JogressModeSelectModal
        onClose={jest.fn()}
        onSelectLocal={jest.fn()}
        onSelectOnline={onSelectOnline}
        supportsOnline
        onlineNotice="온라인 조그레스는 양쪽 디지몬이 모두 진화합니다."
      />
    );

    expect(
      screen.getByText("온라인 조그레스는 양쪽 디지몬이 모두 진화합니다.")
    ).toBeInTheDocument();
    const onlineButton = screen.getByRole("button", {
      name: "온라인 — 다른 유저와 합체",
    });
    expect(onlineButton).toBeEnabled();
    fireEvent.click(onlineButton);
    expect(onSelectOnline).toHaveBeenCalledTimes(1);
  });
});
