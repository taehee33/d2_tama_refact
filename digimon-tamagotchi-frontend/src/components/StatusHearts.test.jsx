import React from "react";
import { render, screen } from "@testing-library/react";
import StatusHearts from "./StatusHearts";

test("부화 전에도 배고픔·힘 행을 해당 없음으로 유지한다", () => {
  render(
    <StatusHearts
      fullness={0}
      strength={0}
      showLabels
      position="inline"
      needsApplicable={false}
    />
  );

  expect(screen.getAllByText("해당 없음 (부화 전)")).toHaveLength(2);
  expect(screen.getByText("🍖 Fullness:")).toBeInTheDocument();
  expect(screen.getByText("💪 Strength:")).toBeInTheDocument();
});
