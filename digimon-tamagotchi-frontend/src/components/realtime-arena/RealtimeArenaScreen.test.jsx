import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "../../contexts/AuthContext";
import useRealtimeArenaSession from "../../hooks/useRealtimeArenaSession";
import RealtimeArenaScreen from "./RealtimeArenaScreen";

jest.mock("../../contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useRealtimeArenaSession", () => jest.fn());
jest.mock("./RealtimeArenaLobby", () => function MockRealtimeArenaLobby() {
  return <div data-testid="realtime-arena-lobby" />;
});
jest.mock("./RealtimeArenaBattleBoard", () => function MockRealtimeArenaBattleBoard() {
  return <div data-testid="realtime-arena-battle-board" />;
});
jest.mock("./RealtimeArenaResult", () => function MockRealtimeArenaResult({ onCloseSession }) {
  return <button type="button" onClick={onCloseSession}>로비로 돌아가기</button>;
});

const SESSION_KEY = "realtime_arena_active_battle_id";

function createSession(overrides = {}) {
  return {
    battle: null,
    viewer: null,
    busy: false,
    error: "",
    remainingMs: 0,
    rooms: [],
    roomsLoading: false,
    roomsError: "",
    selectedAction: null,
    selectionSaving: false,
    recovering: false,
    presentationActive: false,
    selectionOpen: false,
    selectionCountdownMs: 0,
    clockMs: Date.now(),
    closeSession: jest.fn(() => sessionStorage.removeItem(SESSION_KEY)),
    runCommand: jest.fn().mockResolvedValue(null),
    refreshRooms: jest.fn(),
    createBattle: jest.fn(),
    createCpuBattle: jest.fn(),
    joinBattle: jest.fn(),
    selectAction: jest.fn(),
    ...overrides,
  };
}

function renderScreen(session, onClose = jest.fn()) {
  useRealtimeArenaSession.mockReturnValue(session);
  render(<RealtimeArenaScreen currentSlotId={1} onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  useAuth.mockReturnValue({ currentUser: { uid: "user-1" } });
});

test("종료된 배틀에서 X를 누르면 세션과 저장된 배틀 ID를 지우고 모달을 닫는다", () => {
  sessionStorage.setItem(SESSION_KEY, "rtb_finished");
  const session = createSession({ battle: { status: "finished", result: { outcome: "host_win", reason: "ko" } } });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));

  expect(session.runCommand).not.toHaveBeenCalled();
  expect(session.closeSession).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("판정 연출 중인 finished 배틀도 서버 호출 없이 세션을 정리한다", () => {
  const session = createSession({
    battle: { status: "finished", resolvedRounds: [{ round: 1 }] },
    presentationActive: true,
  });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));

  expect(session.runCommand).not.toHaveBeenCalled();
  expect(session.closeSession).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("배경 클릭도 종료된 배틀의 세션 정리 흐름을 사용한다", () => {
  const session = createSession({ battle: { status: "cancelled" } });
  const onClose = renderScreen(session);

  fireEvent.click(document.querySelector(".realtime-arena-overlay"));

  expect(session.closeSession).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("선택 단계에서만 모달 본문에 모바일 action dock 여백을 예약한다", () => {
  const session = createSession({ battle: { status: "selecting" } });
  renderScreen(session);

  expect(document.querySelector(".realtime-arena-dialog__body")).toHaveClass("has-action-dock");
});

test("판정 연출 중에는 모바일 action dock 여백을 예약하지 않는다", () => {
  const session = createSession({ battle: { status: "selecting" }, presentationActive: true });
  renderScreen(session);

  expect(document.querySelector(".realtime-arena-dialog__body")).not.toHaveClass("has-action-dock");
});

test("진행 중 배틀에서 종료 확인을 취소하면 포기하지 않는다", () => {
  const session = createSession({ battle: { status: "selecting" } });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

  expect(session.runCommand).not.toHaveBeenCalled();
  expect(session.closeSession).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("진행 중 배틀을 확인 후 포기하면 forfeit, 세션 정리, 부모 닫기 순서로 처리한다", async () => {
  sessionStorage.setItem(SESSION_KEY, "rtb_selecting");
  const session = createSession({ battle: { status: "selecting" } });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));
  fireEvent.click(screen.getByRole("button", { name: "배틀 포기" }));

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(session.runCommand).toHaveBeenCalledWith("forfeit");
  expect(session.closeSession).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect(session.runCommand.mock.invocationCallOrder[0]).toBeLessThan(session.closeSession.mock.invocationCallOrder[0]);
  expect(session.closeSession.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
});

test.each([
  ["host", "cancel"],
  ["guest", "leave"],
])("%s 대기방은 종료 확인 후 %s 명령을 실행한다", async (role, command) => {
  const session = createSession({
    battle: { status: "waiting" },
    viewer: { role },
  });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));
  fireEvent.click(screen.getByRole("button", { name: "대기방 종료" }));

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(session.runCommand).toHaveBeenCalledWith(command);
  expect(session.closeSession).toHaveBeenCalledTimes(1);
});

test("종료 명령이 실패하면 화면과 확인창을 유지하고 오류를 표시한다", async () => {
  const session = createSession({
    battle: { status: "selecting" },
    runCommand: jest.fn().mockRejectedValue(new Error("배틀 종료에 실패했습니다.")),
  });
  const onClose = renderScreen(session);

  fireEvent.click(screen.getByRole("button", { name: "실시간 배틀 닫기" }));
  fireEvent.click(screen.getByRole("button", { name: "배틀 포기" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("배틀 종료에 실패했습니다."));
  expect(session.closeSession).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});
