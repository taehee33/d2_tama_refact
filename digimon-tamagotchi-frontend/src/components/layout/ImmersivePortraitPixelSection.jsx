import React from "react";
import GameScreen from "../GameScreen";
import {
  getGameMenusBySurface,
  getMenuDisabledState,
  MENU_SURFACES,
} from "../../constants/gameMenus";
import { GAME_SCENE_SIZE } from "../../utils/gameSceneGeometry";
import "../../styles/ImmersivePortraitPixelSection.css";

const PRIMARY_MENUS = getGameMenusBySurface(MENU_SURFACES.PRIMARY);

const ImmersivePortraitPixelSection = ({
  skin,
  skinId,
  appearance,
  gameScreenProps = {},
  activeMenu,
  onMenuClick,
  isFrozen = false,
  isLightsOn = true,
  supportActionsNode,
  onOpenAppearance,
  currentTimeText,
  digimonLabel,
}) => {
  const style = {
    "--pixel-background-left": appearance.backgroundLeft,
    "--pixel-background-right": appearance.backgroundRight,
    "--pixel-device": appearance.device,
  };

  return (
    <section
      className="portrait-pixel-section"
      data-skin-id={skinId}
      style={style}
      aria-label={`${skin.name} 세로 디바이스`}
    >
      <div className="portrait-pixel-shell">
        <img
          className="portrait-pixel-shell__art"
          src={skin.portraitFrameSrc}
          alt=""
          aria-hidden="true"
        />
        <span className="portrait-pixel-shell__tint portrait-pixel-shell__tint--left" aria-hidden="true" />
        <span className="portrait-pixel-shell__tint portrait-pixel-shell__tint--right" aria-hidden="true" />
        <span className="portrait-pixel-shell__tint portrait-pixel-shell__tint--device" aria-hidden="true" />

        {skinId === "pixel-split-brick" ? (
          <button
            type="button"
            className="portrait-pixel-shell__appearance-shortcut"
            onClick={onOpenAppearance}
            aria-label="외형 꾸미기 열기"
            title="외형 꾸미기"
          />
        ) : null}

        <div className="portrait-pixel-shell__meta" aria-label="현재 디지몬 정보">
          <span>{currentTimeText}</span>
          <strong>{digimonLabel}</strong>
        </div>

        <div className="portrait-pixel-shell__screen" data-testid="portrait-pixel-game-screen">
          <GameScreen
            {...gameScreenProps}
            width={GAME_SCENE_SIZE.width}
            height={GAME_SCENE_SIZE.height}
          />
        </div>

        <div className="portrait-pixel-shell__controls" role="group" aria-label="빠른 조작">
          {PRIMARY_MENUS.map((menu) => {
            const disabledState = getMenuDisabledState(menu.id, {
              isFrozen,
              isLightsOn,
            });

            return (
              <button
                key={menu.id}
                type="button"
                className={`portrait-pixel-action ${activeMenu === menu.id ? "is-active" : ""}`.trim()}
                onClick={() => onMenuClick(menu.id)}
                disabled={disabledState.disabled}
                title={disabledState.message || menu.label}
                aria-pressed={activeMenu === menu.id}
              >
                <span className="portrait-pixel-action__face">
                  <img src={menu.icon} alt="" aria-hidden="true" />
                </span>
                <span className="portrait-pixel-action__label">{menu.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {supportActionsNode ? (
        <div className="portrait-pixel-section__support">{supportActionsNode}</div>
      ) : null}
    </section>
  );
};

export default ImmersivePortraitPixelSection;
