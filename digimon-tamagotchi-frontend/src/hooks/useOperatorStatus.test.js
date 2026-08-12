import { renderHook, waitFor } from "@testing-library/react";
import useOperatorStatus from "./useOperatorStatus";
import { fetchOperatorStatus } from "../utils/operatorApi";

let mockCurrentUser = null;

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock("../utils/operatorApi", () => ({
  fetchOperatorStatus: jest.fn(),
}));

describe("useOperatorStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
  });

  test("동일한 로그인 사용자로 재렌더해도 운영자 상태를 한 번만 조회한다", async () => {
    mockCurrentUser = { uid: "operator-1" };
    fetchOperatorStatus.mockResolvedValue({
      isOperator: true,
      canAccessUserDirectory: true,
    });

    const { result, rerender } = renderHook(() => useOperatorStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operatorStatus).toEqual({
      isOperator: true,
      canAccessUserDirectory: true,
    });

    rerender();

    expect(fetchOperatorStatus).toHaveBeenCalledTimes(1);
    expect(fetchOperatorStatus).toHaveBeenCalledWith(mockCurrentUser);
  });

  test("조회가 실패하면 권한을 허용하지 않고 오류를 보관한다", async () => {
    mockCurrentUser = { uid: "user-1" };
    fetchOperatorStatus.mockRejectedValue(new Error("운영자 확인 실패"));

    const { result } = renderHook(() => useOperatorStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.operatorStatus).toEqual({
      isOperator: false,
      canAccessUserDirectory: false,
    });
    expect(result.current.error).toBe("운영자 확인 실패");
  });

  test("로그아웃하면 조회하지 않고 권한을 초기화한다", async () => {
    const { result } = renderHook(() => useOperatorStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchOperatorStatus).not.toHaveBeenCalled();
    expect(result.current.operatorStatus).toEqual({
      isOperator: false,
      canAccessUserDirectory: false,
    });
  });
});
