import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CommunicationModal from "./CommunicationModal";

describe("CommunicationModal", () => {
  test("상단 닫기 버튼으로 모달을 닫을 수 있다", () => {
    const onClose = jest.fn();

    render(
      <CommunicationModal
        onClose={onClose}
        onSparringStart={jest.fn()}
        onArenaStart={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "온라인 배틀 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
