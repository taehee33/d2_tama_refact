import React from "react";

export function GameLocalPersistenceWarning() {
  return (
    <div
      role="status"
      className="mx-auto my-3 max-w-3xl rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900"
    >
      이 기기의 임시 저장소를 사용할 수 없습니다. 서버 저장은 계속 시도됩니다.
    </div>
  );
}

function GameSlotLoadState({
  phase = "loading",
  error = null,
  onRetry,
  onBack,
}) {
  const isFailed = phase === "failed";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm"
        aria-live="polite"
      >
        {isFailed ? (
          <>
            <div className="mb-4 text-4xl" aria-hidden="true">⚠️</div>
            <h1 className="text-xl font-bold text-slate-900">슬롯을 불러오지 못했습니다.</h1>
            <p className="mt-2 text-slate-600">게임 데이터는 변경되지 않았습니다.</p>
            {error?.code === "SLOT_NOT_FOUND" ? (
              <p className="mt-3 text-sm text-slate-500">요청한 슬롯을 찾을 수 없습니다.</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                onClick={onRetry}
              >
                다시 시도
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                onClick={onBack}
              >
                플레이 허브로 돌아가기
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-b-blue-600"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-lg font-bold text-slate-900">슬롯 데이터 로딩 중...</h1>
            <p className="mt-2 text-sm text-slate-600">저장된 게임 상태를 안전하게 확인하고 있습니다.</p>
          </>
        )}
      </section>
    </main>
  );
}

export default GameSlotLoadState;
