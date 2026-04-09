import React from "react";

function GamePageView({
  isMobile = false,
  isImmersive = false,
  mobileHeaderNode = null,
  desktopToolbarNode = null,
  defaultShellNode = null,
  immersiveShellNode = null,
  adsNode = null,
  accountSettingsNode = null,
  className = "",
}) {
  return (
    <div
      className={`game-page-view ${isImmersive ? "game-page-view--immersive" : "game-page-view--default"} ${className}`.trim()}
      data-testid="game-page-view"
      data-immersive={isImmersive ? "true" : "false"}
      data-mobile={isMobile ? "true" : "false"}
    >
      {isMobile && mobileHeaderNode ? (
        <div className="game-page-view__mobile-header" data-testid="game-page-view-mobile-header">
          {mobileHeaderNode}
        </div>
      ) : null}

      {!isMobile && desktopToolbarNode ? (
        <div className="game-page-view__desktop-toolbar" data-testid="game-page-view-desktop-toolbar">
          {desktopToolbarNode}
        </div>
      ) : null}

      <div className="game-page-view__shell" data-testid="game-page-view-shell">
        {isImmersive ? immersiveShellNode : defaultShellNode}
      </div>

      {adsNode ? (
        <div className="game-page-view__ads" data-testid="game-page-view-ads">
          {adsNode}
        </div>
      ) : null}

      {accountSettingsNode ? (
        <div className="game-page-view__account-settings" data-testid="game-page-view-account-settings">
          {accountSettingsNode}
        </div>
      ) : null}
    </div>
  );
}

export default GamePageView;
