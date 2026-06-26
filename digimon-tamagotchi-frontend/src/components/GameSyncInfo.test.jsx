import React from "react";
import { render, screen } from "@testing-library/react";
import GameSyncInfo from "./GameSyncInfo";

describe("GameSyncInfo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-21T15:00:28+09:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("게임 상태와 먹이 기록의 실제 남은 시간을 분리해 표시한다", () => {
    render(
      <GameSyncInfo
        syncInfo={{
          mode: "firebase",
          stateSyncStatus: "synced",
          recordSyncStatus: "feed_pending",
          nextStateSyncAt: new Date("2026-06-21T15:15:28+09:00").getTime(),
          nextRecordSyncAt: new Date("2026-06-21T15:15:00+09:00").getTime(),
          pendingRecordCount: 2,
          lastStateSyncedAt: new Date("2026-06-21T15:00:10+09:00").getTime(),
          lastRecordSyncedAt: new Date("2026-06-21T14:58:00+09:00").getTime(),
        }}
      />
    );

    expect(screen.getByText("서버 저장 완료")).toBeInTheDocument();
    expect(screen.getByText(/15분 0초 후/)).toBeInTheDocument();
    expect(screen.getByText(/먹이 기록 요약 대기 · 14분 32초 후/)).toBeInTheDocument();
    expect(screen.getByText("마지막 서버 저장")).toBeInTheDocument();
    expect(screen.getByText("마지막 기록 동기화")).toBeInTheDocument();
    expect(screen.getByText(/중요한 행동은 즉시 이 기기에 보존/)).toBeInTheDocument();
  });

  test("서버 저장과 기록 동기화 오류를 카드에 표시한다", () => {
    render(
      <GameSyncInfo
        syncInfo={{
          mode: "firebase",
          stateSyncStatus: "local",
          recordSyncStatus: "local",
          retryAt: new Date("2026-06-21T15:05:28+09:00").getTime(),
          pendingRecordCount: 3,
          stateSyncError: "offline",
          recordSyncError: "permission denied",
        }}
      />
    );

    expect(screen.getByText("서버 저장 대기")).toBeInTheDocument();
    expect(screen.getByText("상태 오류")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("기록 오류")).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });

  test("로컬 모드는 서버 카운트다운 없이 기기 저장 상태를 표시한다", () => {
    render(<GameSyncInfo syncInfo={{ mode: "local" }} />);
    expect(screen.getByText("로컬 모드 · 이 기기에 저장됨")).toBeInTheDocument();
    expect(screen.queryByText("다음 정기 저장")).not.toBeInTheDocument();
  });
});
