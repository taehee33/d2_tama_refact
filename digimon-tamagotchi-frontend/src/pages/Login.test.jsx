import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import Login from "./Login";

const mockNavigate = jest.fn();
const mockLocation = {
  state: undefined,
};
const mockAuthState = {
  signInWithGoogle: jest.fn(),
  signInAnonymously: jest.fn(),
  currentUser: null,
  isFirebaseAvailable: true,
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}), { virtual: true });

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("../utils/tamerNameUtils", () => ({
  initializeTamerName: jest.fn(),
}));

describe("Login", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    mockNavigate.mockReset();
    mockLocation.state = undefined;
    mockAuthState.currentUser = null;
    mockAuthState.isFirebaseAvailable = true;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("설명 카드 없이 로그인 방법 선택 카드만 렌더링한다", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: "로그인 방법 선택" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /게스트로 시작/ })).toBeInTheDocument();
    expect(
      screen.getByText("로그인 후에는 기본적으로 플레이 허브로 이동합니다.")
    ).toBeInTheDocument();

    expect(screen.queryByText("디지몬 서비스 셸에 로그인")).not.toBeInTheDocument();
    expect(screen.queryByText("플레이 허브")).not.toBeInTheDocument();
    expect(screen.queryByText("테이머 허브")).not.toBeInTheDocument();
  });

  test("Firebase가 비활성화된 경우 기존 경고 박스를 유지한다", () => {
    mockAuthState.isFirebaseAvailable = false;

    render(<Login />);

    expect(screen.getByText("Firebase가 설정되지 않았습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("Firebase 설정이 필요합니다. .env 파일에 Firebase 설정을 추가해주세요.")
    ).toBeInTheDocument();
  });

  test("로그인된 사용자는 기본적으로 플레이 허브로 이동한다", async () => {
    mockAuthState.currentUser = { uid: "tester" };

    render(<Login />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/play", { replace: true });
    });
  });

  test("이전 경로가 있으면 해당 경로로 리디렉션한다", async () => {
    mockAuthState.currentUser = { uid: "tester" };
    mockLocation.state = {
      from: {
        pathname: "/me/settings",
      },
    };

    render(<Login />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/me/settings", { replace: true });
    });
  });
});
