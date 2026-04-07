import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DigimonStatusBadges from "./DigimonStatusBadges";

describe("DigimonStatusBadges", () => {
  test("핵심 3개만 보여주고 더보기 클릭 시 숨겨진 수면 정보까지 전달한다", () => {
    const handleOpenStatusDetail = jest.fn();

    render(
      <DigimonStatusBadges
        digimonStats={{
          fullness: 0,
          strength: 0,
          poopCount: 0,
          proteinOverdose: 0,
          maxOverfeed: 0,
          callStatus: {
            hunger: { isActive: false },
            strength: { isActive: false },
            sleep: { isActive: false },
          },
        }}
        sleepStatus="AWAKE"
        canEvolve={true}
        sleepSchedule={{ start: 23, end: 7, startMinute: 0, endMinute: 0 }}
        onOpenStatusDetail={handleOpenStatusDetail}
      />
    );

    expect(screen.getByText("배고픔 0 🍖")).toBeInTheDocument();
    expect(screen.getByText("힘 0 💪")).toBeInTheDocument();
    expect(screen.getByText("진화 가능 ✨")).toBeInTheDocument();
    expect(screen.getByText("+1개 더")).toBeInTheDocument();
    expect(screen.queryByText(/수면까지/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "모든 상태 보기" }));

    expect(handleOpenStatusDetail).toHaveBeenCalledTimes(1);

    const allMessages = handleOpenStatusDetail.mock.calls[0][0];
    expect(allMessages.map((message) => message.id)).toContain("time-until-sleep");
  });
});
