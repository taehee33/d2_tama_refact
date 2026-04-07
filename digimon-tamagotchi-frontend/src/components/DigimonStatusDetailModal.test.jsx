import React from "react";
import { render, screen } from "@testing-library/react";
import DigimonStatusDetailModal from "./DigimonStatusDetailModal";

describe("DigimonStatusDetailModal", () => {
  test("카테고리별 섹션과 상세 힌트를 함께 보여준다", () => {
    render(
      <DigimonStatusDetailModal
        statusMessages={[
          {
            id: "sleep-disturbance",
            text: "수면 방해: 4분 30초 더 깨어 있음 😵",
            category: "warning",
            detailHint: "강제로 깨어 있는 동안은 다시 재우기 전까지 수면 리듬이 밀릴 수 있어요.",
            color: "text-orange-600",
            bgColor: "bg-orange-100",
          },
          {
            id: "time-until-sleep",
            text: "수면까지 1시간 0분 후 😴",
            category: "info",
            detailHint: "지금은 생활 리듬 안내예요. 급한 경고가 있으면 상단 요약에서는 뒤로 밀려요.",
            color: "text-blue-600",
            bgColor: "bg-blue-100",
          },
        ]}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("곧 대응 필요")).toBeInTheDocument();
    expect(screen.getByText("상태 정보")).toBeInTheDocument();
    expect(screen.getByText("수면 방해: 4분 30초 더 깨어 있음 😵")).toBeInTheDocument();
    expect(screen.getByText("강제로 깨어 있는 동안은 다시 재우기 전까지 수면 리듬이 밀릴 수 있어요.")).toBeInTheDocument();
    expect(screen.getByText("수면까지 1시간 0분 후 😴")).toBeInTheDocument();
  });
});
