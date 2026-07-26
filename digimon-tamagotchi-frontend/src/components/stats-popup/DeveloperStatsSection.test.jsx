import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DeveloperStatsSection from "./DeveloperStatsSection";

const stats = {
  age: 2,
  sprite: 100,
  evolutionStage: "Child",
  fullness: 1,
  strength: 2,
  effort: 1,
  energy: 3,
  weight: 4,
  careMistakes: 1,
  poopCount: 2,
  maxEnergy: 4,
  isInjured: false,
  injuries: 0,
  healedDosesCurrent: 0,
};

describe("DeveloperStatsSection", () => {
  test("Old 탭 상태와 원본 저장 통계를 표시한다", () => {
    render(<DeveloperStatsSection stats={stats} sourceStats={{ proteinOverdose: 2, battles: 3 }} />);

    expect(screen.getByText("Age: 2")).toBeInTheDocument();
    expect(screen.getByText("Protein Overdose: 2")).toBeInTheDocument();
    expect(screen.getByText("Battles: 3")).toBeInTheDocument();
    expect(screen.queryByText("[Dev Mode] 스탯 수정")).not.toBeInTheDocument();
  });

  test("개발자 select 변경을 숫자 의도로 전달한다", () => {
    const onNumericChange = jest.fn();
    render(
      <DeveloperStatsSection
        stats={stats}
        sourceStats={{}}
        devMode
        canEdit
        onNumericChange={onNumericChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Fullness:"), { target: { value: "4" } });
    expect(onNumericChange).toHaveBeenCalledWith("fullness", 4);
  });

  test("부상 토글을 불리언 의도로 전달한다", () => {
    const onBooleanChange = jest.fn();
    render(
      <DeveloperStatsSection
        stats={stats}
        sourceStats={{}}
        devMode
        canEdit
        onBooleanChange={onBooleanChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /isInjured/ }));
    expect(onBooleanChange).toHaveBeenCalledWith("isInjured", true);
  });
});
