import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GameSyncConflictDialog, {
  buildSyncConflictDiagnostic,
} from "./GameSyncConflictDialog";

describe("GameSyncConflictDialog", () => {
  test("명시적 확인 후 서버 복구만 요청한다", async () => {
    const onResolve = jest.fn().mockResolvedValue(true);
    jest.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <GameSyncConflictDialog
        conflict={{ expectedRevision: 2, actualRevision: 3 }}
        onResolve={onResolve}
      />
    );

    expect(screen.queryByRole("button", { name: "이 기기 상태 사용" })).not.toBeInTheDocument();
    expect(screen.getByText(/활동·배틀·먹이 기록은 보존됩니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "서버에서 다시 불러오기" }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("server"));
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

    fireEvent.click(screen.getByRole("button", { name: "서버에서 다시 불러오기" }));
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

    fireEvent.click(screen.getByRole("button", { name: "서버에서 다시 불러오기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("동기화에 실패했습니다");
    consoleSpy.mockRestore();
    window.confirm.mockRestore();
  });

  test("실제 분류와 기기 저장 시각을 설명한다", () => {
    render(
      <GameSyncConflictDialog
        conflict={{
          classification: "TERMINAL_STATE_MISMATCH",
          expectedRevision: 4,
          actualRevision: 4,
          localSavedAt: Date.parse("2026-07-24T00:00:00.000Z"),
        }}
      />
    );

    expect(screen.getByText(/생존·사망·환생 상태/)).toBeInTheDocument();
    expect(screen.getByText(/분류: TERMINAL_STATE_MISMATCH/)).toBeInTheDocument();
    expect(screen.getByText(/기기 저장 시각:/)).toBeInTheDocument();
  });

  test("진단 정보에는 UID와 snapshot 본문을 포함하지 않는다", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const conflict = {
      identity: { uid: "secret-user", slotId: 2, generation: 7 },
      classification: "TRUE_REMOTE_CONFLICT",
      expectedRevision: 4,
      actualRevision: 6,
      localSavedAt: 1234,
      recoveryResult: "failed",
      errorCode: "network/offline",
      localState: { fullness: 5 },
    };
    render(
      <GameSyncConflictDialog
        conflict={conflict}
        persistencePhase="ready"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "진단 정보 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(JSON.parse(copied)).toEqual(buildSyncConflictDiagnostic(conflict, "ready"));
    expect(copied).not.toContain("secret-user");
    expect(copied).not.toContain("fullness");

    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      delete navigator.clipboard;
    }
  });
});
