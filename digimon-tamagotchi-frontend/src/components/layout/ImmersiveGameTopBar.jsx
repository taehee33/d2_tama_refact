import React, { useEffect } from "react";

function ImmersiveGameTopBar({
  isMobile = false,
  isCollapsed = false,
  layoutMode = "portrait",
  isChatOpen = false,
  unreadCount = 0,
  presenceCount = 0,
  showLandscapeSideToggle = false,
  landscapeSidePreference = "auto",
  effectiveLandscapeSide = "right",
  onToggleCollapsed,
  onChangeLayoutMode,
  onToggleChat,
  onCycleLandscapeSide,
  onToggleSkinPicker,
  onOpenBaseView,
  onOpenPlayHub,
}) {
  useEffect(() => {
    if (!isMobile || isCollapsed) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onToggleCollapsed?.(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCollapsed, isMobile, onToggleCollapsed]);

  const runMobileAction = (callback, ...args) => {
    if (isMobile && !isCollapsed) {
      onToggleCollapsed?.(true);
    }
    callback?.(...args);
  };

  const layoutToggle = (
    <div
      className="game-immersive-nav__layout-toggle"
      role="group"
      aria-label="몰입형 화면 방향"
    >
      <button
        type="button"
        onClick={() => runMobileAction(onChangeLayoutMode, "portrait")}
        className={`game-immersive-nav__chip ${
          layoutMode === "portrait" ? "game-immersive-nav__chip--active" : ""
        }`}
        aria-pressed={layoutMode === "portrait"}
      >
        세로
      </button>
      <button
        type="button"
        onClick={() => runMobileAction(onChangeLayoutMode, "landscape")}
        className={`game-immersive-nav__chip ${
          layoutMode === "landscape" ? "game-immersive-nav__chip--active" : ""
        }`}
        aria-pressed={layoutMode === "landscape"}
      >
        가로
      </button>
    </div>
  );

  const skinButton = (
    <button
      type="button"
      onClick={() => runMobileAction(onToggleSkinPicker)}
      className="game-immersive-nav__button game-immersive-nav__button--secondary"
    >
      스킨 변경
    </button>
  );

  const chatButtonLabel = isChatOpen ? "채팅 닫기" : "채팅";
  const chatButton = (
    <button
      type="button"
      onClick={() => runMobileAction(onToggleChat)}
      className={`game-immersive-nav__button game-immersive-nav__button--chat ${
        isChatOpen ? "game-immersive-nav__button--chat-active" : ""
      }`.trim()}
      aria-pressed={isChatOpen}
      aria-label={chatButtonLabel}
    >
      <span className="game-immersive-nav__button-text">{chatButtonLabel}</span>
      <span className="game-immersive-nav__button-count">{`${presenceCount}명`}</span>
      {unreadCount > 0 ? (
        <span className="game-immersive-nav__button-badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );

  const landscapeSideLabel =
    landscapeSidePreference === "auto"
      ? `방향 자동(${effectiveLandscapeSide === "left" ? "왼" : "오"})`
      : landscapeSidePreference === "left"
        ? "방향 왼쪽"
        : "방향 오른쪽";

  const landscapeSideButton = showLandscapeSideToggle ? (
    <button
      type="button"
      onClick={() => runMobileAction(onCycleLandscapeSide)}
      className="game-immersive-nav__button game-immersive-nav__button--secondary"
      aria-label="가로 방향 전환"
    >
      {landscapeSideLabel}
    </button>
  ) : null;

  const fabLabel = isCollapsed ? "메뉴" : "닫기";

  if (isMobile) {
    return (
      <div
        className="game-immersive-nav game-immersive-nav--mobile"
        data-testid="immersive-game-topbar"
        data-state={isCollapsed ? "collapsed" : "expanded"}
      >
        {!isCollapsed ? (
          <div
            className="game-immersive-nav__mobile-backdrop"
            onClick={() => onToggleCollapsed?.(true)}
            aria-hidden="true"
          />
        ) : null}
        <div className="game-immersive-nav__mobile-anchor">
          <button
            type="button"
            className={`game-immersive-nav__fab ${
              isCollapsed ? "" : "game-immersive-nav__fab--active"
            }`.trim()}
            onClick={() => onToggleCollapsed?.()}
            aria-label={isCollapsed ? "메뉴 열기" : "메뉴 닫기"}
            aria-expanded={!isCollapsed}
            data-state={isCollapsed ? "collapsed" : "expanded"}
          >
            <span className="game-immersive-nav__fab-icon" aria-hidden="true">
              {isCollapsed ? "☰" : "×"}
            </span>
            <span className="game-immersive-nav__fab-label">{fabLabel}</span>
            {unreadCount > 0 ? (
              <span className="game-immersive-nav__fab-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {!isCollapsed ? (
            <div className="game-immersive-nav__mobile-panel">
              <div className="game-immersive-nav__inner">
                <div className="game-immersive-nav__actions">
                  <button
                    type="button"
                    onClick={() => runMobileAction(onOpenPlayHub)}
                    className="game-immersive-nav__button game-immersive-nav__button--primary"
                  >
                    플레이 허브
                  </button>
                  <button
                    type="button"
                    onClick={() => runMobileAction(onOpenBaseView)}
                    className="game-immersive-nav__button game-immersive-nav__button--secondary"
                  >
                    기본 화면
                  </button>
                </div>
              </div>
              <div className="game-immersive-nav__tools">
                {layoutToggle}
                {landscapeSideButton}
                {chatButton}
                {skinButton}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="game-immersive-nav game-immersive-nav--desktop"
      data-testid="immersive-game-topbar"
    >
      <div className="game-immersive-nav__desktop-group">
        <div className="game-immersive-nav__actions">
          <button
            type="button"
            onClick={onOpenPlayHub}
            className="game-immersive-nav__button game-immersive-nav__button--primary"
          >
            플레이 허브
          </button>
          <button
            type="button"
            onClick={onOpenBaseView}
            className="game-immersive-nav__button game-immersive-nav__button--secondary"
          >
            기본 화면
          </button>
        </div>
        <div className="game-immersive-nav__badge">몰입형 플레이</div>
      </div>
      <div className="game-immersive-nav__desktop-group game-immersive-nav__desktop-group--tools">
        <div
          className="game-immersive-nav__tools-surface"
          data-testid="immersive-game-topbar-tools-surface"
        >
          {layoutToggle}
          {landscapeSideButton}
          {chatButton}
          {skinButton}
        </div>
      </div>
    </div>
  );
}

export default ImmersiveGameTopBar;
