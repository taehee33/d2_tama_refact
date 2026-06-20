import { useCallback, useEffect, useRef } from "react";

export const GAME_OUTBOX_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 900_000];
export const GAME_OUTBOX_PERIODIC_FLUSH_MS = 15 * 60 * 1000;

export function useGameOutboxSync({
  enabled,
  isLoadingSlot = false,
  flushOutbox,
  retryDelays = GAME_OUTBOX_RETRY_DELAYS_MS,
  periodicFlushMs = GAME_OUTBOX_PERIODIC_FLUSH_MS,
}) {
  const flushRef = useRef(flushOutbox);
  const runningRef = useRef(false);
  const retryIndexRef = useRef(0);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    flushRef.current = flushOutbox;
  }, [flushOutbox]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
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
    const delay = retryDelays[
      Math.min(retryIndexRef.current, Math.max(0, retryDelays.length - 1))
    ];
    retryIndexRef.current = Math.min(
      retryIndexRef.current + 1,
      Math.max(0, retryDelays.length - 1)
    );
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void requestFlush("재시도");
    }, delay ?? 900_000);
    return false;
  }, [clearRetryTimer, enabled, isLoadingSlot, retryDelays]);

  useEffect(() => {
    if (!enabled || isLoadingSlot || !flushRef.current) return undefined;

    void requestFlush("슬롯 로딩 완료");
    const interval = window.setInterval(() => {
      void requestFlush("15분 주기");
    }, periodicFlushMs);
    const handleOnline = () => void requestFlush("온라인 복귀");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestFlush("화면 재활성화");
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      clearRetryTimer();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearRetryTimer, enabled, isLoadingSlot, periodicFlushMs, requestFlush]);
}
