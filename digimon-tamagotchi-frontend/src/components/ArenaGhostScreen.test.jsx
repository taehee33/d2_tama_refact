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
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      opponents: [{
        ghostId: "ghost-enemy",
        ownerDisplayName: "상대 테이머",
        status: "active",
        canBattle: true,
        snapshot: { digimonName: "엔젤몬", sprite: 1, combatPowerAtCapture: 12 },
        ownDefenseRecord: { wins: 2, losses: 1 },
      }],
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
    fireEvent.click(screen.getByRole("button", { name: "도전" }));
    await waitFor(() => expect(onStartBattle).toHaveBeenCalledWith(expect.objectContaining({ ghostId: "ghost-enemy" })));
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

    expect(screen.getByText("등록 형태 전적: 3승 1패")).toBeInTheDocument();
    expect(screen.getByText("Ghost 방어 전적: 4승 3패")).toBeInTheDocument();
    expect(screen.getByText("형태 전적 동기화 중 · 삭제 잠시 불가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
  });
});
