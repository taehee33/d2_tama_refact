import React, { useEffect, useState } from "react";

export const GAME_HEADER_INFO_COLLAPSED_KEY = "game_header_info_collapsed";

function loadHeaderInfoCollapsed() {
  try {
    const saved = localStorage.getItem(GAME_HEADER_INFO_COLLAPSED_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch (error) {
    console.error("Failed to load game header info collapsed state:", error);
    return true;
  }
}

function GameHeaderMeta({
  slotName,
  slotCreatedAtText,
  slotDevice,
  slotVersion,
  currentTimeText,
}) {
  const [isCollapsed, setIsCollapsed] = useState(loadHeaderInfoCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(GAME_HEADER_INFO_COLLAPSED_KEY, JSON.stringify(isCollapsed));
    } catch (error) {
      console.error("Failed to save game header info collapsed state:", error);
    }
  }, [isCollapsed]);

  return (
    <div className={`game-header-meta-section ${isCollapsed ? "game-header-meta-section--collapsed" : ""}`}>
      <button
        type="button"
        className="game-header-meta-toggle"
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((previous) => !previous)}
      >
        {isCollapsed ? "정보 펼치기" : "정보 접기"}
      </button>

      {!isCollapsed ? (
        <div className="game-header-meta" data-testid="game-header-meta">
          <p className="text-xs text-gray-600">
            슬롯 이름: {slotName} | 생성일: {slotCreatedAtText}
          </p>
          <p className="text-xs text-gray-600">
            기종: {slotDevice} / 버전: {slotVersion}
          </p>
          <p className="text-sm font-semibold text-blue-600">현재 시간: {currentTimeText}</p>
        </div>
      ) : null}
    </div>
  );
}

export default GameHeaderMeta;
