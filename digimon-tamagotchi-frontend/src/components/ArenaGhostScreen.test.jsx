import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ArenaGhostScreen, { getGhostLinkLabel } from "./ArenaGhostScreen";

const mockUseAuth = jest.fn();
const mockUseArenaGhosts = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../hooks/useArenaGhosts", () => ({
  useArenaGhosts: (...args) => mockUseArenaGhosts(...args),
}));

jest.mock("./ArenaGhostHistory", () => () => <div data-testid="arena-ghost-history" />);

function createArenaState(overrides = {}) {
  return {
    myGhosts: [],
    opponents: [],
    capacity: { used: 0, limit: 3 },
    currentCombatIdentityId: "combat-current",
    currentFormRecord: { attackWins: 1, attackLosses: 2, defenseWins: 3, defenseLosses: 4 },
    loading: false,
    mutationKey: null,
    notice: "",
    highlightedGhostId: null,
    refresh: jest.fn(),
    registerCurrentGhost: jest.fn(),
    removeGhost: jest.fn(),
    ...overrides,
  };
}

describe("ArenaGhostScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      currentUser: { uid: "user-1" },
      isFirebaseAvailable: true,
    });
    mockUseArenaGhosts.mockReturnValue(createArenaState());
  });

  test("연결 상태를 사용자 문구로 변환한다", () => {
    expect(getGhostLinkLabel("linked")).toBe("현재 형태와 연결됨");
    expect(getGhostLinkLabel("evolved")).toContain("이전 형태");
    expect(getGhostLinkLabel("dead")).toContain("원본 디지몬 사망");
    expect(getGhostLinkLabel("legacy")).toBe("이전 아레나 기록");
  });

  test("오프라인 모드에서 온라인 전용 안내를 표시한다", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, isFirebaseAvailable: false });
    render(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={4} />);
    expect(screen.getByText("Ghost 아레나는 로그인 후 이용할 수 있는 온라인 기능입니다.")).toBeInTheDocument();
  });

  test("Ghost가 없어도 상대 도전 버튼을 제공한다", async () => {
    const onStartBattle = jest.fn().mockResolvedValue({ battleId: "battle-1" });
    const opponent = {
      ghostId: "ghost-enemy",
      ownerDisplayName: "상대 테이머",
      status: "active",
      canBattle: true,
      snapshot: { digimonName: "엔젤몬", sprite: 1, combatPowerAtCapture: 12 },
      ownDefenseRecord: { wins: 2, losses: 1 },
    };
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      opponents: [opponent],
    }));

    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        onStartBattle={onStartBattle}
        currentSlotId={4}
        selectedDigimon="스컬그레이몬"
        digimonStats={{ power: 10 }}
      />
    );

    expect(screen.getByText("등록된 Ghost가 없습니다. Ghost가 없어도 상대에게 도전할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByText("상대 테이머의 ???")).toBeInTheDocument();
    expect(screen.queryByText("엔젤몬")).not.toBeInTheDocument();
    expect(screen.queryByText(/Power 12/)).not.toBeInTheDocument();
    expect(screen.queryByText(/방어 보너스/)).not.toBeInTheDocument();

    const concealedSprite = screen.getByRole("img", { name: "정체를 알 수 없는 상대 Ghost" });
    expect(concealedSprite).toHaveClass("blur-lg", "grayscale", "brightness-50", "contrast-150");
    expect(concealedSprite).toHaveAttribute("draggable", "false");

    const opponentRecord = screen.getByLabelText("Ghost 방어: 2승 1패");
    expect(opponentRecord.querySelector(".text-emerald-600")).toHaveTextContent("2승");
    expect(opponentRecord.querySelector(".text-red-600")).toHaveTextContent("1패");

    fireEvent.click(screen.getByRole("button", { name: "도전" }));
    await waitFor(() => expect(onStartBattle).toHaveBeenCalledWith(opponent));
  });

  test("등록 형태와 Ghost 방어 전적을 분리하고 pending 삭제를 차단한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      capacity: { used: 1, limit: 3 },
      myGhosts: [{
        ghostId: "ghost-mine",
        status: "active",
        linkStatus: "evolved",
        snapshot: { digimonName: "엔젤몬", stage: "Adult", sprite: 1 },
        formRecordMirror: { attackWins: 2, attackLosses: 1, defenseWins: 1, defenseLosses: 0 },
        ownDefenseRecord: { wins: 4, losses: 3 },
        legacyRecord: { wins: 5, losses: 2 },
        pendingMirrorCount: 1,
      }],
    }));

    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={4}
        selectedDigimon="스컬그레이몬"
        digimonStats={{ power: 10 }}
      />
    );

    const formRecord = screen.getByLabelText("등록 형태 전적: 3승 1패");
    expect(formRecord.querySelector(".text-emerald-600")).toHaveTextContent("3승");
    expect(formRecord.querySelector(".text-red-600")).toHaveTextContent("1패");

    const defenseRecord = screen.getByLabelText("Ghost 방어 전적: 4승 3패");
    expect(defenseRecord.querySelector(".text-emerald-600")).toHaveTextContent("4승");
    expect(defenseRecord.querySelector(".text-red-600")).toHaveTextContent("3패");

    const legacyRecord = screen.getByLabelText("이전 아레나 전적 · 공격/방어 구분 없음: 5승 2패");
    expect(legacyRecord.querySelector(".text-emerald-600")).toHaveTextContent("5승");
    expect(legacyRecord.querySelector(".text-red-600")).toHaveTextContent("2패");

    const currentRecord = screen.getByLabelText("현재 형태 전적: 공격 1승 2패 · 방어 3승 4패");
    expect(currentRecord.querySelectorAll(".text-emerald-600")).toHaveLength(2);
    expect(currentRecord.querySelectorAll(".text-red-600")).toHaveLength(2);
    expect(screen.getByText("형태 전적 동기화 중 · 삭제 잠시 불가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
  });

  test("현재 디지몬 이미지와 Power 상세 및 V2 배틀 공식을 표시한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      myGhosts: [
        { ghostId: "ghost-1", status: "active", snapshot: { digimonName: "A" }, pendingMirrorCount: 0 },
        { ghostId: "ghost-2", status: "active", snapshot: { digimonName: "B" }, pendingMirrorCount: 0 },
      ],
      capacity: { used: 2, limit: 3 },
    }));

    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={2}
        selectedDigimon="엔젤몬"
        digimonStats={{ strength: 5, traitedEgg: true, effort: 2 }}
        currentDigimonData={{
          sprite: 123,
          spriteBasePath: "/images/v1",
          stage: "Adult",
          stats: { basePower: 10, type: "Vaccine" },
        }}
      />
    );

    expect(screen.getByRole("img", { name: "현재 디지몬 엔젤몬" })).toHaveAttribute(
      "src",
      "/images/v1/123.png"
    );
    expect(screen.getByText("성숙기", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("최종 공격 Power 38")).toHaveTextContent("36 + Ghost 2 = 38");

    fireEvent.click(screen.getByRole("button", { name: "Power 상세 펼치기 ▼" }));
    expect(screen.getByText("Base Power: 10")).toBeInTheDocument();
    expect(screen.getByText("Strength 보너스: +8")).toBeInTheDocument();
    expect(screen.getByText("Traited Egg 보너스: +8")).toBeInTheDocument();
    expect(screen.getByText("Effort 보너스: +10")).toBeInTheDocument();
    expect(screen.getByText("최종 공격 Power = 36 + 2 = 38")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "펼치기 ▼" }));
    expect(screen.getByText("먼저 3번 명중한 쪽이 승리")).toBeInTheDocument();
    expect(screen.getByText(/공격자 Power × 100/)).toBeInTheDocument();
    expect(screen.getByText("방어: Ghost 등록 당시 Power + 고정 방어 보너스 1")).toBeInTheDocument();
    expect(screen.getByText("Weight -4g, Energy -1")).toBeInTheDocument();
  });
});
