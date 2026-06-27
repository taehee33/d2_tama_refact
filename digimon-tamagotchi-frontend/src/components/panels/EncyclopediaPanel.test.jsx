import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const {
  addMissingEncyclopediaEntries,
  loadEncyclopedia,
} = require("../../hooks/useEncyclopedia");

describe("EncyclopediaPanel", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      currentUser: null,
      isFirebaseAvailable: false,
    });
    loadEncyclopedia.mockResolvedValue({
      "Ver.1": {},
      "Ver.2": {},
      "Ver.3": {},
      "Ver.4": {},
      "Ver.5": {},
    });
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

  it("개발자 모드에서는 물음표 표시가 켜져도 미발견 항목을 공개한다", async () => {
    render(
      <EncyclopediaPanel developerMode encyclopediaShowQuestionMark />
    );

    await waitFor(() =>
      expect(screen.queryByText("도감을 불러오는 중입니다.")).not.toBeInTheDocument()
    );

    expect(screen.getByRole("img", { name: "아구몬" })).toHaveStyle({
      filter: "none",
      opacity: "1",
    });
    expect(screen.getByText("아구몬")).toBeInTheDocument();
    expect(screen.getAllByText("성장기").length).toBeGreaterThan(0);
  });

  it("개발자 모드에서는 물음표 표시가 꺼져도 미발견 항목을 공개한다", async () => {
    render(
      <EncyclopediaPanel developerMode encyclopediaShowQuestionMark={false} />
    );

    await waitFor(() =>
      expect(screen.queryByText("도감을 불러오는 중입니다.")).not.toBeInTheDocument()
    );

    expect(screen.getByRole("img", { name: "아구몬" })).toBeInTheDocument();
    expect(screen.getByText("아구몬")).toBeInTheDocument();
  });

  it("개발자 모드가 꺼져 있으면 미발견 항목을 흐리게 잠근다", async () => {
    render(
      <EncyclopediaPanel developerMode={false} encyclopediaShowQuestionMark />
    );

    await waitFor(() =>
      expect(screen.queryByText("도감을 불러오는 중입니다.")).not.toBeInTheDocument()
    );

    expect(screen.getByRole("img", { name: "아구몬" })).toHaveStyle({
      filter: "blur(8px) grayscale(100%)",
      opacity: "0.5",
    });
    expect(screen.queryByText("아구몬")).not.toBeInTheDocument();
    expect(screen.getAllByText("???").length).toBeGreaterThan(0);
    expect(screen.getAllByText("🔒").length).toBeGreaterThan(0);
  });

  it("도감 저장 실패 시 Firestore 단계 정보를 포함해 보여준다", async () => {
    useAuth.mockReturnValue({
      currentUser: { uid: "tester" },
      isFirebaseAvailable: true,
    });
    addMissingEncyclopediaEntries.mockRejectedValueOnce({
      message: "도감 저장 실패 (canonical:Ver.2)",
      stage: "canonical",
      details: [
        {
          stage: "canonical",
          version: "Ver.2",
        },
      ],
    });

    render(<EncyclopediaPanel currentDigimonId="Elecmon" />);

    await waitFor(() =>
      expect(screen.queryByText("도감을 불러오는 중입니다.")).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("현재 디지몬을 도감에 반영하기"));

    await waitFor(() =>
      expect(
        screen.getByText("보정 실패 (canonical): 도감 저장 실패 (canonical:Ver.2)")
      ).toBeInTheDocument()
    );
  });
});
