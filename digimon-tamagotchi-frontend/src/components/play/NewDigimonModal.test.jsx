import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import NewDigimonModal from "./NewDigimonModal";

function renderNewDigimonModal(props = {}) {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onStart: jest.fn(),
    isSubmitting: false,
  };

  return render(<NewDigimonModal {...defaultProps} {...props} />);
}

describe("NewDigimonModal", () => {
  test("모달이 열리면 Ver.1~Ver.5 디지타마 카드를 모두 표시한다", () => {
    const { container } = renderNewDigimonModal();

    expect(container.querySelector(".service-modal--new-digimon")).toBeInTheDocument();

    ["Ver.1", "Ver.2", "Ver.3", "Ver.4", "Ver.5"].forEach((version) => {
      expect(
        screen.getByRole("button", { name: `${version} 디지타마 선택` })
      ).toBeInTheDocument();
      expect(screen.getByRole("img", { name: new RegExp(`^${version}`) })).toBeInTheDocument();
    });
    expect(screen.getAllByText("(준비중)")).toHaveLength(3);
  });

  test("디지타마 카드를 클릭하면 버전 select 값이 함께 바뀐다", () => {
    renderNewDigimonModal();

    fireEvent.click(screen.getByRole("button", { name: "Ver.2 디지타마 선택" }));

    expect(screen.getByLabelText("버전")).toHaveValue("Ver.2");
    expect(screen.getByRole("button", { name: "Ver.2 디지타마 선택" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("select에서 버전을 바꾸면 해당 디지타마 카드가 선택 상태가 된다", () => {
    renderNewDigimonModal();

    fireEvent.change(screen.getByLabelText("버전"), {
      target: { value: "Ver.4" },
    });

    expect(screen.getByRole("button", { name: "Ver.4 디지타마 선택" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Ver.1 디지타마 선택" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("시작하기를 누르면 선택한 버전을 onStart로 전달한다", () => {
    const onStart = jest.fn();
    renderNewDigimonModal({ onStart });

    fireEvent.click(screen.getByRole("button", { name: "Ver.5 디지타마 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    expect(onStart).toHaveBeenCalledWith({
      device: "Digital Monster Color 25th",
      version: "Ver.5",
    });
  });
});
