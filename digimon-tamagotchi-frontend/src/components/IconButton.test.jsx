import React from "react";
import { render, screen } from "@testing-library/react";
import IconButton from "./IconButton";

describe("IconButton", () => {
  test("모바일 아이콘 버튼은 border-box 기준으로 컴팩트한 높이를 유지한다", () => {
    render(
      <IconButton
        icon="/images/192.png"
        onClick={() => {}}
        isActive={false}
        width={60}
        height={60}
        className="icon-button-mobile touch-button"
        label="식사"
        isMobile
      />
    );

    const button = screen.getByText("식사").closest(".icon-button");
    expect(button).toHaveStyle({
      boxSizing: "border-box",
      height: "76px",
      padding: "8px",
    });
  });
});
