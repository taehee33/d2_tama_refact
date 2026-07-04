import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PlayHub from "./PlayHub";

const mockNavigate = jest.fn();
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotStageLabel = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();
const mockDeleteSlot = jest.fn();

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
jest.mock("../components/play/SlotCard", () => ({ slot, onDelete }) => (
  <button type="button" onClick={onDelete}>
    슬롯 {slot.id} 삭제
  </button>
));
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
    mockDeleteSlot.mockReset();
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
      deleteSlot: mockDeleteSlot,
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: {
        id: 1,
        slotName: "슬롯1",
        selectedDigimon: "Koromon",
        device: "Digital Monster Color 25th",
        version: "Ver.1",
        createdAt: "2026-04-04T09:00:00.000Z",
        digimonStats: {
          isInjured: true,
          poopCount: 6,
        },
      },
    });
  });

  test("최근 이어하기 카드에 디지몬 썸네일을 표시한다", () => {
    render(<PlayHub />);

    expect(screen.getByRole("img", { name: "뿔몬 썸네일" })).toHaveAttribute(
      "src",
      "/images/225.png"
    );
    expect(screen.getByText("유아기 · Digital Monster Color 25th / Ver.1")).toBeInTheDocument();
    expect(screen.getByText("슬롯 1")).toBeInTheDocument();
    expect(screen.getByText(/생성일/)).toBeInTheDocument();
    expect(screen.getByLabelText("최근 슬롯 상태")).toBeInTheDocument();
    expect(screen.getByText("치료 필요: 부상 🏥")).toBeInTheDocument();
    expect(screen.getByText("똥 많음 💩")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이어하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "몰입형 화면" })).not.toBeInTheDocument();
  });

  test("최근 이어하기 카드에 게임 화면과 같은 수면 조명 경고 상태를 표시한다", () => {
    mockUseUserSlots.mockReturnValue({
      slots: [],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: mockDeleteSlot,
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: {
        id: 4,
        slotName: "슬롯4",
        selectedDigimon: "Punimon",
        device: "Digital Monster Color 25th",
        version: "Ver.2",
        createdAt: "2026-06-29T00:41:33.000Z",
        isLightsOn: true,
        projectedDigimonStats: {
          fullness: 2,
          strength: 1,
          sleepSchedule: { start: 0, end: 23, startMinute: 0, endMinute: 59 },
          sleepLightOnStart: Date.now() - 40 * 60 * 1000,
          callStatus: {
            hunger: { isActive: false },
            strength: { isActive: false },
            sleep: { isActive: true, isLogged: true },
          },
        },
      },
    });

    render(<PlayHub />);

    expect(screen.getByLabelText("최근 슬롯 상태")).toBeInTheDocument();
    expect(screen.getByText("수면 중(불 켜짐 경고! · 케어미스 처리됨) 😴")).toBeInTheDocument();
    expect(screen.getByText("힘 낮음 💪")).toBeInTheDocument();
  });

  test("슬롯이 있을 때 허브 운영 기준 카드는 더 이상 보이지 않는다", () => {
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          slotName: "슬롯1",
          selectedDigimon: "Koromon",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: mockDeleteSlot,
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: {
        id: 1,
        slotName: "슬롯1",
        selectedDigimon: "Koromon",
        device: "Digital Monster Color 25th",
        version: "Ver.1",
        createdAt: "2026-04-04T09:00:00.000Z",
      },
    });

    render(<PlayHub />);

    expect(screen.queryByText("허브 운영 기준")).not.toBeInTheDocument();
    expect(screen.queryByText("정렬과 보관")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "관련 페이지" })).toBeInTheDocument();
  });

  test("삭제 시 디지몬 이름이 일치해야 슬롯을 삭제한다", () => {
    jest.spyOn(window, "prompt").mockReturnValue("뿔몬");
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          slotName: "슬롯1",
          selectedDigimon: "Koromon",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: mockDeleteSlot,
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: null,
    });

    render(<PlayHub />);

    fireEvent.click(screen.getByRole("button", { name: "슬롯 1 삭제" }));

    expect(window.prompt).toHaveBeenCalledWith(
      '슬롯 1의 뿔몬을 삭제하려면 디지몬 이름을 정확히 입력하세요.\n"뿔몬"'
    );
    expect(mockDeleteSlot).toHaveBeenCalledWith(1);

    window.prompt.mockRestore();
  });

  test("삭제 이름이 일치하지 않으면 슬롯을 삭제하지 않는다", () => {
    jest.spyOn(window, "prompt").mockReturnValue("다른 이름");
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          slotName: "슬롯1",
          selectedDigimon: "Koromon",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
      loading: false,
      error: "",
      createSlot: jest.fn(),
      deleteSlot: mockDeleteSlot,
      saveNickname: jest.fn(),
      resetNickname: jest.fn(),
      saveOrder: jest.fn(),
      canCreateMore: true,
      recentSlot: null,
    });

    render(<PlayHub />);

    fireEvent.click(screen.getByRole("button", { name: "슬롯 1 삭제" }));

    expect(mockDeleteSlot).not.toHaveBeenCalled();
    expect(screen.getByText("입력한 이름이 일치하지 않아 뿔몬을 삭제하지 않았습니다.")).toBeInTheDocument();

    window.prompt.mockRestore();
  });
});
