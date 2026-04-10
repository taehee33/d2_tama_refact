import React from "react";
import GameHeaderMeta from "../GameHeaderMeta";
import StatusHearts from "../StatusHearts";
import DigimonStatusBadges from "../DigimonStatusBadges";

function GameHeaderPanel({
  className = "",
  slotId,
  digimonLabel,
  isFrozen = false,
  metaProps = {},
  statusHeartsProps = {},
  statusBadgesProps = {},
}) {
  return (
    <div className={className} data-testid="game-header-panel">
      <h2 className="text-base font-bold">
        슬롯 {slotId} - {digimonLabel}
        {isFrozen ? <span className="ml-2 text-blue-600">🧊 냉장고</span> : null}
      </h2>
      <GameHeaderMeta {...metaProps} />
      <div className="mt-2 flex flex-col items-center gap-2">
        <StatusHearts {...statusHeartsProps} showLabels size="sm" position="inline" />
        <DigimonStatusBadges {...statusBadgesProps} />
      </div>
    </div>
  );
}

export default GameHeaderPanel;
