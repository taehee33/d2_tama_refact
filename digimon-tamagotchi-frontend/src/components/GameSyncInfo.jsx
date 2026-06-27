import React, { useEffect, useMemo, useState } from "react";
import { formatSyncCountdown } from "../hooks/game-runtime/gameSyncSchedule";

const STATE_LABELS = {
  saving: "저장 중",
  local: "서버 저장 대기",
  synced: "서버 저장 완료",
  conflict: "다른 기기의 변경사항 확인 필요",
  unavailable: "저장소 사용 불가",
};

function formatSyncTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function GameSyncInfo({ syncInfo = null, compact = false }) {
  const [now, setNow] = useState(Date.now());
  const {
    mode = "firebase",
    stateSyncStatus = "synced",
    recordSyncStatus = "synced",
    nextStateSyncAt = null,
    nextRecordSyncAt = null,
    retryAt = null,
    pendingRecordCount = 0,
    lastStateSyncedAt = null,
    lastRecordSyncedAt = null,
    stateSyncError = "",
    recordSyncError = "",
  } = syncInfo || {};

  useEffect(() => {
    if (!nextStateSyncAt && !nextRecordSyncAt && !retryAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [nextRecordSyncAt, nextStateSyncAt, retryAt]);

  const stateCountdown = useMemo(() => formatSyncCountdown(nextStateSyncAt, now), [nextStateSyncAt, now]);
  const recordCountdown = useMemo(() => formatSyncCountdown(nextRecordSyncAt, now), [nextRecordSyncAt, now]);
  const retryCountdown = useMemo(() => formatSyncCountdown(retryAt, now), [retryAt, now]);
  const lastStateSyncedText = useMemo(() => formatSyncTime(lastStateSyncedAt), [lastStateSyncedAt]);
  const lastRecordSyncedText = useMemo(() => formatSyncTime(lastRecordSyncedAt), [lastRecordSyncedAt]);

  if (!syncInfo) return null;

  if (mode === "local") {
    return (
      <section className="game-sync-info mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left" data-testid="game-sync-info">
        <h3 className="text-xs font-bold text-slate-700">저장 및 동기화</h3>
        <p className="mt-1 text-xs font-semibold text-amber-700">현재 슬롯 · 이 기기에 저장됨</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          이 카드는 현재 슬롯과 활동 기록 저장 상태만 표시합니다.
        </p>
      </section>
    );
  }

  const hasRecordPending = pendingRecordCount > 0 || recordSyncStatus !== "synced";
  const recordLabel = retryAt && hasRecordPending
    ? `재전송 대기${retryCountdown ? ` · ${retryCountdown}` : ""}`
    : recordSyncStatus === "feed_pending"
      ? `먹이 기록 요약 대기${recordCountdown ? ` · ${recordCountdown}` : ""}`
      : recordSyncStatus === "local"
        ? "재전송 대기"
        : recordSyncStatus === "unavailable"
          ? "저장소 사용 불가"
          : "서버 동기화 완료";

  return (
    <section className={`game-sync-info mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left ${compact ? "game-sync-info--compact" : ""}`} data-testid="game-sync-info">
      <h3 className="text-xs font-bold text-slate-700">저장 및 동기화</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        현재 슬롯 저장과 활동 기록 전송 상태입니다. 긴급 알림 계산과 Discord 전송 상태는 설정 화면에서 확인합니다.
      </p>
      <dl className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex flex-wrap justify-between gap-2">
          <dt>현재 슬롯 저장</dt>
          <dd className="font-semibold text-slate-800">{STATE_LABELS[stateSyncStatus] || STATE_LABELS.synced}</dd>
        </div>
        {stateSyncStatus === "synced" && stateCountdown ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt>다음 슬롯 저장</dt>
            <dd>{stateCountdown}</dd>
          </div>
        ) : null}
        {stateSyncStatus === "local" && retryCountdown ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt>슬롯 재전송</dt>
            <dd>{retryCountdown}</dd>
          </div>
        ) : null}
        {lastStateSyncedText ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt>마지막 슬롯 저장</dt>
            <dd>{lastStateSyncedText}</dd>
          </div>
        ) : null}
        {stateSyncError ? (
          <div className="flex flex-wrap justify-between gap-2 text-rose-700">
            <dt>슬롯 저장 오류</dt>
            <dd className="max-w-[70%] text-right">{stateSyncError}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2">
          <dt>활동 기록 전송{pendingRecordCount > 0 ? ` (${pendingRecordCount})` : ""}</dt>
          <dd className="font-semibold text-slate-800">{recordLabel}</dd>
        </div>
        {lastRecordSyncedText ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt>마지막 활동 기록 전송</dt>
            <dd>{lastRecordSyncedText}</dd>
          </div>
        ) : null}
        {recordSyncError ? (
          <div className="flex flex-wrap justify-between gap-2 text-rose-700">
            <dt>활동 기록 오류</dt>
            <dd className="max-w-[70%] text-right">{recordSyncError}</dd>
          </div>
        ) : null}
      </dl>
      {!compact ? (
        <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-500">
          중요한 행동은 즉시 이 기기에 보존하고 슬롯 저장을 시도합니다. 일반 먹이 기록은 15분 단위로 묶어 전송합니다. 앱 종료로 전송하지 못한 내용은 다음 실행 때 자동으로 이어서 전송합니다.
        </p>
      ) : null}
    </section>
  );
}

export default GameSyncInfo;
