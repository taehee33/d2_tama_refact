import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import EncyclopediaPanel from "./EncyclopediaPanel";

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../hooks/useEncyclopedia", () => ({
  addMissingEncyclopediaEntries: jest.fn(),
  loadEncyclopedia: jest.fn(),
  saveEncyclopedia: jest.fn(),
}));

const { useAuth } = require("../../contexts/AuthContext");
const { loadEncyclopedia } = require("../../hooks/useEncyclopedia");

describe("EncyclopediaPanel", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      currentUser: null,
      isFirebaseAvailable: false,
    });
    loadEncyclopedia.mockResolvedValue({ "Ver.1": {}, "Ver.2": {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("도감 카드를 컨테이너 폭 기준 자동 그리드로 배치한다", async () => {
    render(<EncyclopediaPanel />);

    await waitFor(() =>
      expect(screen.queryByText("도감을 불러오는 중입니다.")).not.toBeInTheDocument()
    );

    expect(screen.getByTestId("encyclopedia-grid")).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
    });
  });
});
