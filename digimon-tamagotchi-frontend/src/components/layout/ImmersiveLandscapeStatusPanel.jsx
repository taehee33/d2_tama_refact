import React from "react";
import StatusHearts from "../StatusHearts";
import DigimonStatusBadges from "../DigimonStatusBadges";

function ImmersiveLandscapeStatusPanel({
  slotId,
  slotVersion,
  digimonLabel,
  slotName,
  slotDevice,
  currentTimeText,
  isFrozen = false,
  statusHeartsProps = {},
  statusBadgesProps = {},
}) {
  return (
    <div
      className="immersive-landscape-status"
      data-testid="immersive-landscape-status-panel"
    >
      <div className="immersive-landscape-status__topline">
        <span>
          슬롯 {slotId} · {slotVersion}
        </span>
        {isFrozen ? <span>🧊 냉장고</span> : null}
      </div>
      <strong className="immersive-landscape-status__title">{digimonLabel}</strong>
      <span className="immersive-landscape-status__meta">
        {slotName || `슬롯${slotId}`} · {slotDevice || "디지바이스"}
      </span>
      <span className="immersive-landscape-status__time">
        현재 시간 {currentTimeText}
      </span>
      <div className="immersive-landscape-status__hearts">
        <StatusHearts
          {...statusHeartsProps}
          showLabels={false}
          size="sm"
          position="inline"
        />
      </div>
      <DigimonStatusBadges {...statusBadgesProps} />
    </div>
  );
}

export default ImmersiveLandscapeStatusPanel;
