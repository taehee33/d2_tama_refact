import React from "react";
import { render, screen } from "@testing-library/react";
import EncyclopediaModal from "./EncyclopediaModal";

jest.mock("./panels/EncyclopediaPanel", () => () => <div>도감 패널</div>);

describe("EncyclopediaModal", () => {
  it("도감 전용 폭을 사용해 배틀 모달 공통 폭 제한에 묶이지 않는다", () => {
    render(<EncyclopediaModal onClose={() => {}} />);

    expect(screen.getByTestId("encyclopedia-modal")).toHaveStyle({
      width: "90%",
      minWidth: "300px",
      maxWidth: "1200px",
    });
  });
});
