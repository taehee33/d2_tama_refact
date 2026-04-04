import React from "react";
import { render, screen } from "@testing-library/react";
import PlayHub from "./PlayHub";

const mockNavigate = jest.fn();
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotStageLabel = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../components/AdBanner", () => () => <div data-testid="ad-banner" />);
jest.mock("../components/KakaoAd", () => () => <div data-testid="kakao-ad" />);
jest.mock("../components/play/NewDigimonModal", () => () => null);
jest.mock("../components/play/SlotCard", () => () => null);
jest.mock("../components/play/SlotOrderModal", () => () => null);

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
  getSlotSpriteSrc: (...args) => mockGetSlotSpriteSrc(...args),
}));

describe("PlayHub", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetSlotDisplayName.mockReturnValue("뿔몬");
    mockGetSlotStageLabel.mockReturnValue("유아기");
    mockGetSlotSpriteSrc.mockReturnValue("/images/225.png");
    mockUseTamerProfile.mockReturnValue({
      displayTamerName: "한솔",
      achievements: [],
      maxSlots: 10,
    });
    mockUseUserSlots.mockReturnValue({
      slots: [],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: jest.fn(),
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: {
        id: 1,
        selectedDigimon: "Koromon",
        version: "Ver.1",
      },
    });
  });

  test("최근 이어하기 카드에 디지몬 썸네일을 표시한다", () => {
    render(<PlayHub />);

    expect(screen.getByRole("img", { name: "뿔몬 썸네일" })).toHaveAttribute(
      "src",
      "/images/225.png"
    );
    expect(screen.getByRole("button", { name: "이어하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "몰입형 화면" })).toBeInTheDocument();
  });

  test("슬롯이 있을 때 허브 운영 기준 카드는 더 이상 보이지 않는다", () => {
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          selectedDigimon: "Koromon",
          version: "Ver.1",
        },
      ],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: jest.fn(),
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: {
        id: 1,
        selectedDigimon: "Koromon",
        version: "Ver.1",
      },
    });

    render(<PlayHub />);

    expect(screen.queryByText("허브 운영 기준")).not.toBeInTheDocument();
    expect(screen.queryByText("정렬과 보관")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "관련 페이지" })).toBeInTheDocument();
  });
});
