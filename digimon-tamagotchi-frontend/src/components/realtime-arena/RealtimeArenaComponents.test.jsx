import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RealtimeArenaActionPanel from "./RealtimeArenaActionPanel";
import RealtimeArenaLobby from "./RealtimeArenaLobby";
import RealtimeArenaResult from "./RealtimeArenaResult";

test("행동 패널은 세 행동을 한국어로 표시하고 한 번 선택한다", () => {
  const onSubmit = jest.fn();
  render(<RealtimeArenaActionPanel disabled={false} submitted={false} onSubmit={onSubmit} />);
  expect(screen.getByRole("button", { name: "공격" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "방어" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "특수공격" }));
  expect(onSubmit).toHaveBeenCalledWith("special_attack");
});
test("제출 뒤에는 상대 상태 없이 자신의 제출 완료만 표시한다", () => {
  render(<RealtimeArenaActionPanel disabled={false} submitted onSubmit={() => {}} />);
  expect(screen.getByText("행동 제출 완료")).toBeInTheDocument();
  expect(screen.queryByText(/상대.*제출/)).not.toBeInTheDocument();
});

test("결과는 친선전이며 랭크와 보상에 반영되지 않음을 알린다", () => {
  render(<RealtimeArenaResult battle={{ result: { outcome: "host_win", reason: "ko" } }} onCloseSession={() => {}} />);
  expect(screen.getByText("호스트 승리")).toBeInTheDocument();
  expect(screen.getByText(/랭크, 보상 및 육성 전적에는 반영되지 않습니다/)).toBeInTheDocument();
});

test("참가자 정보 복구 전에는 호스트 제어를 노출하지 않는다", () => {
  render(
    <RealtimeArenaLobby
      battle={{ battleId: "rtb_test", hostUid: "host", guestUid: null, lobby: { host: { ready: false }, guest: null } }}
      viewer={null}
      busy={false}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText("참가자 정보를 복구하는 중입니다.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "방 취소" })).not.toBeInTheDocument();
});

test("로비는 대기 중인 방을 표시하고 목록에서 참가한다", () => {
  const onJoin = jest.fn();
  render(
    <RealtimeArenaLobby
      battle={null}
      viewer={null}
      busy={false}
      rooms={[{ battleId: "rtb_room", ownerDisplayName: "레오몬 테이머", expiresAt: new Date(Date.now() + 600000).toISOString(), isOwn: false }]}
      onRefreshRooms={jest.fn()}
      onCreate={jest.fn()}
      onJoin={onJoin}
    />
  );
  expect(screen.getByRole("heading", { name: "대기 중인 방" })).toBeInTheDocument();
  expect(screen.getByText("레오몬 테이머의 ???")).toBeInTheDocument();
  expect(screen.queryByText(/^레오몬$/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "참가" }));
  expect(onJoin).toHaveBeenCalledWith("rtb_room");
});

test("대기방이 없으면 직접 방을 만들도록 안내한다", () => {
  render(<RealtimeArenaLobby battle={null} viewer={null} busy={false} rooms={[]} onRefreshRooms={jest.fn()} onCreate={jest.fn()} onJoin={jest.fn()} />);
  expect(screen.getByText("아직 대기 중인 방이 없습니다. 직접 방을 만들어 첫 대결을 시작해 보세요.")).toBeInTheDocument();
});

test("방을 만든 사람에게 만료까지 남은 시간을 표시한다", () => {
  render(
    <RealtimeArenaLobby
      battle={{ battleId: "rtb_host", hostUid: "host", guestUid: null, expiresAt: new Date(Date.now() + 600000).toISOString(), lobby: { host: { ready: false }, guest: null } }}
      viewer={{ role: "host" }}
      busy={false}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(/방 만료까지 10분 남았습니다/)).toBeInTheDocument();
});
