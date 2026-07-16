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
    expect(screen.getByText(/먹이 기록 15분 요약 대기 · 14분 32초 후/)).toBeInTheDocument();
    expect(screen.getByText("현재 슬롯 저장 (Firestore 슬롯)")).toBeInTheDocument();
    expect(screen.getByText("마지막 슬롯 저장 (Firestore 슬롯)")).toBeInTheDocument();
    expect(screen.getByText("활동 기록 전송 (대기 2개 · IndexedDB → Firestore logs)")).toBeInTheDocument();
    expect(screen.getByText("마지막 활동 기록 전송 (Firestore logs)")).toBeInTheDocument();
    expect(screen.getAllByText(/오후 3:15/)).toHaveLength(2);
    expect(screen.getByText("오후 3:00")).toBeInTheDocument();
    expect(screen.getByText("오후 2:58")).toBeInTheDocument();
    expect(screen.getByText(/긴급 알림 계산과 Discord 전송 상태는 설정 화면/)).toBeInTheDocument();
    expect(screen.getByText(/중요한 행동은 즉시 이 기기에 보존하고 슬롯 저장/)).toBeInTheDocument();
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
    expect(screen.getByText("슬롯 저장 오류 (Firestore 슬롯)")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("활동 기록 오류 (IndexedDB → Firestore logs)")).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });

  test("로컬 모드는 서버 카운트다운 없이 기기 저장 상태를 표시한다", () => {
    render(<GameSyncInfo syncInfo={{ mode: "local" }} />);
    expect(screen.getByText("현재 슬롯 · 이 기기에 저장됨")).toBeInTheDocument();
    expect(screen.getByText("이 카드는 현재 슬롯과 활동 기록 저장 상태만 표시합니다.")).toBeInTheDocument();
    expect(screen.queryByText("다음 슬롯 저장 (Firestore 슬롯)")).not.toBeInTheDocument();
  });
});
