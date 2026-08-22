import React, { useMemo, useState } from "react";
import { useArenaBattleHistory, buildArenaHistoryFilters } from "../hooks/useArenaBattleHistory";
import { getArenaBattleReplay } from "../utils/logArchiveApi";

export function getArenaArchiveUi(status) {
  switch (status) {
    case "ready": return { label: "상세 기록 보기", disabled: false, description: "상세 기록 보관 완료" };
    case "pending": return { label: "상세 기록 준비 중", disabled: true, description: "상세 기록을 정리하는 중입니다." };
    case "failed": return { label: "요약만 확인 가능", disabled: true, description: "상세 기록 보관에 실패했습니다." };
    default: return { label: "이전 아레나 기록", disabled: true, description: "구버전 요약 기록입니다." };
  }
}

export default function ArenaGhostHistory({ currentUser, isOnline, myGhosts, currentCombatIdentityId, compact = false }) {
  const history = useArenaBattleHistory({ currentUser, isOnline });
  const [replay, setReplay] = useState(null);
  const [replayError, setReplayError] = useState("");
  const [replayLoadingId, setReplayLoadingId] = useState(null);
  const filters = useMemo(
    () => buildArenaHistoryFilters(history.discoveredLogs, myGhosts, currentCombatIdentityId),
    [currentCombatIdentityId, history.discoveredLogs, myGhosts]
  );

  const openReplay = async (log) => {
    if (!log.archiveId || log.archiveStatus !== "ready") return;
    setReplayLoadingId(log.battleId);
    setReplayError("");
    try {
      const archive = await getArenaBattleReplay(currentUser, log.archiveId);
      setReplay({ log, events: Array.isArray(archive?.replayLogs) ? archive.replayLogs : [] });
    } catch (error) {
      setReplayError(error?.message || "상세 기록을 불러오지 못했습니다.");
    } finally {
      setReplayLoadingId(null);
    }
  };

  return (
    <section className={compact ? "flex h-full min-h-0 flex-col" : "mt-7 border-t pt-6"}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold">배틀 기록</h3>
          <p className="text-xs text-gray-500">최근 기록부터 5개씩 불러옵니다.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={history.filter}
            onChange={(event) => history.changeFilter(event.target.value)}
            disabled={history.loading || history.loadingMore}
            className="min-h-11 rounded border px-2 py-1 text-sm disabled:opacity-50"
            aria-label="배틀 기록 필터"
          >
            {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button onClick={history.refresh} disabled={history.loading || history.loadingMore} className="min-h-11 rounded border px-3 py-1 text-sm disabled:opacity-50">새로고침</button>
        </div>
      </div>
      {history.error && <p role="alert" className="mb-3 text-sm text-red-700">{history.error}</p>}
      {replayError && <p role="alert" className="mb-3 text-sm text-red-700">{replayError}</p>}
      {history.loading ? <p>기록을 불러오는 중...</p> : history.logs.length === 0 ? <p className="text-sm text-gray-600">표시할 배틀 기록이 없습니다.</p> : (
        <div className={`${compact ? "min-h-0 flex-1 overflow-y-auto pr-1" : ""} space-y-2`}>
          {history.logs.map((log) => {
            const archiveUi = getArenaArchiveUi(log.archiveStatus);
            return (
              <article key={log.battleId} className={`rounded-lg border text-sm ${compact ? "px-3 py-2" : "p-3"}`}>
                <div className="flex flex-col justify-between gap-2 sm:min-h-[46px] sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{log.attackerName} vs {log.defenderName}</p>
                    <p className="truncate text-xs text-gray-600">{log.isAttack ? "공격 기록" : "Ghost 방어 기록"} · {log.occurredAt ? log.occurredAt.toLocaleString("ko-KR") : "시간 정보 없음"}</p>
                    <p className="truncate text-xs text-gray-600">{archiveUi.description}</p>
                  </div>
                  <button
                    onClick={() => openReplay(log)}
                    disabled={archiveUi.disabled || replayLoadingId === log.battleId}
                    className="min-h-11 shrink-0 rounded border px-3 text-sm disabled:opacity-50"
                  >
                    {replayLoadingId === log.battleId ? "불러오는 중..." : archiveUi.label}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!history.loading && history.logs.length > 0 && (
        <nav aria-label="배틀 기록 페이지" className="mt-3 flex shrink-0 items-center justify-center gap-3">
          <button
            type="button"
            onClick={history.goToPreviousPage}
            disabled={!history.hasPrevious || history.loadingMore}
            className="min-h-11 min-w-20 rounded-lg border px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span aria-live="polite" className="min-w-20 text-center text-sm font-semibold text-gray-700">
            {history.loadingMore ? "불러오는 중..." : `${history.pageNumber} 페이지`}
          </span>
          <button
            type="button"
            onClick={history.goToNextPage}
            disabled={!history.hasMore || history.loadingMore}
            className="min-h-11 min-w-20 rounded-lg border border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      )}
      {replay && (
        <div role="dialog" aria-label="아레나 상세 기록" className="mt-4 rounded-lg bg-gray-900 p-4 text-white">
          <div className="flex justify-between gap-2">
            <h4 className="font-bold">{replay.log.attackerName} vs {replay.log.defenderName}</h4>
            <button onClick={() => setReplay(null)} aria-label="상세 기록 닫기">✕</button>
          </div>
          <ol className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
            {replay.events.length === 0 ? <li>저장된 replay 이벤트가 없습니다.</li> : replay.events.map((event, index) => (
              <li key={`${event.round || index}-${event.actor || event.attacker || "event"}-${index}`}>
                {event.message || `${event.actor === "attacker" || event.attacker === "user" ? "공격자" : "방어자"} ${event.hit ? "명중" : "회피"}`}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
