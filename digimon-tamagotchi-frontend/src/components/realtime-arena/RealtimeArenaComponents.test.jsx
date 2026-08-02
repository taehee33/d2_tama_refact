import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RealtimeArenaActionPanel from "./RealtimeArenaActionPanel";
import RealtimeArenaLobby from "./RealtimeArenaLobby";
import RealtimeArenaBattleBoard from "./RealtimeArenaBattleBoard";
import RealtimeArenaResult from "./RealtimeArenaResult";

test("행동 패널은 세 행동을 한국어로 표시하고 한 번 선택한다", () => {
  const onSubmit = jest.fn();
  render(<RealtimeArenaActionPanel disabled={false} selectedAction={null} saving={false} remainingMs={7000} onSubmit={onSubmit} />);
  expect(screen.getByRole("button", { name: /^공격 선택$/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^방어 선택$/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^특수공격 선택$/ }));
  expect(onSubmit).toHaveBeenCalledWith("special_attack");
});
test("마감 전에는 현재 선택을 강조하고 변경 가능함을 알린다", () => {
  render(<RealtimeArenaActionPanel disabled={false} selectedAction="guard" saving={false} remainingMs={4000} onSubmit={() => {}} />);
  expect(screen.getByRole("button", { name: /방어/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/마감 전까지 변경할 수 있습니다/)).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "선택 안내" })).not.toHaveClass("is-urgent");
});

test("남은 선택 시간은 안내 영역에서 3초부터 빨간색으로 강조한다", () => {
  render(<RealtimeArenaActionPanel disabled={false} selectedAction={null} saving={false} remainingMs={3000} onSubmit={() => {}} />);
  expect(screen.getByLabelText("남은 선택 시간 3초")).toHaveTextContent("3초");
  expect(screen.getByRole("status", { name: "선택 안내" })).toHaveClass("is-urgent");
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

test("CPU와 배틀은 연습전 확인 뒤에 시작한다", () => {
  const onCreateCpu = jest.fn();
  render(<RealtimeArenaLobby battle={null} viewer={null} busy={false} rooms={[]} onRefreshRooms={jest.fn()} onCreate={jest.fn()} onCreateCpu={onCreateCpu} onJoin={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "CPU와 배틀" }));
  expect(screen.getByText("VS CPU는 승패 기록과 보상에 반영되지 않는 연습전입니다. 시작할까요?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "배틀 시작" }));
  expect(onCreateCpu).toHaveBeenCalledTimes(1);
});

test("CPU 전투 화면은 나와 CPU의 이름, 단계, 모습을 즉시 공개한다", () => {
  const participant = (name, stage, sprite, attribute, sourcePower) => ({ digimonName: name, stage, maxHp: 13, spriteBasePath: "/images", sprite, attribute, sourcePower });
  render(
    <RealtimeArenaBattleBoard
      battle={{
        mode: "cpu", status: "selecting", round: 1, maxRounds: 7, currentHp: { host: 13, guest: 13 }, resolvedRounds: [],
        participants: { host: participant("아구몬", "성장기", 1, "Vaccine", 80), guest: participant("파피몬", "성숙기", 2, "Virus", 75) },
      }}
      viewer={{ role: "host", hasSubmitted: false }}
      remainingMs={7000}
      busy={false}
      onSubmit={jest.fn()}
      onForfeit={jest.fn()}
      selectedAction={null}
      selectionSaving={false}
      recovering={false}
      presentationActive={false}
      selectionOpen
      clockMs={Date.now()}
    />
  );
  expect(screen.getByText("나")).toBeInTheDocument();
  expect(screen.getByText("CPU")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "파피몬 모습" })).toHaveAttribute("src", "/images/2.png");
  expect(screen.getByText("성숙기")).toBeInTheDocument();
  expect(screen.getByLabelText("양쪽 행동 현황")).toHaveTextContent("나: 선택 대기CPU: 선택 대기");
  expect(screen.getByRole("group", { name: "나 행동" })).toHaveClass("is-own");
  expect(screen.getByRole("group", { name: "CPU 행동" })).toHaveClass("is-opponent");
  expect(screen.getByText("파워 80")).toBeInTheDocument();
  expect(screen.getByText("백신(유리)")).toHaveClass("is-advantage");
  expect(screen.getByText("바이러스(불리)")).toHaveClass("is-disadvantage");
  expect(screen.getByLabelText("남은 선택 시간 7초")).toBeInTheDocument();
});

test("행동 현황은 고정하고 최근 라운드 결과는 행동 선택 버튼 아래에 표시한다", () => {
  const participant = (name, sprite) => ({ digimonName: name, stage: "Adult", maxHp: 13, spriteBasePath: "/images", sprite });
  render(
    <RealtimeArenaBattleBoard
      battle={{
        mode: "pvp", status: "selecting", round: 2, maxRounds: 7,
        currentHp: { host: 13, guest: 9 },
        participants: { host: participant("아구몬", 1), guest: participant("파피몬", 2) },
        resolvedRounds: [{ round: 1, hostAction: "attack", guestAction: "guard", hostDamageTaken: 0, guestDamageTaken: 4, selectionSources: { host: "manual", guest: "manual" } }],
      }}
      viewer={{ role: "host" }}
      remainingMs={6500}
      busy={false}
      selectedAction="guard"
      selectionSaving={false}
      recovering={false}
      presentationActive={false}
      selectionOpen
      clockMs={Date.now()}
      onSubmit={jest.fn()}
      onForfeit={jest.fn()}
    />
  );
  const actionStatus = screen.getByRole("region", { name: "양쪽 행동 현황" });
  const actionSelection = screen.getByRole("region", { name: "행동 선택 영역" });
  const recentResult = screen.getByRole("region", { name: "최근 라운드 결과" });
  expect(actionStatus).toHaveTextContent("나: 방어");
  expect(actionStatus).toHaveTextContent("상대: 선택 대기");
  expect(screen.getAllByRole("region")).toEqual([actionStatus, actionSelection, recentResult]);
  expect(screen.getByLabelText("나 최근 결과")).toHaveClass("is-own");
  expect(screen.getByLabelText("나 최근 결과")).toHaveTextContent("나공격받은 피해 0");
  expect(screen.getByLabelText("상대 최근 결과")).toHaveClass("is-opponent");
  expect(screen.getByLabelText("상대 최근 결과")).toHaveTextContent("상대방어받은 피해 4");
});

test("판정 연출은 양쪽 행동과 자동 선택, 방패, 실제 피해량을 공개한다", () => {
  const presentationEndsAt = new Date(Date.now() + 300).toISOString();
  const participant = (name, sprite) => ({ digimonName: name, stage: "Adult", maxHp: 13, spriteBasePath: "/images", sprite, attackSprite: sprite + 100 });
  render(
    <RealtimeArenaBattleBoard
      battle={{
        mode: "pvp",
        status: "selecting",
        round: 2,
        maxRounds: 7,
        presentationEndsAt,
        rulesSnapshot: { presentationWindowMs: 2200 },
        currentHp: { host: 9, guest: 13 },
        participants: { host: participant("아구몬", 1), guest: participant("파피몬", 2) },
        resolvedRounds: [{
          round: 1,
          hostAction: "attack",
          guestAction: "guard",
          hostDamageTaken: 4,
          guestDamageTaken: 0,
          selectionSources: { host: "auto", guest: "manual" },
        }],
      }}
      viewer={{ role: "host" }}
      remainingMs={0}
      busy={false}
      selectedAction={null}
      selectionSaving={false}
      recovering={false}
      presentationActive
      selectionOpen={false}
      clockMs={Date.now()}
      onSubmit={jest.fn()}
      onForfeit={jest.fn()}
    />
  );
  expect(screen.getByRole("group", { name: "나 행동" })).toHaveTextContent("나: 공격");
  expect(screen.getByText("자동 선택")).toBeInTheDocument();
  expect(screen.getByLabelText("방패 방어")).toBeInTheDocument();
  expect(screen.getByLabelText("4 피해")).toHaveTextContent("-4");
});

test("CPU 결과는 사용자 관점의 승리와 패배로 표시한다", () => {
  const { rerender } = render(<RealtimeArenaResult battle={{ mode: "cpu", result: { outcome: "host_win", reason: "ko" } }} onCloseSession={() => {}} />);
  expect(screen.getByText("승리")).toBeInTheDocument();
  rerender(<RealtimeArenaResult battle={{ mode: "cpu", result: { outcome: "guest_win", reason: "ko" } }} onCloseSession={() => {}} />);
  expect(screen.getByText("패배")).toBeInTheDocument();
});
