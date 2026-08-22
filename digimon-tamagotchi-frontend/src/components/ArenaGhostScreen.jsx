import React, { useCallback, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useArenaGhosts } from "../hooks/useArenaGhosts";
import { isStarterDigimonId } from "../utils/digimonVersionUtils";
import { translateStage } from "../utils/stageTranslator";
import ArenaGhostHistory from "./ArenaGhostHistory";
import { ArenaBattleGuideContent } from "./arena/ArenaBattleGuide";
import ArenaDetailPanel from "./arena/ArenaDetailPanel";
import ArenaGhostPowerBreakdown, { ArenaGhostPowerBreakdownDetails } from "./arena/ArenaGhostPowerBreakdown";
import ArenaPowerBreakdown, { ArenaPowerBreakdownDetails } from "./arena/ArenaPowerBreakdown";

const ARENA_TABS = [
  { id: "battle", label: "대전" },
  { id: "ghosts", label: "내 Ghost" },
  { id: "history", label: "기록" },
];

function RecordValues({ wins = 0, losses = 0 }) {
  return (
    <span className="inline-flex gap-1">
      <span className="font-semibold text-emerald-600">{Number(wins || 0)}승</span>
      <span className="font-semibold text-red-600">{Number(losses || 0)}패</span>
    </span>
  );
}

function RecordLine({ label, record, legacy = false }) {
  if (!record) return null;
  const wins = legacy ? Number(record.wins || 0) : Number(record.attackWins || 0) + Number(record.defenseWins || 0);
  const losses = legacy ? Number(record.losses || 0) : Number(record.attackLosses || 0) + Number(record.defenseLosses || 0);
  return (
    <p aria-label={`${label}: ${wins}승 ${losses}패`} className="text-xs text-gray-600">
      {label}: <RecordValues wins={wins} losses={losses} />
    </p>
  );
}

export function getGhostLinkLabel(linkStatus) {
  switch (linkStatus) {
    case "linked": return "현재 형태와 연결됨";
    case "evolved": return "이전 형태 · 등록 형태 전적 고정";
    case "dead": return "원본 디지몬 사망 · 등록 형태 전적 고정";
    case "source_missing": return "원본 슬롯 없음 · 등록 형태 전적 고정";
    case "legacy": return "이전 아레나 기록";
    default: return "연결 상태 확인 불가";
  }
}

export function formatGhostRegisteredAt(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!value || Number.isNaN(date.getTime())) return "등록일 정보 없음";
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function GhostRegisteredAt({ value }) {
  return (
    <p className="text-xs text-gray-500">
      Ghost 등록일: {formatGhostRegisteredAt(value)}
    </p>
  );
}

function GhostSprite({ snapshot, size = "w-16 h-16", concealed = false }) {
  const basePath = snapshot?.spriteBasePath || "/images";
  return (
    <span className={concealed ? "overflow-hidden rounded" : undefined}>
      <img
        src={`${basePath}/${snapshot?.sprite ?? 0}.png`}
        alt={concealed ? "정체를 알 수 없는 상대 Ghost" : snapshot?.digimonName || snapshot?.digimonId || "Ghost"}
        className={`${size} object-contain pixelated ${concealed ? "scale-110 select-none blur-lg grayscale brightness-50 contrast-150" : ""}`}
        draggable={!concealed}
      />
    </span>
  );
}

export default function ArenaGhostScreen({
  onClose,
  onStartBattle,
  currentSlotId,
  selectedDigimon,
  digimonStats,
  digimonNickname,
  currentDigimonData,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [activeTab, setActiveTab] = useState("battle");
  const [historyVisited, setHistoryVisited] = useState(false);
  const [detailPanel, setDetailPanel] = useState(null);
  const [startingGhostId, setStartingGhostId] = useState(null);
  const [battleNotice, setBattleNotice] = useState("");
  const arena = useArenaGhosts({
    currentUser,
    isOnline: Boolean(isFirebaseAvailable && currentUser),
    currentSlotId,
  });

  const isDead = digimonStats?.isDead === true;
  const isStarter = isStarterDigimonId(selectedDigimon);
  const registrationBlocked = isDead || isStarter || arena.capacity.used >= arena.capacity.limit;
  const currentRecord = arena.currentFormRecord || {};
  const activeGhostCount = Math.min(3, arena.myGhosts.filter((ghost) => ghost.status === "active").length);
  const ghostCapacityLimit = Math.max(0, Number(arena.capacity.limit) || 3);
  const emptyGhostSlotCount = Math.max(0, ghostCapacityLimit - arena.myGhosts.length);
  const currentSpriteBasePath = currentDigimonData?.spriteBasePath || "/images";
  const myGhostsLoading = arena.myGhostsLoading ?? arena.loading;
  const opponentsLoading = arena.opponentsLoading ?? arena.loading;
  const closeDetailPanel = useCallback(() => setDetailPanel(null), []);

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (tab === "history") setHistoryVisited(true);
  };

  const handleTabKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = ARENA_TABS.findIndex((tab) => tab.id === activeTab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + ARENA_TABS.length) % ARENA_TABS.length;
    const nextTab = ARENA_TABS[nextIndex].id;
    selectTab(nextTab);
    document.getElementById(`arena-${nextTab}-tab`)?.focus();
  };

  const handleDelete = async (ghost) => {
    const name = ghost?.snapshot?.digimonName || "이 Ghost";
    const confirmed = window.confirm(
      `${name} Ghost를 삭제할까요?\n현재 디지몬에는 영향이 없으며 Ghost 방어 전적은 복구되지 않습니다.`
    );
    if (confirmed) await arena.removeGhost(ghost);
  };

  const handleBattle = async (ghost) => {
    if (!onStartBattle || startingGhostId) return;
    setStartingGhostId(ghost.ghostId);
    setBattleNotice("");
    try {
      await onStartBattle(ghost);
    } catch (error) {
      setBattleNotice(error?.message || "배틀을 시작하지 못했습니다.");
      setStartingGhostId(null);
    }
  };

  if (!isFirebaseAvailable || !currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <section className="w-full max-w-lg rounded-xl bg-white p-6 text-center shadow-xl">
          <h2 className="mb-3 text-2xl font-bold">Ghost 아레나</h2>
          <p className="mb-5 text-gray-700">Ghost 아레나는 로그인 후 이용할 수 있는 온라인 기능입니다.</p>
          <button onClick={onClose} className="rounded bg-gray-800 px-5 py-2 text-white">닫기</button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-1 min-[320px]:p-3 sm:p-6">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="arena-title"
        className="relative mx-auto flex h-[calc(100dvh-0.5rem)] max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl min-[320px]:h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-3rem)] sm:max-h-[840px]"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-2 py-3 min-[320px]:flex-nowrap min-[320px]:px-4 sm:px-5">
          <div className="w-full min-w-0 min-[320px]:w-auto">
            <h2 id="arena-title" className="text-lg font-bold leading-tight min-[320px]:text-xl sm:text-2xl">Ghost 아레나 V2</h2>
            <p className="hidden truncate text-xs text-gray-600 min-[320px]:block sm:text-sm">등록 당시 모습은 보존되며 배틀 결과는 서버에서 확정됩니다.</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDetailPanel({ type: "guide", title: "배틀 공식 및 규칙" })}
              aria-haspopup="dialog"
              className="min-h-11 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              규칙
            </button>
            <button onClick={onClose} aria-label="아레나 닫기" className="min-h-11 rounded-lg border px-3 text-sm hover:bg-gray-100">닫기</button>
          </div>
        </header>

        {(arena.notice || battleNotice) && (
          <div role="status" className="mx-4 mt-3 shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 sm:mx-5">
            {battleNotice || arena.notice}
          </div>
        )}

        <div role="tablist" aria-label="Ghost 아레나 메뉴" className="flex w-full shrink-0 border-b px-2 pt-2 sm:px-5">
          {ARENA_TABS.map((tab) => (
            <button
              key={tab.id}
              id={`arena-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`arena-${tab.id}-panel`}
              aria-label={tab.id === "ghosts" ? `내 Ghost ${arena.capacity.used}/${arena.capacity.limit}` : tab.label}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={`min-h-11 min-w-0 flex-1 border-b-2 px-2 text-sm font-bold transition-colors sm:min-w-24 sm:flex-none sm:px-5 ${activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              <span>{tab.label}</span>
              {tab.id === "ghosts" && (
                <span aria-hidden="true" className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {arena.capacity.used}/{arena.capacity.limit}
                </span>
              )}
            </button>
          ))}
        </div>

        <section
          id="arena-battle-panel"
          role="tabpanel"
          aria-labelledby="arena-battle-tab"
          hidden={activeTab !== "battle"}
          className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <section aria-labelledby="arena-power-title" className="shrink-0">
              <article className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-stretch gap-3 min-[360px]:grid-cols-[4rem_minmax(0,1fr)_minmax(6.75rem,12rem)]">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white p-1">
                    <img
                      src={`${currentSpriteBasePath}/${currentDigimonData?.sprite ?? 0}.png`}
                      alt={`현재 디지몬 ${selectedDigimon || "없음"}`}
                      className="h-14 w-14 object-contain pixelated"
                    />
                  </div>
                  <div className="min-w-0 self-center">
                    <p id="arena-power-title" className="text-xs font-semibold text-blue-700">현재 디지몬</p>
                    <h3 className="truncate font-bold">{digimonNickname ? `${digimonNickname}(${selectedDigimon})` : selectedDigimon || "없음"}</h3>
                    <p className="truncate text-xs text-gray-600">
                      슬롯 {currentSlotId}
                      {currentDigimonData?.stage ? ` · ${translateStage(currentDigimonData.stage)}` : ""}
                      {currentDigimonData?.stats?.type ? ` · ${currentDigimonData.stats.type}` : ""}
                    </p>
                  </div>
                  <div className="col-span-2 min-[360px]:col-span-1">
                    <ArenaPowerBreakdown
                      inlineSummary
                      digimonStats={digimonStats}
                      currentDigimonData={currentDigimonData}
                      activeGhostCount={activeGhostCount}
                      onOpenDetails={() => setDetailPanel({ type: "power", title: "아레나 공격 Power 상세" })}
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      aria-label={`현재 형태 전적: 공격 ${currentRecord.attackWins || 0}승 ${currentRecord.attackLosses || 0}패 · 방어 ${currentRecord.defenseWins || 0}승 ${currentRecord.defenseLosses || 0}패`}
                      className="text-xs"
                    >
                      공격 <RecordValues wins={currentRecord.attackWins} losses={currentRecord.attackLosses} />
                      {" · "}방어 <RecordValues wins={currentRecord.defenseWins} losses={currentRecord.defenseLosses} />
                    </p>
                    <p className={`text-xs font-semibold ${registrationBlocked ? "text-amber-800" : "text-emerald-700"}`}>
                      {isDead ? "사망 상태" : isStarter ? "등록 불가 단계" : arena.capacity.used >= arena.capacity.limit ? "Ghost 슬롯이 가득 찼습니다." : "공격 및 등록 가능"}
                    </p>
                  </div>
                  <button
                    onClick={arena.registerCurrentGhost}
                    aria-label="현재 디지몬 Ghost 등록"
                    disabled={registrationBlocked || Boolean(arena.mutationKey)}
                    className="min-h-11 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {arena.mutationKey === "register" ? "등록 중..." : "Ghost 등록"}
                  </button>
                </div>
              </article>
            </section>

            <section aria-labelledby="opponents-title" className="flex min-h-[20rem] flex-1 flex-col rounded-xl border border-gray-200 p-3 lg:min-h-0">
              <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="opponents-title" className="font-bold">도전 상대</h3>
                    <span
                      aria-label={`현재 ${arena.opponents.length}명, 전체 ${arena.opponentTotalCount ?? "확인 중"}명`}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600"
                    >
                      {arena.opponents.length}/{arena.opponentTotalCount ?? "-"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">상대를 선택하면 서버에서 배틀을 확정합니다.</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <label className="sr-only" htmlFor="arena-opponent-sort">도전 상대 정렬</label>
                  <select
                    id="arena-opponent-sort"
                    aria-label="도전 상대 정렬"
                    value={arena.opponentSort}
                    onChange={(event) => arena.changeOpponentSort(event.target.value)}
                    disabled={opponentsLoading || arena.opponentsLoadingMore}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm disabled:opacity-50 sm:w-44"
                  >
                    <option value="registered_desc">등록 최신순</option>
                    <option value="registered_asc">등록 오래된순</option>
                    <option value="defense_wins_desc">방어 승리 많은 순</option>
                    <option value="defense_wins_asc">방어 승리 적은 순</option>
                  </select>
                  <button onClick={arena.refresh} disabled={arena.loading || arena.opponentsLoadingMore} className="min-h-11 shrink-0 rounded-lg border px-3 text-sm hover:bg-gray-50 disabled:opacity-50">새로고침</button>
                </div>
              </div>
              {opponentsLoading ? (
                <p className="rounded border border-dashed p-4 text-gray-600">도전 상대 로딩 중...</p>
              ) : arena.opponentsError && arena.opponents.length === 0 ? (
                <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p>{arena.opponentsError}</p>
                  <button onClick={arena.refresh} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">다시 시도</button>
                </div>
              ) : arena.opponents.length === 0 ? (
                <p className="rounded border border-dashed p-4 text-gray-600">현재 도전할 수 있는 Ghost가 없습니다.</p>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {arena.opponents.map((ghost) => (
                      <article key={ghost.ghostId} className="flex min-h-[76px] items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <GhostSprite snapshot={ghost.snapshot} size="h-12 w-12" concealed />
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold">{ghost.ownerDisplayName}의 ???</h4>
                            <GhostRegisteredAt value={ghost.registeredAt} />
                            <p aria-label={`Ghost 방어: ${ghost.ownDefenseRecord?.wins || 0}승 ${ghost.ownDefenseRecord?.losses || 0}패`} className="text-xs text-gray-600">
                              Ghost 방어 <RecordValues wins={ghost.ownDefenseRecord?.wins} losses={ghost.ownDefenseRecord?.losses} />
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBattle(ghost)}
                          disabled={!ghost.canBattle || isDead || isStarter || Boolean(startingGhostId)}
                          className="min-h-11 shrink-0 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {startingGhostId === ghost.ghostId ? "확정 중" : "도전"}
                        </button>
                      </article>
                    ))}
                  </div>
                  {arena.opponentsError && (
                    <p role="alert" className="mt-2 text-center text-xs font-semibold text-red-700">{arena.opponentsError}</p>
                  )}
                  <nav aria-label="도전 상대 페이지" className="mt-2 flex shrink-0 items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={arena.goToPreviousOpponentPage}
                      disabled={!arena.hasPreviousOpponents || arena.opponentsLoadingMore}
                      className="min-h-11 rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      이전
                    </button>
                    <span aria-live="polite" className="min-w-20 text-center text-sm font-semibold text-gray-700">
                      {arena.opponentPageNumber}/{arena.opponentTotalPages ?? "-"} 페이지
                    </span>
                    <button
                      type="button"
                      onClick={arena.goToNextOpponentPage}
                      disabled={!arena.hasNextOpponents || arena.opponentsLoadingMore}
                      className="min-h-11 rounded-lg border border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {arena.opponentsLoadingMore ? "불러오는 중..." : "다음"}
                    </button>
                  </nav>
                </div>
              )}
            </section>
          </div>
        </section>

        <section
          id="arena-ghosts-panel"
          role="tabpanel"
          aria-labelledby="arena-ghosts-tab"
          hidden={activeTab !== "ghosts"}
          className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
        >
          <section aria-labelledby="my-ghosts-title" className="min-h-full rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 id="my-ghosts-title" className="font-bold">내 Ghost</h3>
                <p className="text-xs text-gray-500">등록된 Ghost의 전적과 Power를 확인하고 관리합니다.</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-600">
                {arena.capacity.used}/{arena.capacity.limit}
              </span>
            </div>

            {myGhostsLoading ? (
              <p className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-600">Ghost 정보를 불러오는 중...</p>
            ) : (
              <>
                {arena.myGhosts.length === 0 && (
                  <p className="mb-3 rounded-lg border border-dashed bg-white p-4 text-sm text-gray-600">
                    등록된 Ghost가 없습니다. Ghost가 없어도 상대에게 도전할 수 있습니다.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {arena.myGhosts.map((ghost) => (
                    <article
                      key={ghost.ghostId}
                      className={`min-w-0 rounded-lg border bg-white p-3 ${arena.highlightedGhostId === ghost.ghostId ? "border-yellow-500 ring-2 ring-yellow-300" : "border-gray-200"}`}
                    >
                      <div className="flex items-center gap-2">
                        <GhostSprite snapshot={ghost.snapshot} size="h-12 w-12" />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-bold">{ghost.snapshot?.digimonName || ghost.snapshot?.digimonId}</h4>
                          <p className="truncate text-[11px] text-gray-600">{translateStage(ghost.snapshot?.stage)} · {getGhostLinkLabel(ghost.linkStatus)}</p>
                          <GhostRegisteredAt value={ghost.registeredAt} />
                        </div>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-2">
                        <RecordLine label="등록 형태 전적" record={ghost.formRecordMirror} />
                        <p aria-label={`Ghost 방어 전적: ${ghost.ownDefenseRecord?.wins || 0}승 ${ghost.ownDefenseRecord?.losses || 0}패`} className="text-xs text-gray-600">
                          방어: <RecordValues wins={ghost.ownDefenseRecord?.wins} losses={ghost.ownDefenseRecord?.losses} />
                        </p>
                      </div>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <ArenaGhostPowerBreakdown
                          compact
                          snapshot={ghost.snapshot}
                          onOpenDetails={() => setDetailPanel({ type: "ghostPower", title: `${ghost.snapshot?.digimonName || ghost.snapshot?.digimonId || "Ghost"} Power 상세`, snapshot: ghost.snapshot })}
                        />
                        <button
                          onClick={() => handleDelete(ghost)}
                          disabled={ghost.pendingMirrorCount > 0 || Boolean(arena.mutationKey)}
                          className="min-h-11 shrink-0 rounded border border-red-300 px-2 text-xs text-red-700 disabled:opacity-40"
                        >
                          {arena.mutationKey === `delete:${ghost.ghostId}` ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                      {ghost.legacyRecord && <RecordLine label="이전 아레나 전적 · 공격/방어 구분 없음" record={ghost.legacyRecord} legacy />}
                      {ghost.pendingMirrorCount > 0 && <p className="mt-1 text-[11px] font-bold text-amber-700">형태 전적 동기화 중 · 삭제 잠시 불가</p>}
                      {ghost.status !== "active" && <p className="mt-1 text-[11px] font-bold text-red-700">배틀할 수 없는 이전 Ghost</p>}
                    </article>
                  ))}
                  {Array.from({ length: emptyGhostSlotCount }, (_, index) => (
                    <article
                      key={`empty-ghost-slot-${index + 1}`}
                      aria-label={`빈 Ghost 슬롯 ${index + 1}`}
                      className="flex min-h-[132px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-3 text-center text-gray-500"
                    >
                      <h4 className="font-bold text-gray-600">빈 슬롯</h4>
                      <p className="mt-1 text-xs">Ghost를 등록할 수 있습니다.</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </section>

        <section
          id="arena-history-panel"
          role="tabpanel"
          aria-labelledby="arena-history-tab"
          hidden={activeTab !== "history"}
          className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4"
        >
          {historyVisited && (
            <ArenaGhostHistory
              compact
              currentUser={currentUser}
              isOnline={Boolean(isFirebaseAvailable && currentUser)}
              myGhosts={arena.myGhosts}
              currentCombatIdentityId={arena.currentCombatIdentityId}
            />
          )}
        </section>

        {detailPanel && (
          <ArenaDetailPanel title={detailPanel.title} onClose={closeDetailPanel}>
            {detailPanel.type === "guide" && <ArenaBattleGuideContent />}
            {detailPanel.type === "power" && (
              <ArenaPowerBreakdownDetails digimonStats={digimonStats} currentDigimonData={currentDigimonData} activeGhostCount={activeGhostCount} />
            )}
            {detailPanel.type === "ghostPower" && <ArenaGhostPowerBreakdownDetails snapshot={detailPanel.snapshot} />}
          </ArenaDetailPanel>
        )}
      </main>
    </div>
  );
}
