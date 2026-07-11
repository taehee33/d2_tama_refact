import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import OperatorUsers from "./OperatorUsers";

const mockUseAuth = jest.fn();
const mockUseOperatorStatus = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../hooks/useOperatorStatus", () => ({
  __esModule: true,
  default: () => mockUseOperatorStatus(),
}));

jest.mock("../components/admin/UserDirectoryPanel", () => (props) => (
  <div>사용자 디렉터리 패널: {props.currentUser?.uid}</div>
));

jest.mock("../components/DigimonMasterDataPanel", () => () => (
  <div>마스터 데이터 패널</div>
));

describe("OperatorUsers", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: "operator-1",
      },
    });
    mockUseOperatorStatus.mockReturnValue({
      operatorStatus: {
        isOperator: true,
        canAccessUserDirectory: true,
      },
      isLoading: false,
      error: "",
    });
  });

  test("운영자면 사용자 디렉터리 패널을 렌더링한다", () => {
    render(<OperatorUsers />);

    expect(screen.getByRole("heading", { name: "운영자 설정" })).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "사용자관리" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("사용자 디렉터리 패널: operator-1")).toBeInTheDocument();
  });

  test("디지몬 마스터 데이터 탭으로 전환한다", () => {
    render(<OperatorUsers />);

    fireEvent.click(screen.getByRole("tab", { name: "디지몬 마스터 데이터" }));

    expect(screen.getByText("마스터 데이터 패널")).toBeInTheDocument();
    expect(screen.queryByText(/사용자 디렉터리 패널/)).not.toBeInTheDocument();
  });

  test("권한이 없으면 접근 제한 안내를 보여 준다", () => {
    mockUseOperatorStatus.mockReturnValue({
      operatorStatus: {
        isOperator: false,
        canAccessUserDirectory: false,
      },
      isLoading: false,
      error: "",
    });

    render(<OperatorUsers />);

    expect(screen.getByText("운영자 권한이 필요합니다")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/사용자 디렉터리 패널/)).not.toBeInTheDocument();
  });
});
