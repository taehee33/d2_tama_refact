import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ActivityLogModal from "./ActivityLogModal";

describe("ActivityLogModal 수면 탭", () => {
  const activityLogs = [
    {
      type: "SLEEP_DISTURBANCE",
      text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
      timestamp: 3000,
    },
    { type: "SLEEP_START", text: "잠듦", timestamp: 2000 },
    { type: "CARE_MISTAKE", text: "배고픔 케어미스", timestamp: 1000 },
  ];

  test("수면 탭에 수면 방해를 포함하고 일반 케어미스는 제외한다", () => {
    render(<ActivityLogModal activityLogs={activityLogs} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "수면" }));

    expect(screen.getByText(/수면 방해\(사유: 훈련\)/)).toBeInTheDocument();
    expect(screen.getByText("잠듦")).toBeInTheDocument();
    expect(screen.queryByText("배고픔 케어미스")).not.toBeInTheDocument();
  });

  test("케어 탭에서 수면 방해를 중복 노출하지 않는다", () => {
    render(<ActivityLogModal activityLogs={activityLogs} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "케어" }));

    expect(screen.getByText("배고픔 케어미스")).toBeInTheDocument();
    expect(screen.queryByText(/수면 방해\(사유: 훈련\)/)).not.toBeInTheDocument();
  });
});
