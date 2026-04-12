import React from "react";
import { render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("heading", { name: "사용자 디렉터리" })).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("사용자 디렉터리 패널: operator-1")).toBeInTheDocument();
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
    expect(screen.queryByText(/사용자 디렉터리 패널/)).not.toBeInTheDocument();
  });
});
