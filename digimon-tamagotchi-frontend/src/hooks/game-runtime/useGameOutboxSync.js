import { useCallback, useEffect, useRef, useState } from "react";

export const GAME_OUTBOX_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 900_000];

export function useGameOutboxSync({
  enabled,
  isLoadingSlot = false,
  flushOutbox,
  retryDelays = GAME_OUTBOX_RETRY_DELAYS_MS,
  nextFlushAt = null,
}) {
  const flushRef = useRef(flushOutbox);
  const retryDelaysRef = useRef(retryDelays);
  const runningRef = useRef(false);
  const retryIndexRef = useRef(0);
  const retryTimerRef = useRef(null);
  const [retryAt, setRetryAt] = useState(null);

  useEffect(() => {
    flushRef.current = flushOutbox;
  }, [flushOutbox]);

  useEffect(() => {
    retryDelaysRef.current = retryDelays;
  }, [retryDelays]);

  const clearRetryTimer = useCallback((resetStatus = true) => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (resetStatus) setRetryAt(null);
  }, []);

  const requestFlush = useCallback(async (reason) => {
    if (!enabled || isLoadingSlot || runningRef.current || !flushRef.current) {
      return false;
    }

    runningRef.current = true;
    try {
      const didFlush = await flushRef.current(reason);
      if (didFlush !== false) {
        retryIndexRef.current = 0;
        clearRetryTimer();
        return true;
      }
    } catch (error) {
      console.warn(`[GameOutbox] ${reason} 재전송 실패:`, error);
    } finally {
      runningRef.current = false;
    }

    clearRetryTimer();
    const activeRetryDelays = retryDelaysRef.current;
    const delay = activeRetryDelays[
      Math.min(retryIndexRef.current, Math.max(0, activeRetryDelays.length - 1))
    ];
    retryIndexRef.current = Math.min(
      retryIndexRef.current + 1,
      Math.max(0, activeRetryDelays.length - 1)
    );
    setRetryAt(Date.now() + (delay ?? 900_000));
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void requestFlush("재시도");
    }, delay ?? 900_000);
    return false;
  }, [clearRetryTimer, enabled, isLoadingSlot]);

  useEffect(() => {
    if (!enabled || isLoadingSlot || !flushRef.current) return undefined;

    void requestFlush("슬롯 로딩 완료");
    const deadlineTimer = nextFlushAt != null && Number.isFinite(Number(nextFlushAt))
      ? window.setTimeout(() => {
          void requestFlush("15분 기록 요약");
        }, Math.max(0, Number(nextFlushAt) - Date.now()))
      : null;
    const handleOnline = () => void requestFlush("온라인 복귀");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestFlush("화면 재활성화");
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (deadlineTimer != null) window.clearTimeout(deadlineTimer);
      clearRetryTimer(false);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearRetryTimer, enabled, isLoadingSlot, nextFlushAt, requestFlush]);

  return { retryAt };
}
