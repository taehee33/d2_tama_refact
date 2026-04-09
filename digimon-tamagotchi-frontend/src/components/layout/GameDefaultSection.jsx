import React from "react";
import GameScreen from "../GameScreen";
import ControlPanel from "../ControlPanel";

const GameDefaultSection = ({
  headerNode,
  gameScreenProps = {},
  controlPanelProps = {},
  activeMenu,
  onMenuClick,
  stats,
  isMobile,
  supportActionsNode,
}) => {
  return (
    <>
      {headerNode}
      <div
        className={`flex flex-col items-center w-full ${
          isMobile ? "game-screen-mobile" : ""
        }`.trim()}
        data-testid="game-default-screen-column"
      >
        <GameScreen {...gameScreenProps} />
        <div
          className={`flex justify-center w-full ${
            isMobile ? "control-panel-mobile" : ""
          }`.trim()}
        >
          <ControlPanel
            {...controlPanelProps}
            activeMenu={activeMenu}
            onMenuClick={onMenuClick}
            stats={stats}
            isMobile={isMobile}
          />
        </div>
        {supportActionsNode}
      </div>
    </>
  );
};

export default GameDefaultSection;
