import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DigimonStatusBadges from "./DigimonStatusBadges";

describe("DigimonStatusBadges", () => {
  test("평온 상태 배지를 렌더링하고 상세 열기 콜백에 전체 메시지를 전달한다", () => {
    const handleOpenStatusDetail = jest.fn();

    render(
      <DigimonStatusBadges
        digimonStats={{
          fullness: 3,
          strength: 3,
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
        currentAnimation="idle"
        onOpenStatusDetail={handleOpenStatusDetail}
      />
    );

    expect(screen.getByText("평온한 상태예요 😊")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "모든 상태 보기" }));

    expect(handleOpenStatusDetail).toHaveBeenCalledTimes(1);
    expect(handleOpenStatusDetail.mock.calls[0][0].map((message) => message.id)).toContain(
      "normal-status"
    );
  });

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

    const visibleBadges = screen
      .getAllByText(/진화 가능|배고픔 0|힘 0/)
      .map((element) => element.textContent);

    expect(visibleBadges).toEqual(["진화 가능 ✨", "배고픔 0 🍖", "힘 0 💪"]);
    expect(screen.getByText("+1개 더")).toBeInTheDocument();
    expect(screen.queryByText(/수면까지/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "모든 상태 보기" }));

    expect(handleOpenStatusDetail).toHaveBeenCalledTimes(1);

    const allMessages = handleOpenStatusDetail.mock.calls[0][0];
    expect(allMessages.map((message) => message.id)).toContain("time-until-sleep");
  });
});

test("게임 저장 동기화 상태를 상단 상태 배지에 표시하지 않는다", () => {
  render(
    <DigimonStatusBadges
      digimonStats={{}}
      syncStatus="conflict"
    />
  );

  expect(screen.queryByText("다른 기기의 변경사항 확인 필요")).not.toBeInTheDocument();
});
