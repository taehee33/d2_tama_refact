import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveLandscapeInfoOverlay from "./ImmersiveLandscapeInfoOverlay";

describe("ImmersiveLandscapeInfoOverlay", () => {
  test("열린 상태에서 상태 카드와 지원 액션을 렌더하고 닫을 수 있다", () => {
    const onClose = jest.fn();

    render(
      <ImmersiveLandscapeInfoOverlay
        isOpen
        onClose={onClose}
        statusNode={<div>상태 카드</div>}
        supportActionsNode={<div>지원 액션</div>}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "디지바이스 정보" })
    ).toBeInTheDocument();
    expect(screen.getByText("상태 카드")).toBeInTheDocument();
    expect(screen.getByText("지원 액션")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "가로 상세 정보 닫기" })
    );

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
