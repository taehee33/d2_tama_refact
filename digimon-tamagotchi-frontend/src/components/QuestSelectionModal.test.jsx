import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import QuestSelectionModal from "./QuestSelectionModal";

const quests = [
  {
    areaId: "area-1",
    areaName: "Area 1",
    enemies: [{ enemyId: "Agumon", name: "아구몬", isBoss: true }],
  },
];

describe("QuestSelectionModal", () => {
  test("상단 헤더와 버전 탭을 보여주고 닫기 버튼을 호출한다", () => {
    const onClose = jest.fn();

    render(
      <QuestSelectionModal
        quests={quests}
        questsVer2={[]}
        clearedQuestIndex={0}
        onSelectArea={jest.fn()}
        onClose={onClose}
      />
    );

    expect(screen.getByText("퀘스트 모드")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver.1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver.2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
