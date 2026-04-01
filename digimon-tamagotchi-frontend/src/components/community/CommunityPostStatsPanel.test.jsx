import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CommunityPostStatsPanel from "./CommunityPostStatsPanel";

describe("CommunityPostStatsPanel", () => {
  it("기본은 접힘 상태이고 버튼으로 펼치고 접을 수 있다", () => {
    render(
      <CommunityPostStatsPanel
        snapshot={{
          stageLabel: "유년기 I",
          version: "Ver.2",
          slotName: "슬롯2",
          device: "Digital Monster Color 25th",
          careMistakes: 0,
          weight: 5,
          winRate: 0,
        }}
        commentCount={3}
      />
    );

    expect(screen.getByText("디지몬 스탯")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "스탯 펼치기" })).toBeInTheDocument();
    expect(screen.getByText("유년기 I · Ver.2 · 승률 0%")).toBeInTheDocument();
    expect(screen.queryByText("케어 미스")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "스탯 펼치기" }));

    expect(screen.getByRole("button", { name: "스탯 접기" })).toBeInTheDocument();
    expect(screen.getByText("케어 미스")).toBeInTheDocument();
    expect(screen.getByText("Digital Monster Color 25th")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "스탯 접기" }));

    expect(screen.getByRole("button", { name: "스탯 펼치기" })).toBeInTheDocument();
    expect(screen.queryByText("케어 미스")).not.toBeInTheDocument();
  });
});
