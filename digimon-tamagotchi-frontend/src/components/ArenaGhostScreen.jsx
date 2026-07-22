import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useArenaGhosts } from "../hooks/useArenaGhosts";
import { isStarterDigimonId } from "../utils/digimonVersionUtils";
import { translateStage } from "../utils/stageTranslator";
import ArenaGhostHistory from "./ArenaGhostHistory";

function RecordLine({ label, record, legacy = false }) {
  if (!record) return null;
  const wins = legacy ? Number(record.wins || 0) : Number(record.attackWins || 0) + Number(record.defenseWins || 0);
  const losses = legacy ? Number(record.losses || 0) : Number(record.attackLosses || 0) + Number(record.defenseLosses || 0);
  return <p className="text-xs text-gray-600">{label}: {wins}승 {losses}패</p>;
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

function GhostSprite({ snapshot, size = "w-16 h-16" }) {
  const basePath = snapshot?.spriteBasePath || "/images";
  return (
    <img
      src={`${basePath}/${snapshot?.sprite ?? 0}.png`}
      alt={snapshot?.digimonName || snapshot?.digimonId || "Ghost"}
      className={`${size} object-contain pixelated`}
    />
  );
}

export default function ArenaGhostScreen({
  onClose,
  onStartBattle,
  currentSlotId,
  selectedDigimon,
  digimonStats,
  digimonNickname,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-6">
      <main className="mx-auto max-w-4xl rounded-xl bg-white p-4 shadow-2xl sm:p-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Ghost 아레나 V2</h2>
            <p className="text-sm text-gray-600">등록 당시 모습은 그대로 보존되며 배틀 결과는 서버에서 확정됩니다.</p>
          </div>
          <button onClick={onClose} aria-label="아레나 닫기" className="rounded px-3 py-2 text-xl">✕</button>
        </header>

        {(arena.notice || battleNotice) && (
          <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {battleNotice || arena.notice}
          </div>
        )}

        <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-bold">현재 디지몬</h3>
          <p className="text-lg">{digimonNickname ? `${digimonNickname}(${selectedDigimon})` : selectedDigimon || "없음"}</p>
          <p className="text-sm text-gray-600">슬롯 {currentSlotId} · {isDead ? "사망 상태" : isStarter ? "등록 불가 단계" : "공격 및 등록 가능"}</p>
          <p className="mt-2 text-sm">현재 형태 전적: 공격 {currentRecord.attackWins || 0}승 {currentRecord.attackLosses || 0}패 · 방어 {currentRecord.defenseWins || 0}승 {currentRecord.defenseLosses || 0}패</p>
          <p className="text-sm">기본 Power {digimonStats?.power || 0} + 활성 Ghost 보너스 {Math.min(3, arena.myGhosts.filter((ghost) => ghost.status === "active").length)}</p>
          {arena.capacity.used >= arena.capacity.limit && (
            <p className="mt-2 text-sm text-amber-800">새 Ghost를 등록하려면 기존 Ghost를 직접 삭제해 주세요.</p>
          )}
          <button
            onClick={arena.registerCurrentGhost}
            disabled={registrationBlocked || Boolean(arena.mutationKey)}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {arena.mutationKey === "register" ? "등록 중..." : "현재 형태 Ghost 등록"}
          </button>
        </section>

        <section className="mb-7">
          <h3 className="mb-3 text-xl font-bold">내 Ghost ({arena.capacity.used}/{arena.capacity.limit})</h3>
          {arena.loading ? <p>Ghost 정보를 불러오는 중...</p> : arena.myGhosts.length === 0 ? (
            <p className="rounded border border-dashed p-4 text-gray-600">등록된 Ghost가 없습니다. Ghost가 없어도 상대에게 도전할 수 있습니다.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {arena.myGhosts.map((ghost) => (
                <article
                  key={ghost.ghostId}
                  className={`rounded-xl border p-3 ${arena.highlightedGhostId === ghost.ghostId ? "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-300" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-3">
                    <GhostSprite snapshot={ghost.snapshot} />
                    <div>
                      <h4 className="font-bold">{ghost.snapshot?.digimonName || ghost.snapshot?.digimonId}</h4>
                      <p className="text-xs">{translateStage(ghost.snapshot?.stage)}</p>
                      <p className="text-xs font-semibold text-blue-700">{getGhostLinkLabel(ghost.linkStatus)}</p>
                    </div>
                  </div>
                  <RecordLine label="등록 형태 전적" record={ghost.formRecordMirror} />
                  <p className="text-xs text-gray-600">Ghost 방어 전적: {ghost.ownDefenseRecord?.wins || 0}승 {ghost.ownDefenseRecord?.losses || 0}패</p>
                  {ghost.legacyRecord && <RecordLine label="이전 아레나 전적 · 공격/방어 구분 없음" record={ghost.legacyRecord} legacy />}
                  {ghost.pendingMirrorCount > 0 && <p className="mt-1 text-xs font-bold text-amber-700">형태 전적 동기화 중 · 삭제 잠시 불가</p>}
                  {ghost.status !== "active" && <p className="mt-1 text-xs font-bold text-red-700">배틀할 수 없는 이전 Ghost</p>}
                  <button
                    onClick={() => handleDelete(ghost)}
                    disabled={ghost.pendingMirrorCount > 0 || Boolean(arena.mutationKey)}
                    className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-40"
                  >
                    {arena.mutationKey === `delete:${ghost.ghostId}` ? "삭제 중..." : "삭제"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-bold">도전 상대</h3>
            <button onClick={arena.refresh} disabled={arena.loading} className="rounded border px-3 py-1 text-sm">새로고침</button>
          </div>
          {arena.opponents.length === 0 ? <p className="rounded border border-dashed p-4 text-gray-600">현재 도전할 수 있는 Ghost가 없습니다.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {arena.opponents.map((ghost) => (
                <article key={ghost.ghostId} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <GhostSprite snapshot={ghost.snapshot} size="h-14 w-14" />
                    <div>
                      <h4 className="font-bold">{ghost.ownerDisplayName}의 {ghost.snapshot?.digimonName}</h4>
                      <p className="text-xs text-gray-600">Power {ghost.snapshot?.combatPowerAtCapture || 0} + 방어 보너스 1</p>
                      <p className="text-xs text-gray-600">Ghost 방어 {ghost.ownDefenseRecord?.wins || 0}승 {ghost.ownDefenseRecord?.losses || 0}패</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBattle(ghost)}
                    disabled={!ghost.canBattle || isDead || isStarter || Boolean(startingGhostId)}
                    className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    {startingGhostId === ghost.ghostId ? "확정 중..." : "도전"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
        <ArenaGhostHistory
          currentUser={currentUser}
          isOnline={Boolean(isFirebaseAvailable && currentUser)}
          myGhosts={arena.myGhosts}
          currentCombatIdentityId={arena.currentCombatIdentityId}
        />
      </main>
    </div>
  );
}
