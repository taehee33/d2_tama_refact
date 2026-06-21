import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GameSyncConflictDialog from "./GameSyncConflictDialog";

describe("GameSyncConflictDialog", () => {
  test("명시적 확인 후 선택한 충돌 해결 방식을 전달한다", async () => {
    const onResolve = jest.fn().mockResolvedValue(true);
    jest.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <GameSyncConflictDialog
        conflict={{ expectedRevision: 2, actualRevision: 3 }}
        onResolve={onResolve}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "이 기기 상태 사용" }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("local"));
    window.confirm.mockRestore();
  });

  test("확인을 취소하면 상태를 변경하지 않는다", () => {
    const onResolve = jest.fn();
    jest.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <GameSyncConflictDialog
        conflict={{ expectedRevision: 2, actualRevision: 3 }}
        onResolve={onResolve}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "서버 상태 사용" }));
    expect(onResolve).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });

  test("충돌 해결 저장이 실패하면 다시 시도할 수 있는 오류를 표시한다", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(
      <GameSyncConflictDialog
        conflict={{ expectedRevision: 2, actualRevision: 3 }}
        onResolve={jest.fn().mockRejectedValue(new Error("offline"))}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "이 기기 상태 사용" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("동기화에 실패했습니다");
    consoleSpy.mockRestore();
    window.confirm.mockRestore();
  });
});
