import React from "react";
import { render, screen } from "@testing-library/react";
import ControlPanel from "./ControlPanel";

describe("ControlPanel", () => {
  test("조명 꺼짐과 냉장고 상태여도 별도 잠금 안내 문구는 표시하지 않는다", () => {
    render(
      <ControlPanel
        width={320}
        height={60}
        activeMenu={null}
        onMenuClick={jest.fn()}
        stats={{}}
        sleepStatus="AWAKE"
        isLightsOn={false}
        isFrozen
      />
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("메뉴 잠금 안내")).not.toBeInTheDocument();
  });
});
