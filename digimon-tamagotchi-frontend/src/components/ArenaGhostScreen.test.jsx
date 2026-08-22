import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ArenaGhostScreen, {
  formatGhostRegisteredAt,
  getGhostLinkLabel,
} from "./ArenaGhostScreen";

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
    opponentsLoadingMore: false,
    opponentsError: "",
    opponentSort: "registered_desc",
    opponentTotalCount: 0,
    opponentPageNumber: 0,
    opponentTotalPages: 0,
    hasPreviousOpponents: false,
    hasNextOpponents: false,
    mutationKey: null,
    notice: "",
    highlightedGhostId: null,
    refresh: jest.fn(),
    changeOpponentSort: jest.fn(),
    goToPreviousOpponentPage: jest.fn(),
    goToNextOpponentPage: jest.fn(),
    registerCurrentGhost: jest.fn(),
    removeGhost: jest.fn(),
    ...overrides,
  };
}

describe("ArenaGhostScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.scrollTo = jest.fn();
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
    expect(formatGhostRegisteredAt("2026-07-22T03:00:00.000Z")).toBe("2026. 7. 22.");
    expect(formatGhostRegisteredAt(null)).toBe("등록일 정보 없음");
  });

  test("현재 디지몬은 긴 이름과 작은 Power 배지 및 전적을 항상 표시한다", () => {
    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={2}
        selectedDigimon="오메가몬 Alter-S [Ver.2]"
        digimonNickname="한태희의 아주 긴 파트너 이름"
        digimonStats={{ power: 10 }}
      />
    );

    const name = screen.getByText("한태희의 아주 긴 파트너 이름(오메가몬 Alter-S [Ver.2])");
    expect(name).toHaveClass("break-words");
    expect(name).not.toHaveClass("truncate");

    expect(screen.queryByRole("button", { name: /현재 디지몬 정보 (펼치기|접기)/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("현재 형태 전적: 공격 1승 2패 · 방어 3승 4패")).toBeInTheDocument();
    expect(screen.getByText("공격 및 등록 가능")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 디지몬 Ghost 등록" })).toBeInTheDocument();

    const powerButton = screen.getByRole("button", { name: "Power 상세 보기" });
    expect(powerButton).toHaveClass("min-h-14", "sm:min-h-16");
  });

  test("현재 디지몬은 내부 영문 ID 대신 한글 이름을 표시한다", () => {
    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={5}
        selectedDigimon="Tokomon"
        currentDigimonData={{ name: "토코몬", sprite: 7 }}
      />
    );

    expect(screen.getByRole("heading", { name: "토코몬" })).toBeInTheDocument();
    expect(screen.queryByText("Tokomon")).not.toBeInTheDocument();
    expect(screen.getByAltText("현재 디지몬 토코몬")).toBeInTheDocument();
  });

  test("이전 접힘 설정값과 관계없이 현재 디지몬 정보를 표시한다", () => {
    window.localStorage.setItem("arena_ghost_current_digimon_collapsed", "true");

    render(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="토코몬" />);

    expect(screen.getByLabelText("현재 형태 전적: 공격 1승 2패 · 방어 3승 4패")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 디지몬 Ghost 등록" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /현재 디지몬 정보 (펼치기|접기)/ })).not.toBeInTheDocument();
  });

  test("대전 패널은 외부 스크롤을 막고 상대 목록만 관성 스크롤을 사용한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      opponents: [{
        ghostId: "ghost-scroll",
        ownerDisplayName: "상대",
        status: "active",
        canBattle: true,
        snapshot: { sprite: 1 },
        ownDefenseRecord: { wins: 0, losses: 0 },
      }],
      opponentTotalCount: 1,
      opponentPageNumber: 1,
      opponentTotalPages: 1,
    }));

    render(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="토코몬" />);

    expect(document.getElementById("arena-battle-panel")).toHaveClass("overflow-y-auto", "min-[320px]:overflow-hidden");
    const scrollArea = screen.getByTestId("arena-opponent-scroll-area");
    expect(scrollArea).toHaveClass(
      "overflow-visible",
      "overscroll-contain",
      "min-h-0",
      "flex-none",
      "min-[320px]:overflow-y-auto",
      "min-[320px]:flex-1",
      "[-webkit-overflow-scrolling:touch]"
    );
    expect(screen.getByRole("heading", { name: "상대의 ???" }).closest("article")).toHaveClass("min-h-[72px]");
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
      registeredAt: "2026-07-21T03:00:00.000Z",
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

    expect(screen.getByText("상대 테이머의 ???")).toBeInTheDocument();
    expect(screen.getByText("Ghost 등록일: 2026. 7. 21.")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("tab", { name: /^내 Ghost/ }));
    expect(screen.getByText("등록된 Ghost가 없습니다. Ghost가 없어도 상대에게 도전할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getAllByText("빈 슬롯")).toHaveLength(3);
    expect(screen.getAllByLabelText(/빈 Ghost 슬롯/)).toHaveLength(3);
  });

  test("상대 Ghost 응답 전에는 빈 상태 대신 로딩 상태를 표시한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      loading: true,
      myGhostsLoading: true,
      opponentsLoading: true,
      opponents: [],
    }));

    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={4}
        selectedDigimon="스컬그레이몬"
        digimonStats={{ power: 10 }}
      />
    );

    expect(screen.getByText("도전 상대 로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText("현재 도전할 수 있는 Ghost가 없습니다.")).not.toBeInTheDocument();
  });

  test("도전 상대 수와 cursor 페이지 이동을 Hook 동작에 연결한다", () => {
    const changeOpponentSort = jest.fn();
    const goToPreviousOpponentPage = jest.fn();
    const goToNextOpponentPage = jest.fn();
    const opponents = Array.from({ length: 6 }, (_, index) => ({
      ghostId: `ghost-enemy-${index}`,
      ownerDisplayName: `상대 ${index}`,
      canBattle: true,
      registeredAt: "2026-08-22T00:00:00.000Z",
      snapshot: { sprite: 1 },
      ownDefenseRecord: { wins: 3, losses: 1 },
    }));
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      opponents,
      opponentTotalCount: 13,
      opponentPageNumber: 1,
      opponentTotalPages: 3,
      hasNextOpponents: true,
      changeOpponentSort,
      goToPreviousOpponentPage,
      goToNextOpponentPage,
    }));

    const { rerender } = render(
      <ArenaGhostScreen onClose={jest.fn()} currentSlotId={4} selectedDigimon="스컬그레이몬" />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "도전 상대 정렬" }), {
      target: { value: "defense_wins_desc" },
    });
    expect(changeOpponentSort).toHaveBeenCalledWith("defense_wins_desc");
    expect(screen.getByText("6/13")).toBeInTheDocument();
    expect(screen.getByText("1/3 페이지")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전" })).toHaveClass("min-h-11");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(goToNextOpponentPage).toHaveBeenCalledTimes(1);

    mockUseArenaGhosts.mockReturnValue(createArenaState({
      opponents: [opponents[0]],
      opponentTotalCount: 13,
      opponentPageNumber: 3,
      opponentTotalPages: 3,
      hasPreviousOpponents: true,
      goToPreviousOpponentPage,
      goToNextOpponentPage,
    }));
    rerender(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={4} selectedDigimon="스컬그레이몬" />);

    expect(screen.getByText("1/13")).toBeInTheDocument();
    expect(screen.getByText("3/3 페이지")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  test("내 Ghost와 도전 상대 로딩 상태를 독립적으로 표시한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      loading: true,
      myGhostsLoading: false,
      opponentsLoading: true,
      myGhosts: [],
      opponents: [],
    }));

    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={4}
        selectedDigimon="스컬그레이몬"
        digimonStats={{ power: 10 }}
      />
    );

    expect(screen.getByText("도전 상대 로딩 중...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^내 Ghost/ }));
    expect(screen.getByText("등록된 Ghost가 없습니다. Ghost가 없어도 상대에게 도전할 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByText("Ghost 정보를 불러오는 중...")).not.toBeInTheDocument();
  });

  test("대전, 내 Ghost, 기록 탭을 순환하고 내 Ghost를 독립 패널에 표시한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      capacity: { used: 1, limit: 3 },
      myGhosts: [{
        ghostId: "ghost-mobile",
        status: "active",
        linkStatus: "linked",
        registeredAt: "2026-08-22T00:00:00.000Z",
        snapshot: { digimonName: "레오몬", stage: "Adult", sprite: 1, combatPowerAtCapture: 50 },
        formRecordMirror: { attackWins: 0, attackLosses: 0, defenseWins: 0, defenseLosses: 0 },
        ownDefenseRecord: { wins: 0, losses: 0 },
        pendingMirrorCount: 0,
      }],
    }));

    render(
      <ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="토코몬" />
    );

    const battleTab = screen.getByRole("tab", { name: "대전" });
    const ghostsTab = screen.getByRole("tab", { name: "내 Ghost 1/3" });
    const historyTab = screen.getByRole("tab", { name: "기록" });
    expect([battleTab, ghostsTab, historyTab]).toHaveLength(3);
    expect(battleTab).toHaveAttribute("aria-selected", "true");
    expect(ghostsTab).toHaveAttribute("aria-controls", "arena-ghosts-panel");
    expect(screen.queryByRole("button", { name: /내 Ghost (펼치기|접기)/ })).not.toBeInTheDocument();

    fireEvent.keyDown(battleTab, { key: "ArrowRight" });
    expect(ghostsTab).toHaveAttribute("aria-selected", "true");
    expect(ghostsTab).toHaveFocus();
    expect(screen.getByText("레오몬")).toBeInTheDocument();
    expect(screen.getByText("레오몬").closest("article").parentElement).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3"
    );

    fireEvent.keyDown(ghostsTab, { key: "ArrowRight" });
    expect(historyTab).toHaveAttribute("aria-selected", "true");
    expect(historyTab).toHaveFocus();
    fireEvent.keyDown(historyTab, { key: "ArrowRight" });
    expect(battleTab).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(battleTab, { key: "ArrowLeft" });
    expect(historyTab).toHaveAttribute("aria-selected", "true");
  });

  test("Ghost 등록 후 대전 탭을 유지하고 슬롯 배지를 갱신한다", () => {
    const registerCurrentGhost = jest.fn();
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      capacity: { used: 0, limit: 3 },
      registerCurrentGhost,
    }));

    const { rerender } = render(
      <ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="엔젤몬" />
    );

    fireEvent.click(screen.getByRole("button", { name: "현재 디지몬 Ghost 등록" }));
    expect(registerCurrentGhost).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "대전" })).toHaveAttribute("aria-selected", "true");

    mockUseArenaGhosts.mockReturnValue(createArenaState({
      capacity: { used: 1, limit: 3 },
      registerCurrentGhost,
      myGhosts: [{ ghostId: "registered", status: "active", snapshot: { digimonName: "엔젤몬" } }],
    }));
    rerender(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="엔젤몬" />);

    expect(screen.getByRole("tab", { name: "내 Ghost 1/3" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "대전" })).toHaveAttribute("aria-selected", "true");
  });

  test("등록 형태와 Ghost 방어 전적을 분리하고 pending 삭제를 차단한다", () => {
    mockUseArenaGhosts.mockReturnValue(createArenaState({
      capacity: { used: 1, limit: 3 },
      myGhosts: [{
        ghostId: "ghost-mine",
        status: "active",
        linkStatus: "evolved",
        registeredAt: "2026-07-22T03:00:00.000Z",
        snapshot: { digimonName: "엔젤몬", stage: "Adult", sprite: 1, combatPowerAtCapture: 50 },
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

    const currentRecord = screen.getByLabelText("현재 형태 전적: 공격 1승 2패 · 방어 3승 4패");
    expect(currentRecord.querySelectorAll(".text-emerald-600")).toHaveLength(2);
    expect(currentRecord.querySelectorAll(".text-red-600")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: /^내 Ghost/ }));
    const formRecord = screen.getByLabelText("등록 형태 전적: 3승 1패");
    expect(formRecord.querySelector(".text-emerald-600")).toHaveTextContent("3승");
    expect(formRecord.querySelector(".text-red-600")).toHaveTextContent("1패");

    const defenseRecord = screen.getByLabelText("Ghost 방어 전적: 4승 3패");
    expect(defenseRecord.querySelector(".text-emerald-600")).toHaveTextContent("4승");
    expect(defenseRecord.querySelector(".text-red-600")).toHaveTextContent("3패");

    const legacyRecord = screen.getByLabelText("이전 아레나 전적 · 공격/방어 구분 없음: 5승 2패");
    expect(legacyRecord.querySelector(".text-emerald-600")).toHaveTextContent("5승");
    expect(legacyRecord.querySelector(".text-red-600")).toHaveTextContent("2패");

    expect(screen.getByText("형태 전적 동기화 중 · 삭제 잠시 불가")).toBeInTheDocument();
    expect(screen.getByText("Ghost 등록일: 2026. 7. 22.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(screen.getByText("등록 Power")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getAllByText("빈 슬롯")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "엔젤몬 Ghost Power 상세 보기" }));
    expect(screen.getByText("등록 당시 Power: 50")).toBeInTheDocument();
    expect(screen.getByText("Ghost 방어 보너스: +1")).toBeInTheDocument();
    expect(screen.getByText("최종 방어 Power = 50 + 1 = 51")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "현재 디지몬 Ghost 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("최종 공격 Power 38")).toHaveTextContent("38");
    expect(screen.getByText("36 + Ghost 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Power 상세 보기" }));
    expect(screen.getByText("Base Power: 10")).toBeInTheDocument();
    expect(screen.getByText("Strength 보너스: +8")).toBeInTheDocument();
    expect(screen.getByText("Traited Egg 보너스: +8")).toBeInTheDocument();
    expect(screen.getByText("Effort 보너스: +10")).toBeInTheDocument();
    expect(screen.getByText("최종 공격 Power = 36 + 2 = 38")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "아레나 공격 Power 상세 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "규칙" }));
    expect(screen.getByText("먼저 3번 명중한 쪽이 승리")).toBeInTheDocument();
    expect(screen.getByText(/공격자 Power × 100/)).toBeInTheDocument();
    expect(screen.getByText("방어: Ghost 등록 당시 Power + 고정 방어 보너스 1")).toBeInTheDocument();
    expect(screen.getByText("Weight -4g, Energy -1")).toBeInTheDocument();
  });

  test("기록 탭은 처음 선택할 때 마운트하고 다시 돌아와도 상태 경계를 유지한다", () => {
    render(
      <ArenaGhostScreen
        onClose={jest.fn()}
        currentSlotId={2}
        selectedDigimon="엔젤몬"
        digimonStats={{ power: 10 }}
      />
    );

    expect(screen.queryByTestId("arena-ghost-history")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "기록" }));
    expect(screen.getByTestId("arena-ghost-history")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "기록" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "대전" }));
    expect(screen.getByTestId("arena-ghost-history").closest('[role="tabpanel"]')).toHaveAttribute("hidden");
  });

  test("상세 패널은 Escape로 닫히고 실행 버튼으로 포커스를 돌려준다", async () => {
    render(<ArenaGhostScreen onClose={jest.fn()} currentSlotId={2} selectedDigimon="엔젤몬" />);
    const guideButton = screen.getByRole("button", { name: "규칙" });
    guideButton.focus();
    fireEvent.click(guideButton);
    expect(screen.getByRole("dialog", { name: "배틀 공식 및 규칙" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "배틀 공식 및 규칙" })).not.toBeInTheDocument());
    await waitFor(() => expect(guideButton).toHaveFocus());
  });
});
