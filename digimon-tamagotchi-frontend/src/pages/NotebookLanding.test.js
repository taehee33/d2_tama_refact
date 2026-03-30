import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import NotebookLanding from "./NotebookLanding";

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotStageLabel = jest.fn();

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../hooks/useTamerProfile", () => ({
  __esModule: true,
  default: () => mockUseTamerProfile(),
}));

jest.mock("../hooks/useUserSlots", () => ({
  __esModule: true,
  default: () => mockUseUserSlots(),
}));

jest.mock("../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotStageLabel: (...args) => mockGetSlotStageLabel(...args),
}));

describe("NotebookLanding", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetSlotDisplayName.mockReset();
    mockGetSlotStageLabel.mockReset();

    mockUseAuth.mockReturnValue({
      currentUser: null,
    });

    mockUseTamerProfile.mockReturnValue({
      displayTamerName: "한솔",
      hasVer1Master: false,
      hasVer2Master: false,
      maxSlots: 10,
    });

    mockUseUserSlots.mockReturnValue({
      slots: [],
      loading: false,
      recentSlot: null,
    });
  });

  test("비로그인 상태에서 파일 섬 아이콘과 로그인 window를 렌더링한다", () => {
    render(<NotebookLanding />);

    expect(screen.getByRole("button", { name: "파일 섬" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "폴더 섬" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추억" })).toBeInTheDocument();
    expect(screen.getByText("DIGITAL")).toBeInTheDocument();
    expect(screen.getByText("WORLD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "접속하기 (START)" }));
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  test("추억 아이콘을 누르면 마지막 열차 메모 window가 열린다", () => {
    render(<NotebookLanding />);

    fireEvent.click(screen.getByRole("button", { name: "추억" }));

    expect(screen.getByText("MEMORY")).toBeInTheDocument();
    expect(screen.getByText("NOTE")).toBeInTheDocument();
    expect(screen.getByText("마지막 열차에서 안녕")).toBeInTheDocument();
  });

  test("로그인 상태에서는 최근 디지몬 이어하기 CTA를 보여 준다", () => {
    const recentSlot = {
      id: 7,
      selectedDigimon: "Agumon",
      version: "Ver.1",
    };

    mockUseAuth.mockReturnValue({
      currentUser: { uid: "tester" },
    });

    mockUseTamerProfile.mockReturnValue({
      displayTamerName: "한솔",
      hasVer1Master: true,
      hasVer2Master: false,
      maxSlots: 10,
    });

    mockUseUserSlots.mockReturnValue({
      slots: [recentSlot],
      loading: false,
      recentSlot,
    });

    mockGetSlotDisplayName.mockReturnValue("아구몬");
    mockGetSlotStageLabel.mockReturnValue("성장기");

    render(<NotebookLanding />);

    expect(screen.getByText("아구몬")).toBeInTheDocument();
    expect(screen.getByText("한솔::SLOT-7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이어가기 (START)" }));

    expect(mockNavigate).toHaveBeenCalledWith("/play/7");
  });
});
