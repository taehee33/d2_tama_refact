import React from "react";

function ImmersiveGameTopBar({
  isMobile = false,
  onOpenBaseView,
  onOpenPlayHub,
}) {
  if (isMobile) {
    return (
      <div className="game-immersive-nav game-immersive-nav--mobile">
        <div className="game-immersive-nav__inner">
          <div className="game-immersive-nav__badge">몰입형 플레이</div>
          <div className="game-immersive-nav__actions">
            <button
              type="button"
              onClick={onOpenBaseView}
              className="game-immersive-nav__button game-immersive-nav__button--secondary"
            >
              기본 화면
            </button>
            <button
              type="button"
              onClick={onOpenPlayHub}
              className="game-immersive-nav__button game-immersive-nav__button--primary"
            >
              플레이 허브
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed left-4 right-4 top-4 z-50 flex items-center justify-between">
      <div className="rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
        몰입형 플레이
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenBaseView}
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
        >
          기본 화면
        </button>
        <button
          type="button"
          onClick={onOpenPlayHub}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm"
        >
          플레이 허브
        </button>
      </div>
    </div>
  );
}

export default ImmersiveGameTopBar;
