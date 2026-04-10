import React from "react";
import IconButton from "../IconButton";
import MenuIconButtons from "../MenuIconButtons";
import {
  getGroupedGameMenus,
  getMenuDisabledState,
  MENU_SURFACES,
} from "../../constants/gameMenus";

function ImmersiveLandscapeControls({
  activeMenu = null,
  onMenuClick = () => {},
  isFrozen = false,
  isLightsOn = true,
  isMobile = false,
  layout = "panel",
  groupId = null,
}) {
  if (layout === "strip") {
    const isMobileGridLayout = isMobile;
    const group =
      getGroupedGameMenus(MENU_SURFACES.PRIMARY).find(
        (menuGroup) => menuGroup.id === groupId
      ) || getGroupedGameMenus(MENU_SURFACES.PRIMARY)[0];

    return (
      <section
        className="immersive-landscape-control-strip"
        aria-label={`${group.label} 가로 조작`}
      >
        <div
          className={`immersive-landscape-control-strip__scroller ${
            isMobileGridLayout
              ? "immersive-landscape-control-strip__scroller--mobile-grid"
              : ""
          }`.trim()}
          role="group"
          aria-label={group.label}
        >
          {group.menus.map((menu) => {
            const disabledState = getMenuDisabledState(menu.id, {
              isFrozen,
              isLightsOn,
            });

            return (
              <div
                key={menu.id}
                className="immersive-landscape-control-strip__cell"
              >
                <IconButton
                  icon={menu.icon}
                  onClick={() => onMenuClick(menu.id)}
                  isActive={activeMenu === menu.id}
                  disabled={disabledState.disabled}
                  lockedReason={disabledState.message}
                  width={isMobileGridLayout ? "100%" : isMobile ? 80 : 92}
                  height={isMobileGridLayout ? 46 : isMobile ? 54 : 62}
                  className="icon-button--immersive-brick-strip"
                  label={menu.label}
                  isMobile={isMobile}
                  ariaLabel={menu.label}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="immersive-landscape-controls">
      <div className="immersive-landscape-controls__header">
        <span className="immersive-landscape-controls__eyebrow">조작 패널</span>
        <strong className="immersive-landscape-controls__title">
          디지바이스 버튼
        </strong>
      </div>
      <MenuIconButtons
        activeMenu={activeMenu}
        onMenuClick={onMenuClick}
        isFrozen={isFrozen}
        isLightsOn={isLightsOn}
        isMobile={isMobile}
        buttonHeight={76}
        className="menu-icon-buttons--immersive-landscape"
        buttonClassName="icon-button--immersive-landscape"
      />
    </div>
  );
}

export default ImmersiveLandscapeControls;
