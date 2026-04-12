import React from "react";
import {
  resolveTamerNameInitial,
  resolveTamerNamePriority,
} from "../../utils/tamerNameUtils";

function renderAvatar(currentUser, tamerName, avatarClassName, fallbackClassName) {
  if (currentUser?.photoURL) {
    return (
      <img
        src={currentUser.photoURL}
        alt="프로필"
        className={avatarClassName}
      />
    );
  }

  return (
    <span className={fallbackClassName}>
      {resolveTamerNameInitial({
        tamerName,
        currentUser,
      })}
    </span>
  );
}

function renderMasterBadges({ hasVer1Master, hasVer2Master, compact = false }) {
  const badgeClassName = compact
    ? "inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium shrink-0"
    : "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium shrink-0";
  const badgeClassNameVer2 = compact
    ? "inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0"
    : "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0";

  return (
    <>
      {hasVer1Master ? <span className={badgeClassName}>👑 Ver.1</span> : null}
      {hasVer2Master ? <span className={badgeClassNameVer2}>👑 Ver.2</span> : null}
    </>
  );
}

function renderProfileMenu({
  compact = false,
  currentUser,
  tamerName,
  hasVer1Master,
  hasVer2Master,
  showProfileMenu,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onOpenAccountSettings,
}) {
  if (!currentUser) {
    return null;
  }

  const displayName = resolveTamerNamePriority({
    tamerName,
    currentUser,
  });

  return (
    <div className="relative">
      <button
        onClick={onToggleProfileMenu}
        className={
          compact
            ? "flex items-center gap-1.5 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded pixel-art-button"
            : "flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded pixel-art-button"
        }
      >
        {renderAvatar(
          currentUser,
          tamerName,
          compact ? "w-6 h-6 rounded-full" : "w-8 h-8 rounded-full",
          compact
            ? "w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs"
            : "w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold text-gray-700"
        )}
        <span
          className={
            compact
              ? "text-xs text-gray-700 hidden sm:inline max-w-[80px] truncate flex items-center gap-1 flex-wrap"
              : "text-sm text-gray-700 flex items-center gap-1 flex-wrap"
          }
        >
          <span className="truncate">
            {compact ? displayName : `테이머: ${displayName}`}
          </span>
          {renderMasterBadges({ hasVer1Master, hasVer2Master, compact })}
        </span>
        <span className="text-xs text-gray-500">▼</span>
      </button>

      {showProfileMenu ? (
        <>
          <div className="fixed inset-0 z-40" onClick={onCloseProfileMenu} />
          <div
            className={
              compact
                ? "absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[150px] w-max max-w-[min(90vw,280px)] profile-dropdown"
                : "absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[200px] w-max max-w-[min(90vw,280px)]"
            }
          >
            <div className="px-3 py-2 border-b border-gray-200">
              <p
                className={
                  compact
                    ? "text-xs font-semibold text-gray-700 whitespace-nowrap truncate flex flex-wrap items-center gap-1"
                    : "text-sm font-semibold text-gray-700 whitespace-nowrap truncate flex flex-wrap items-center gap-1"
                }
              >
                <span>테이머: {displayName}</span>
                {renderMasterBadges({ hasVer1Master, hasVer2Master, compact })}
              </p>
              <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
            </div>
            <button
              onClick={onOpenAccountSettings}
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 pixel-art-button"
            >
              계정 설정/로그아웃
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function GamePageToolbar({
  isMobile = false,
  currentUser = null,
  isFirebaseAvailable = false,
  tamerName = "",
  hasVer1Master = false,
  hasVer2Master = false,
  showProfileMenu = false,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenPlayHub,
  onOpenImmersiveView,
  onlineUsersNode = null,
}) {
  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-white bg-opacity-95 border-b border-gray-300 shadow-sm mobile-nav-bar">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={onOpenPlayHub}
            className="px-2 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm pixel-art-button flex items-center gap-1"
          >
            <span>← 허브</span>
          </button>

          <div className="flex items-center gap-2">
            {onlineUsersNode}

            <button
              onClick={onOpenImmersiveView}
              className="px-2 py-1.5 bg-slate-900 text-white rounded pixel-art-button"
              title="몰입형 플레이"
            >
              ⛶
            </button>

            <button
              onClick={onOpenSettings}
              className="px-2 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
              title="설정"
            >
              ⚙️
            </button>

            {isFirebaseAvailable
              ? renderProfileMenu({
                  compact: true,
                  currentUser,
                  tamerName,
                  hasVer1Master,
                  hasVer2Master,
                  showProfileMenu,
                  onToggleProfileMenu,
                  onCloseProfileMenu,
                  onOpenAccountSettings,
                })
              : null}
          </div>
        </div>

        {isFirebaseAvailable && currentUser ? (
          <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">
              테이머: {resolveTamerNamePriority({ tamerName, currentUser })}
            </span>
            {renderMasterBadges({ hasVer1Master, hasVer2Master })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="game-page-toolbar">
      <div className="game-page-toolbar__actions">
        <button
          onClick={onOpenPlayHub}
          className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
        >
          ← 플레이 허브
        </button>
        <button
          onClick={onOpenImmersiveView}
          className="px-3 py-1 bg-slate-900 hover:bg-slate-700 text-white rounded pixel-art-button"
        >
          몰입형 플레이
        </button>
      </div>

      <div className="game-page-toolbar__utilities">
        {onlineUsersNode}

        <button
          onClick={onOpenSettings}
          className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
          title="설정"
        >
          ⚙️
        </button>

        {isFirebaseAvailable
          ? renderProfileMenu({
              currentUser,
              tamerName,
              hasVer1Master,
              hasVer2Master,
              showProfileMenu,
              onToggleProfileMenu,
              onCloseProfileMenu,
              onOpenAccountSettings,
            })
          : null}

        {!isFirebaseAvailable ? (
          <span className="text-sm text-gray-500">Firebase 미설정</span>
        ) : null}
      </div>
    </div>
  );
}

export default GamePageToolbar;
