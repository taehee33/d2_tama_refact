import React from "react";
import IconButton from "./IconButton";
import "../styles/MenuIconButtons.css";
import {
  getGroupedGameMenus,
  getMenuDisabledState,
  MENU_SURFACES,
} from "../constants/gameMenus";

const MenuIconButtons = ({
  width,
  height,
  buttonHeight: buttonHeightOverride,
  activeMenu,
  onMenuClick,
  isMobile = false,
  isFrozen = false,
  isLightsOn = true,
  className = "",
  buttonClassName = "",
}) => {
  const groupedMenus = getGroupedGameMenus(MENU_SURFACES.PRIMARY);
  const containerStyle = !isMobile && width ? { width: `${width}px` } : undefined;
  const buttonWidth = "100%";
  const compactButtonHeight = isMobile ? 54 : 52;
  const buttonHeight = (() => {
    if (typeof buttonHeightOverride === "number") {
      return buttonHeightOverride;
    }

    return typeof height === "number"
      ? Math.min(height, compactButtonHeight)
      : compactButtonHeight;
  })();

  return (
    <div
      className={`menu-icon-buttons ${isMobile ? "menu-icon-buttons--mobile" : ""} ${className}`.trim()}
      style={containerStyle}
    >
      {groupedMenus.map((group) => (
        <section key={group.id} className="menu-icon-section" aria-label={group.label}>
          <div
            className={`menu-icon-section__grid ${
              isMobile ? "menu-icon-section__grid--mobile" : "menu-icon-section__grid--desktop"
            }`}
            role="group"
            aria-label={group.label}
          >
            {group.menus.map((menu) => {
              const disabledState = getMenuDisabledState(menu.id, {
                isFrozen,
                isLightsOn,
              });

              return (
                <div key={menu.id} className="menu-grid-cell">
                  <IconButton
                    icon={menu.icon}
                    onClick={() => onMenuClick(menu.id)}
                    isActive={activeMenu === menu.id}
                    disabled={disabledState.disabled}
                    lockedReason={disabledState.message}
                    width={buttonWidth}
                    height={buttonHeight}
                    className={`${isMobile ? "icon-button-mobile touch-button" : ""} ${buttonClassName}`.trim()}
                    label={menu.label}
                    isMobile={isMobile}
                    ariaLabel={menu.label}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MenuIconButtons;
