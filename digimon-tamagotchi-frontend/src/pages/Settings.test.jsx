import React from "react";
import { render, screen } from "@testing-library/react";
import Settings from "./Settings";

const mockLogout = jest.fn();
const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockAccountSettingsPanel = jest.fn();

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

jest.mock("../hooks/useTamerProfile", () => ({
  __esModule: true,
  default: () => mockUseTamerProfile(),
}));

jest.mock("../hooks/useUserSlots", () => ({
  __esModule: true,
  default: () => mockUseUserSlots(),
}));

jest.mock("../components/panels/AccountSettingsPanel", () => ({
  __esModule: true,
  default: (props) => {
    mockAccountSettingsPanel(props);
    return (
      <div data-testid="account-settings-panel">
        {`focus:${props.focusSection || "none"} / install:${props.installSectionId || "none"}`}
      </div>
    );
  },
}));

describe("Settings", () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockNavigate.mockReset();
    mockUseLocation.mockReturnValue({ hash: "" });
    mockUseTamerProfile.mockReturnValue({
      tamerName: "한솔",
      setTamerName: jest.fn(),
      displayTamerName: "한솔",
      maxSlots: 10,
      refreshProfile: jest.fn(),
    });
    mockUseUserSlots.mockReturnValue({
      slots: [{ id: 1 }],
    });
    mockAccountSettingsPanel.mockReset();
  });

  test("설정 페이지는 홈화면에 추가까지 포함한 설명을 보여준다", () => {
    render(<Settings />);

    expect(
      screen.getByText(
        "테이머명, 화면 테마, 홈화면에 추가, Discord 알림, 로그아웃을 한 화면에서 관리할 수 있습니다."
      )
    ).toBeInTheDocument();
  });

  test("install 해시로 진입하면 계정 설정 패널에 focusSection을 전달한다", () => {
    mockUseLocation.mockReturnValue({ hash: "#install" });

    render(<Settings />);

    expect(screen.getByTestId("account-settings-panel")).toHaveTextContent(
      "focus:install / install:install"
    );
  });
});
